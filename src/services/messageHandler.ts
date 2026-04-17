import { signal } from '@/native/signal';
import { channelListStore } from '@/store/channelListStore';
import { chatStore, LocalMessage, MessageType } from '@/store/chatStore';
import { Database } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';

// Dedup set: prevents double-processing when both background task AND
// realtime listener try to handle the same message (race condition).
const processedMessages = new Set<string>();
const MAX_PROCESSED_CACHE = 200;
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// We pass the supabase client in because it might be needed for lookups
export const handleNewMessage = async (
    payload: any,
    supabase: SupabaseClient<Database>,
    recipientUserName?: string,
    skipNotification?: boolean
) => {
    try {
        const newRow = payload.new; // From 'message_recipients' table
        const messageId = newRow.message_id;

        // Skip if already processed (prevents Signal ratchet double-advance)
        if (processedMessages.has(messageId)) {
            console.log("Message already processed, skipping:", messageId);
            return null;
        }
        processedMessages.add(messageId);

        // Keep set from growing forever
        if (processedMessages.size > MAX_PROCESSED_CACHE) {
            const first = processedMessages.values().next().value;
            if (first) processedMessages.delete(first);
        }

        console.log("📨 Processing New Message...");


        // 1. We need the Channel ID and Sender ID to proceed
        // (The recipient row only has message_id, we need metadata)
        let meta: any;
        if (newRow.created_at) {
            meta = newRow;
        } else {
            let attempts = 0;
            while (attempts < 3) {
                const { data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('id', newRow.message_id)
                    .single();

                if (!error && data) {
                    meta = data;
                    break;
                }

                console.warn(`Attempt ${attempts + 1} failed to fetch metadata. Retrying...`);
                await delay(1000);
                attempts++;
            }
        }
        if (!meta) {
            console.error("❌ Metadata missing for message:", newRow.message_id);
            return;
        }

        // 2. Decrypt Immediately 🔓
        const plaintext = await signal.decrypt(meta.user_id!, newRow.ciphertext);

        if (!plaintext) {
            console.warn("Decryption failed (or message was empty)");
            return;
        }

        // 3. Determine Content (Text vs File)
        let displayContent = plaintext;
        let securePayload = undefined;
        let messageType: MessageType = 'text';
        let fileName: string | undefined;

        // Check if it's an encrypted file payload (JSON with type field)
        if (plaintext.startsWith('{')) {
            try {
                const parsed = JSON.parse(plaintext);
                if (parsed.type === 'image') {
                    displayContent = "📷 Photo";
                    securePayload = plaintext;
                    messageType = 'image';
                } else if (parsed.type === 'audio') {
                    displayContent = "🎵 Audio";
                    securePayload = plaintext;
                    messageType = 'audio';
                    fileName = parsed.fileName;
                } else if (parsed.type === 'video') {
                    displayContent = "🎬 Video";
                    securePayload = plaintext;
                    messageType = 'video';
                    fileName = parsed.fileName;
                } else if (parsed.type === 'document') {
                    displayContent = `📄 ${parsed.fileName || 'Document'}`;
                    securePayload = plaintext;
                    messageType = 'document';
                    fileName = parsed.fileName;
                }
            } catch {
                // Not valid JSON, treat as plain text
            }
        }


        // 4. Save to Channel List Store (for index.tsx)
        // This moves the chat to the top of the list instantly
        // getting details from channel we received message
        const receivedChannel = await channelListStore.updateChannelPreview(supabase, meta.channel_id!, {
            content: displayContent,
            createdAt: meta.created_at,
            isRead: false, // It's new!
            isMe: false, // Explicitly not me so it unreadCount increments
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
            senderName: recipientUserName ? recipientUserName : senderDetails?.first_name ?? "",
            createdAt: meta.created_at,
            isMe: false,
            status: 'delivered', // It reached us
            imageUri: null,      // We haven't downloaded the file yet
            securePayload: securePayload, // Store keys if it's a file
            messageType: messageType,
            fileName: fileName,
        };

        await chatStore.addMessage(meta.channel_id!, newMessage);


        // 6. Send Local Notification 🔔 (skip when app is in foreground)
        if (!skipNotification) {
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
        }

        await supabase.from('message_recipients').update({ status: 'delivered', channel_id: meta.channel_id, sender_id: meta.user_id }).eq('message_id', messageId).eq('recipient_user_id', newRow.recipient_user_id);
        console.log("Message Decrypted, Stored & Notified!");
        return { message: newMessage, channelId: meta.channel_id! };

    } catch (e) {
        console.error("Error in messageHandler:", e);
        return null;
    }
};

