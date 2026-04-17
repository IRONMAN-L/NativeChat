import { signal } from '@/native/signal';
import { chatStore } from '@/store/chatStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { AppState, DeviceEventEmitter } from 'react-native';
import NativeTaskModule from '../../modules/native-task/src/NativeTaskModule';

export const FOREGROUND_PUSH_EVENT = 'foreground-push-message';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
    // 1. If app is in foreground, emit event for the React tree to handle
    //    (useChats listens for this and routes through handleNewMessage with dedup)
    if (AppState.currentState === 'active') {
        try {
            const payload = data as any;
            if (payload.actionIdentifier) return;
            const rawData = JSON.parse(payload.data.body);
            const { ciphertext, sender_id, channel_id, message_id, sender_name, created_at } = rawData;
            if (ciphertext && sender_id && channel_id && message_id && sender_name && created_at) {
                console.log("📬 App is in foreground, emitting push event for React tree...");
                DeviceEventEmitter.emit(FOREGROUND_PUSH_EVENT, rawData);
            }
        } catch {
            // parse failed — ignore
        }
        return;
    }
    if (error) {
        console.error("Background Task Error:", error);
        return;
    }

    try {
        // Checking whether is it a reply or mark_read identifier
        const payload = data as any;
        if (payload.actionIdentifier) {
            console.log("⚠️ Background Task woke up for Interaction (Reply). Ignoring...");
            return;
        }
        // 2. Parse the "Payload-First" Data
        console.log("Background message arrived");
        const rawData = JSON.parse(payload.data.body)

        // Ensure we have the "Ingredients"
        const { ciphertext, sender_id, channel_id, sender_name, created_at, message_id } = rawData;

        if (!ciphertext || !sender_id || !channel_id || !sender_name || !created_at || !message_id) {
            console.log("❌ Missing payload data. Cannot decrypt.");
            return;
        }

        console.log(`🔐 Decrypting background message from ${sender_name}...`);

        // 3. Decrypt Locally
        const decryptedText = await signal.decrypt(sender_id, ciphertext);

        if (!decryptedText) {
            console.error("❌ Decryption failed locally.");
            return;
        }

        // 4. Handle Media Pointers
        let displayText = decryptedText;
        let securePayload = undefined;

        // If the text is actually a JSON pointing to an image
        if (decryptedText.startsWith('{') && decryptedText.includes('"type":"image"')) {
            displayText = "📷 Photo";
            securePayload = decryptedText;
        }

        // 5. Update Local Stores
        const msg = {
            id: message_id,
            text: displayText,
            senderId: sender_id,
            senderName: sender_name,
            createdAt: created_at,
            isMe: false,
            status: 'sent' as const,
            securePayload,
            imageUri: null
        };

        // Update stores
        await chatStore.addMessage(channel_id, msg);


        // 6. Show the Notification
        await Notifications.scheduleNotificationAsync({
            identifier: channel_id, // Grouping Key
            content: {
                title: sender_name,
                body: displayText,
                data: { channelId: channel_id, messageId: msg.id, name: sender_name, senderId: sender_id, created_at: created_at }, // For navigation on tap
                categoryIdentifier: 'chat_message',
                sound: 'default',
            },
            trigger: null,
        });

        // 7. Mark as delivered via edge function
        const currentUserId = await AsyncStorage.getItem('current_user_id');
        if (currentUserId) {
            const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/update-message-status`;
            const token = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
            NativeTaskModule.markAsRead(url, token, {
                message_id: message_id,
                recipient_user_id: currentUserId,
                status: 'delivered',
                sender_id: sender_id,
                channel_id: channel_id
            });
        }

    } catch (err) {
        console.warn("Background Decryption Failed:", err);
    }
});

export const registerBackgroundNotificationTask = async () => {
    console.log("registerBackgroundNotificationTask");
    Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
};