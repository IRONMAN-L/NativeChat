import { supabase } from '@/lib/supabase';
import { signal } from '@/native/signal';
import { channelListStore } from '@/store/channelListStore';
import { chatStore } from '@/store/chatStore';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
    if (AppState.currentState === 'active') {
        console.log(" App is active. Skipping background notification task.");
        return;
    }
    if (error) {
        console.error(" Background Task Error:", error);
        return;
    }

    try {
        // Parse the payload
        const payload = (data as any).notification?.data;

        if (!payload || !payload.message_id) {
            console.log("No message_id in background payload");
            return;
        }

        const messageId = payload.message_id;
        console.log(`Background waking up for message: ${messageId}`);

        // we may not have userId, so fetch from async storage (supabase stores in async storage)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.log("No auth session in background. Cannot decrypt.");
            return;
        }

        // fetch ciphertext from supabase
        const { data: messageData, error: msgError } = await supabase
            .from('messages')
            .select('*, message_recipients!inner(ciphertext)')
            .eq('id', messageId)
            .single();
        if (msgError || !messageData) {
            console.error("Could not fetch message in background", msgError);
            return;
        }

        const senderId = messageData.user_id;
        const channelId = messageData.channel_id;
        const ciphertext = messageData.message_recipients[0].ciphertext;

        if (!senderId || !ciphertext || !channelId) {
            console.log("There is no message fetched form server");
            return;
        }
        // decrypt
        const decryptedPayload = await signal.decrypt(senderId, ciphertext);
        if (!decryptedPayload) {
            console.error("Failed to decrypt message in background");
            return;
        }

        let finalText = decryptedPayload;
        let securePayload = undefined;
        if (decryptedPayload.startsWith('{') && decryptedPayload.includes('"type":"image"')) {
            finalText = "📷 Photo";
            securePayload = decryptedPayload;
        }
        // store or update the channel
        const receivedChannel = await channelListStore.updateChannelPreview(supabase, channelId, { content: finalText, createdAt: messageData.created_at, isRead: false })
        const senderName = receivedChannel.users?.find(user => user.id === senderId)?.first_name;

        // store the message
        const finalMsg = {
            id: messageData.id,
            text: finalText,
            senderId: senderId,
            senderName: senderName || "",
            imageUri: null,
            createdAt: messageData.created_at,
            isMe: false, // It's incoming
            status: 'read' as const,
            securePayload: securePayload
        };
        await chatStore.addMessage(channelId, finalMsg)

        // show local notification
        await Notifications.scheduleNotificationAsync({
            content: {
                title: senderName || "", // You can fetch sender name here if you want
                body: finalText,
                data: { channelId: channelId, messageId: messageData.id },
                categoryIdentifier: 'chat_message', // Adds Reply buttons
                sound: 'default',
            },
            trigger: null,
        })

    } catch (err) {
        console.error("Background Task Failed:", err);

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Someone",
                body: "New message for you",
                categoryIdentifier: undefined,
                sound: false,
            },
            trigger: {
                channelId: 'silent',
                second: 0,
            },
        })
    }
})

export const registerBackgroundNotificationTask = async () => {
    // This tells Expo: "If a notification comes in while app is backgrounded, run this task"
    // Note: This specific API is for "Background Fetch" or "Data Notifications".
    // For Expo Push Notifications specifically, we use:
    Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
};