import ChatListItem from '@/components/ChatListItem';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useUser } from '@clerk/clerk-expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function index() {
  const insets = useSafeAreaInsets();
  const { supabase, isSupabaseReady } = useSupabase();
  const { user } = useUser();

  // TODO: Pagination
  // TODO: Pull down to reload
  // TODO: Sort by recent first
  // querying channels
  const { data: channels, error, isLoading } = useQuery({
    queryKey: ['channels'],
    enabled: isSupabaseReady,
    queryFn: async () => {
      const { data } = await supabase
        .from('channel_users')
        .select('*, channels(*, users(*))')
        .eq('user_id', user!.id)
        .throwOnError();

      const channels = data.map(m => m.channels)
      return channels;
    }
  });

  if (isLoading) return <ActivityIndicator />
  if (error) {
    return <Text>{error.message}</Text>;
  }
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