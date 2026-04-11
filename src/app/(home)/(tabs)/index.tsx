import ChatListItem from '@/components/ChatListItem';
import { useChats } from '@/hooks/useChats';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Index() {
  const insets = useSafeAreaInsets();
  const { chats, isLoading, loadLocalData } = useChats();

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [loadLocalData])
  );

  if (isLoading && (!chats || chats.length === 0)) return <ActivityIndicator />

  return (
    <View className='flex-1 justify-center'>
      <FlatList
        data={chats}
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