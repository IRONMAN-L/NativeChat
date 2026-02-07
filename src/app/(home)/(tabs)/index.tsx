import ChatListItem from '@/components/ChatListItem';
import { useSupabase } from '@/providers/SupabaseProvider';
import { handleNewMessage } from '@/services/messageHandler';
import { LocalChannel, channelListStore } from '@/store/channelListStore';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function index() {
  const insets = useSafeAreaInsets();
  const { supabase, isSupabaseReady } = useSupabase();
  const { user: myself } = useUser();
  const { getToken } = useAuth();
  const [channels, setChannels] = useState<LocalChannel[]>();

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [])
  );

  // 1. Initial Load from Local Storage
  const loadLocalData = async () => {
    const local = await channelListStore.loadChannels();
    setChannels(local);
  }

  // 2. Sync Missed Data (Background Fetch) handling offline gap
  const { isLoading } = useQuery({
    queryKey: ['channels'],
    enabled: isSupabaseReady && !!myself,
    queryFn: async () => {
      // Fetch channels that have updates
      const local = await channelListStore.loadChannels();
      const lastTimeStamp = local.length > 0 ? local[0].created_at : '1970-01-01';

      const { data } = await supabase
        .from('channel_users')
        .select('*, channels(*, users(*))')
        .eq('user_id', myself!.id)
        .gt('channels.created_at', lastTimeStamp)
        .throwOnError();

      if (!data) return [];

      const newChannels = data.map(m => m.channels);

      // Save new channels to local store
      for (const channel of newChannels) {
        await channelListStore.addChannel(channel);
      }

      // Refresh UI
      loadLocalData();
      return newChannels;
    }
  });

  // 3. ⚡ GLOBAL REALTIME LISTENER ⚡
  // This matches WhatsApp: It listens for ANY new message globally
  useEffect(() => {
    if (!myself || !isSupabaseReady) return;


    console.log("Listening for global updates...");

    let subscription: any;
    let retryTimeout: ReturnType<typeof setTimeout>;
    const setupSubscription = async () => {

      const token = await getToken();

      if (!token) {
        console.log("⏳ No auth token yet. Waiting...");
        retryTimeout = setTimeout(setupSubscription, 500);
        return;
      }

      // 🔒 2. CRITICAL FIX: Force Realtime to use this token
      // This tells the socket: "I am this user, let me see my data!"
      supabase.realtime.setAuth(token);

      subscription = supabase
        .channel('global_user_updates')
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

            // DELEGATE TO HANDLER
            await handleNewMessage(payload, supabase);

            // Once the handler saves it to AsyncStorage, we just reload the list
            loadLocalData();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Socket is connected. Listening to the changes...')
          } else if (status === 'CHANNEL_ERROR') {
            console.log('Connection failed retrying after 3 secs')
            supabase.removeChannel(subscription);
            retryTimeout = setTimeout(() => setupSubscription(), 3000)
          }
        });
    }

    setupSubscription();
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [isSupabaseReady, myself]);

  if (isLoading && (!channels || channels.length === 0)) return <ActivityIndicator />

  return (
    <View className='flex-1 justify-center'>
      <FlatList
        data={channels}
        className="bg-white"
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        renderItem={({ item }) => <ChatListItem channel={item} />}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior='automatic'
      />

      <View
        style={{
          position: 'absolute',
          bottom: 100,
          right: 15,
          backgroundColor: '#0e9864',
          borderRadius: '100%',
          padding: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.push('/new/NewChat')}>
          <MaterialCommunityIcons name="message-plus" color={"white"} size={27} />
        </TouchableOpacity>
      </View>
    </View>
  )
}