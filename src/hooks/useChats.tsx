import { useSupabase } from '@/providers/SupabaseProvider';
import { FOREGROUND_PUSH_EVENT } from '@/services/backgroundNotificationTask';
import { handleNewMessage } from '@/services/messageHandler';
import { channelListStore, LocalChannel } from '@/store/channelListStore';
import { chatStore, LocalMessage } from '@/store/chatStore';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';

type MessageListener = (channelId: string, message: LocalMessage) => void;
type StatusListener = (messageId: string, status: string) => void;

type ChatsContextType = {
    chats: LocalChannel[];
    isLoading: boolean;
    loadLocalData: () => Promise<LocalChannel[]>;
    addMessageListener: (id: string, listener: MessageListener) => () => void;
    addStatusListener: (id: string, listener: StatusListener) => () => void;
};

const ChatsContext = createContext<ChatsContextType | null>(null);

export function ChatsProvider({ children }: PropsWithChildren) {
    const { user: myself } = useUser();
    const { getToken } = useAuth();
    const [chats, setChats] = useState<LocalChannel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { supabase, isSupabaseReady } = useSupabase();

    const getTokenRef = useRef(getToken);
    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    const messageListenersRef = useRef<Map<string, MessageListener>>(new Map());
    const statusListenersRef = useRef<Map<string, StatusListener>>(new Map());

    // Load channels from local storage
    const loadLocalData = useCallback(async () => {
        const local = await channelListStore.loadChannels();
        setChats(local);
        return local;
    }, []);

    const addMessageListener = useCallback((id: string, listener: MessageListener) => {
        messageListenersRef.current.set(id, listener);
        return () => {
            messageListenersRef.current.delete(id);
        };
    }, []);

    const addStatusListener = useCallback((id: string, listener: StatusListener) => {
        statusListenersRef.current.set(id, listener);
        return () => {
            statusListenersRef.current.delete(id);
        };
    }, []);

    // Reload local data when app comes back to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                console.log("App came to foreground, reloading chats...");
                loadLocalData();
            }
        });
        return () => subscription.remove();
    }, [loadLocalData]);

    // Sync: load local first, then fetch any new channels from server
    useEffect(() => {
        if (!isSupabaseReady || !myself) return;

        const sync = async () => {
            setIsLoading(true);
            try {
                const localChats = await loadLocalData();

                const lastTimeStamp = localChats.length > 0 ? localChats[0].created_at : '1970-01-01';

                const { data } = await supabase
                    .from('channel_users')
                    .select('*, channels(*, users(*))')
                    .eq('user_id', myself.id)
                    .gt('channels.created_at', lastTimeStamp)
                    .throwOnError();
                if (data && data.length > 0) {
                    const newChannels = data.map(m => m.channels);
                    const prom = [];
                    for (const channel of newChannels) {
                        if (channel && channel.id) {
                            prom.push(channelListStore.addChannel(channel));
                        }
                    }
                    await Promise.all(prom);
                    await loadLocalData();
                }
            } catch (error) {
                console.error('useChats sync error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        sync();
    }, [isSupabaseReady, myself, supabase, loadLocalData]);

    // Single global realtime listener for incoming messages + status updates
    useEffect(() => {
        if (!myself || !isSupabaseReady) return;

        console.log("Setting up global realtime listener...");

        let subscription: any;
        let retryTimeout: ReturnType<typeof setTimeout>;
        let isMounted = true;

        const setupSubscription = async () => {
            const token = await getTokenRef.current();

            if (!isMounted) return;

            if (!token) {
                console.log("No auth token yet. Waiting...");
                retryTimeout = setTimeout(setupSubscription, 500);
                return;
            }

            supabase.realtime.setAuth(token);

            const channelName = `user_updates:${myself.id}`;
            const existingChannel = supabase.getChannels().find((c: any) => c.topic === channelName);
            if (existingChannel) {
                await supabase.removeChannel(existingChannel);
            }

            subscription = supabase
                .channel(channelName)
                // 1. INSERT: new messages sent TO me
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'message_recipients',
                        filter: `recipient_user_id=eq.${myself.id}`
                    },
                    async (payload) => {
                        console.log("New Message Packet Received!");

                        const result = await handleNewMessage(payload, supabase);

                        // Reload channel list (updates preview + ordering)
                        await loadLocalData();
                        if (result) {
                            const { message, channelId } = result;
                            const listener = messageListenersRef.current.get(`chat:${channelId}`);
                            if (listener) {
                                listener(message.senderId, message);
                            }
                        }
                    }
                )
                // 2. NATIVE POSTGRES: listen for read/delivered updates on messages I sent
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'message_recipients', filter: `sender_id=eq.${myself.id}` },
                    async (payload) => {
                        const newRow = payload.new;
                        const message_id = newRow.message_id;
                        const status = newRow.status;
                        const channel_id = newRow.channel_id;

                        if(!message_id || !status || !channel_id) return;

                        console.log(`Native Postgres update received: message ${message_id} → ${status}`);

                        // Always update local store immediately even if chat is not open
                        await chatStore.updateMessageStatus(channel_id, message_id, status);

                        const listener = statusListenersRef.current.get(`status:${channel_id}`);
                        if (listener) {
                            listener(message_id, status);
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Socket is connected. Listening to the changes...')
                    } else if (status === 'CHANNEL_ERROR') {
                        console.log('Connection failed retrying after 3 secs')
                        supabase.removeChannel(subscription);
                        retryTimeout = setTimeout(() => setupSubscription(), 3000);
                    }
                });
        };

        setupSubscription();

        return () => {
            isMounted = false;
            if (retryTimeout) clearTimeout(retryTimeout);
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [isSupabaseReady, myself, supabase, loadLocalData]);

    // Foreground push fallback:
    // When app is active, the background task can't process messages (no supabase client).
    // Instead it emits a DeviceEventEmitter event with the push data.
    // We listen here and route through handleNewMessage (dedup prevents double-processing
    // if the realtime WebSocket also fires).
    useEffect(() => {
        if (!myself || !isSupabaseReady) return;

        const sub = DeviceEventEmitter.addListener(FOREGROUND_PUSH_EVENT, async (pushData) => {
            const { ciphertext, message_id, sender_id, channel_id, sender_name, created_at } = pushData;
            if (!ciphertext || !message_id || !sender_id || !channel_id || !sender_name || !created_at) return;

            // Small delay to let the realtime WebSocket fire first (it's the primary path)
            await new Promise(res => setTimeout(res, 1500));

            console.log("📬 Foreground push fallback: processing...");
            const shapedPayload = { new: { message_id, ciphertext, user_id: sender_id, channel_id, created_at } };
            const result = await handleNewMessage(shapedPayload, supabase, sender_name, true);

            if (result) {
                await loadLocalData();
                const { message, channelId } = result;
                const listener = messageListenersRef.current.get(`chat:${channelId}`);
                if (listener) {
                    listener(message.senderId, message);
                }
            }
        });

        return () => sub.remove();
    }, [isSupabaseReady, myself, supabase, loadLocalData]);

    return (
        <ChatsContext.Provider value={{ chats, isLoading, loadLocalData, addMessageListener, addStatusListener }}>
            {children}
        </ChatsContext.Provider>
    );
}

export function useChats() {
    const ctx = useContext(ChatsContext);
    if (!ctx) throw new Error('useChats must be used within a ChatsProvider');
    return ctx;
}