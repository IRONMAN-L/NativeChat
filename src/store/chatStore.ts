import { AsyncMutex } from '@/utils/AsyncMutex';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

export type LocalMessage = {
    id: string; // UUID
    text: string;
    imageUri: string | null;
    securePayload?: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    isMe: boolean;
    status: 'sending' | 'sent' | 'delivered' | 'read';
    messageType?: MessageType;   // defaults to 'text' for backward compat
    fileName?: string;           // original file name for docs/audio
    fileUri?: string;            // local decrypted file path
};

const getStorageKey = (channelId: string) => `chat_messages_${channelId}`;
const mutex = new AsyncMutex();

export const chatStore = {
    // Load messages from disk (FAST)
    async loadMessages(channelId: string): Promise<LocalMessage[]> {
        const json = await AsyncStorage.getItem(getStorageKey(channelId));
        return json ? JSON.parse(json) : [];
    },

    // Save a new message (Append)
    async addMessage(channelId: string, msg: LocalMessage) {
        return await mutex.dispatch(async () => {
            const current = await this.loadMessages(channelId);

            // Avoid duplicates
            if (current.find(m => m.id === msg.id)) return current;

            const updated = [...current, msg];
            await AsyncStorage.setItem(getStorageKey(channelId), JSON.stringify(updated));
            return updated;
        });
    },

    // Update status (e.g., sending -> sent)
    async updateMessage(channelId: string, msgId: string, msg: LocalMessage) {
        return await mutex.dispatch(async () => {
            const current = await this.loadMessages(channelId);
            const updated = current.map(m => m.id === msgId ? { ...msg } : m);
            await AsyncStorage.setItem(getStorageKey(channelId), JSON.stringify(updated));
            return updated;
        });
    },

    // Update just the status of a message (for tick marks: sent → delivered → read)
    async updateMessageStatus(channelId: string, msgId: string, status: LocalMessage['status']) {
        return await mutex.dispatch(async () => {
            const current = await this.loadMessages(channelId);
            const updated = current.map(m =>
                m.id === msgId ? { ...m, status } : m
            );
            await AsyncStorage.setItem(getStorageKey(channelId), JSON.stringify(updated));
            return updated;
        });
    }
};