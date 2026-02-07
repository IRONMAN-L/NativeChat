import { signal } from '@/native/signal';
import { channelListStore } from '@/store/channelListStore';
import { chatStore, LocalMessage } from '@/store/chatStore';
import { Database } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
// import {  } from 'expo-router';
// We pass the supabase client in because it might be needed for lookups
export const handleNewMessage = async (
    payload: any,
    supabase: SupabaseClient<Database>,
    recipientUserName?: string
) => {
    try {
        console.log("📨 Processing New Message...");

        const newRow = payload.new; // From 'message_recipients' table

        // 1. We need the Channel ID and Sender ID to proceed
        // (The recipient row only has message_id, we need metadata)
        const { data: meta, error } = await supabase
            .from('messages')
            .select('*')
            .eq('id', newRow.message_id)
            .single();

        if (error || !meta) {
            console.error("❌ Metadata missing for message:", newRow.message_id);
            return;
        }

        // 2. Decrypt Immediately 🔓
        const plaintext = await signal.decrypt(meta.user_id!, newRow.ciphertext);

        if (!plaintext) {
            console.warn("Decryption failed (or message was empty)");
            return;
        }

        // 3. Determine Content (Text vs Image)
        let displayContent = plaintext;
        let securePayload = undefined;

        // Check if it's the hidden JSON for an image
        if (plaintext.startsWith('{') && plaintext.includes('"type":"image"')) {
            displayContent = "📷 Photo";
            securePayload = plaintext; // Save keys for later download
        }


        // 4. Save to Channel List Store (for index.tsx)
        // This moves the chat to the top of the list instantly
        // getting details from channel we received message
        const receivedChannel = await channelListStore.updateChannelPreview(supabase, meta.channel_id!, {
            content: displayContent,
            createdAt: meta.created_at,
            isRead: false // It's new!
        });

        let senderDetails;
        if (!recipientUserName) {
            senderDetails = receivedChannel.users?.find(user => user.id === meta.user_id);
        }
        // 5. Save to Chat Detail Store (for [id].tsx)
        const newMessage: LocalMessage = {
            id: newRow.message_id,
            text: displayContent,
            senderId: meta.user_id!,
            senderName: senderDetails?.first_name ?? "",
            createdAt: meta.created_at,
            isMe: false,
            status: 'delivered', // It reached us
            imageUri: null,      // We haven't downloaded the file yet
            securePayload: securePayload, // Store keys if it's an image
        };

        await chatStore.addMessage(meta.channel_id!, newMessage);


        // 6. Send Local Notification 🔔
        await Notifications.scheduleNotificationAsync({
            content: {
                title: recipientUserName ? recipientUserName : senderDetails?.first_name ?? "",
                body: displayContent,
                data: { channelId: meta.channel_id },
                categoryIdentifier: 'chat_message',
                sound: 'default',
            },
            trigger: null, // Show immediately
        });

        await supabase.from('message_recipients').update({ status: 'delivered' }).eq('id', newRow.id);

        console.log("Message Decrypted, Stored & Notified!");

    } catch (e) {
        console.error("Error in messageHandler:", e);
    }
};