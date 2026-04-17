import ChatListItem from '@/components/ChatListItem';
import { useChats } from '@/hooks/useChats';
import { useSupabase } from '@/providers/SupabaseProvider';
import { channelListStore } from '@/store/channelListStore';
import { userStore } from '@/store/userStore';
import { useUser } from '@clerk/clerk-expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Index() {
  const insets = useSafeAreaInsets();
  const { chats, isLoading, loadLocalData } = useChats();

  const { supabase, isSupabaseReady } = useSupabase();
  const { user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLocalData();

      async function syncUserProfiles() {
        if (!isSupabaseReady || !user?.id || isSyncing) return;
        setIsSyncing(true);
        try {
          const currentChats = await channelListStore.loadChannels();
          if (currentChats.length === 0) return;

          // Find all unique user IDs other than myself
          const otherUserIds = Array.from(new Set(
            currentChats.flatMap(c =>
              c.type === 'direct' ? c.users.filter(u => u.id !== user.id).map(u => u.id) : []
            )
          ));

          if (otherUserIds.length > 0) {
            const { data } = await supabase.from('users').select('*').in('id', otherUserIds);
            if (data && data.length > 0) {
              let updated = false;
              for (const u of data) {
                // simple diff could be done, but saveUser overwrites with fresh
                await userStore.saveUser(u);
                updated = true;
              }
              // reload local channels to force ChatListItem re-renders if we want,
              // but ChatListItem will also run useFocusEffect to pull from userStore.
            }
          }
        } finally {
          setIsSyncing(false);
        }
      }

      syncUserProfiles();
    }, [loadLocalData, isSupabaseReady, user?.id])
  );

  if (isLoading && (!chats || chats.length === 0)) return <ActivityIndicator />

  return (
    <View className='flex-1 bg-white'>
      <FlatList
        data={chats}
        className="bg-white"
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        ListHeaderComponent={
          <View className='px-4 pt-6 pb-6'>
            <TouchableOpacity
              onPress={() => router.push('/nearby/NearbyConnect')}
              activeOpacity={0.7}
              className="bg-[#0e9864]/10 border border-[#0e9864]/20 rounded-[24px] px-8 py-8 flex-row items-center justify-between"
              style={{
                shadowColor: '#0e9864',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 3
              }}
            >
              <View className="flex-row items-center">
                <View className="bg-[#0e9864] w-3 h-3 rounded-full mr-4" />
                <View>
                  <Text className="text-[#0e9864] font-extrabold text-base">Nearby Discovery</Text>
                  <Text className="text-[#0e9864]/70 text-xs font-semibold mt-0.5">Chat offline with people around you</Text>
                </View>
              </View>
              <View className="bg-[#0e9864] p-2 rounded-full">
                <MaterialCommunityIcons name="broadcast" size={20} color="white" />
              </View>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => <ChatListItem channel={item} />}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior='automatic'
      />

      <View
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          backgroundColor: '#0e9864',
          borderRadius: 30,
          width: 56,
          height: 56,
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
      >
        <TouchableOpacity onPress={() => router.push('/new/NewChat')}>
          <MaterialCommunityIcons name="message-plus" color={"white"} size={26} />
        </TouchableOpacity>
      </View>
    </View>
  )
}