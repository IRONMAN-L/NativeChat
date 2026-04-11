import { signal } from "@/native/signal";
import { channelListStore } from "@/store/channelListStore";
import { chatStore, LocalMessage } from "@/store/chatStore";
import { SupabaseClient } from "@supabase/supabase-js";
export const sendBackgroundTextMessage = async (
    supabase: SupabaseClient,
    channelId: string,
    myId: string,
    recipientUserId: string,
    text: string,
) => {

    try {
        const tempId = Date.now().toString();
        const createdAt = new Date().toISOString();

        // channel preview updation
        const channelDetails = await channelListStore.updateChannelPreview(supabase, channelId, { content: text, createdAt: createdAt, isRead: true })
        const myself = channelDetails.users?.find(user => user.id === myId);
        // fast ui render
        const optimisticMsg: LocalMessage = {
            id: tempId,
            text: text,
            senderId: myId,
            senderName: myself?.first_name || "",
            createdAt,
            isMe: true,
            status: 'sending',
            imageUri: null,
        };

        // message add
        await chatStore.addMessage(channelId, optimisticMsg);


        // encrypt and send
        const ciphertext = await signal.encrypt(recipientUserId, text);
        // backend push to supabase
        const { data: msgData, error: msgError } = await supabase.from('messages')
            .insert({
                user_id: myId,
                channel_id: channelId
            }).select('id, created_at').single();

        if (msgError) throw msgError;

        const { error: recipError } = await supabase.from('message_recipients')
            .insert({
                message_id: msgData.id,
                recipient_user_id: recipientUserId,
                recipient_device_id: 1,
                ciphertext: ciphertext,
                status: 'sent'
            })
        if (recipError) throw recipError;

        const finalMsg = {
            ...optimisticMsg,
            id: msgData.id,
            createdAt: msgData.created_at,
            status: 'sent' as const
        }
        // update status to sent
        await chatStore.updateMessage(channelId, tempId, finalMsg);

    } catch (error) {
        console.log(error);
    }
}

export const updateMessageStatusOnServer = async (
    messageId: string,
    recipientUserId: string,
    status: 'delivered' | 'read',
    senderId: string,
    channelId: string
) => {
    try {
        const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/update-message-status`;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message_id: messageId,
                recipient_user_id: recipientUserId,
                status,
                sender_id: senderId,
                channel_id: channelId
            }),
        });
    } catch (e) {
        console.warn(`Failed to mark message ${messageId} as ${status}:`, e);
    }
};