import { ChannelWithUsers } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SupabaseClient } from "@supabase/supabase-js";
export type LocalChannel = ChannelWithUsers & {
    lastMessage?: { content: string; createdAt: string; isRead: boolean; }
}

const storageKey = 'channels';

export const channelListStore = {
    async loadChannels(): Promise<LocalChannel[]> {
        const chats = await AsyncStorage.getItem(storageKey);
        const parsed = chats ? JSON.parse(chats) : [];
        return this.sortChannels(parsed);
    },

    sortChannels(channels: LocalChannel[]) {
        return channels.sort((a, b) => {
            const timeA = a.lastMessage?.createdAt || a.created_at;
            const timeB = b.lastMessage?.createdAt || b.created_at;
            return new Date(timeB).getTime() - new Date(timeA).getTime();
        });
    },

    async addChannel(channel: LocalChannel) {
        const currentChannels = await this.loadChannels();

        // Avoid duplicates
        if (currentChannels.find(ch => ch.id === channel.id)) return;

        const updated = [channel, ...currentChannels];
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
    },

    async updateChannel(channel: LocalChannel) {
        const currentChannels = await this.loadChannels();
        const filtered = currentChannels.filter(ch => ch.id !== channel.id);
        const updated = this.sortChannels([channel, ...filtered]);
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
    },

    // NEW: Helper to update just the preview from a new message
    async updateChannelPreview(supabase: SupabaseClient, channelId: string, preview: { content: string, createdAt: string, isRead: boolean }): Promise<LocalChannel> {
        const channels = await this.loadChannels();
        const target = channels.find(ch => ch.id === channelId);

        if (target) {
            const updatedChannel = {
                ...target,
                lastMessage: preview.content ? preview : { ...target.lastMessage!, isRead: true } // handling mark as read status
            };
            await this.updateChannel(updatedChannel);
            return updatedChannel;
        } else { // message received from a new channel
            const { data, error } = await supabase.from('channel_users')
                .select('*, channels(*, user(*))')
                .eq('channel_id', channelId)
                .single();
            if (!data || error) return {} as LocalChannel;

            const newChannel = {
                ...data,
                lastMessage: preview
            }
            await this.addChannel(newChannel);
            return newChannel;
        }

    },

}