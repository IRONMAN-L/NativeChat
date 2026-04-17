import { LocalChannel } from '@/store/channelListStore';
import { useUser } from '@clerk/clerk-expo';
import { formatDistanceToNow } from 'date-fns';
import { router , useFocusEffect } from 'expo-router';
import { Image, Text, TouchableOpacity, View } from 'react-native';


import { userStore } from '@/store/userStore';
import { User as UserType } from '@/types/index';
import { useCallback, useState } from 'react';


type ChannelListItemProps = {
  channel: LocalChannel
}
export default function ChatListItem({ channel }: ChannelListItemProps) {
  const { user } = useUser();
  const [cachedUser, setCachedUser] = useState<UserType | null>(null);

  let otherUser = null;
  if (channel.type === 'direct') {
    otherUser = channel.users.find(u => u.id !== user?.id);
  }

  // Load latest updated user profile on focus
  useFocusEffect(
    useCallback(() => {
      if (otherUser?.id) {
        userStore.getUser(otherUser.id).then((u) => {
          if (u) setCachedUser(u);
        })
      }
    }, [otherUser?.id])
  );

  let channelName = channel.name || '';
  let channelAvatar = channel.avatar;

  if (channel.type === 'direct') {
    const targetUser = cachedUser || otherUser;
    channelName = targetUser?.full_name || targetUser?.first_name || 'Unknown';
    channelAvatar = targetUser?.avatar_url || null;
  }

  const lastMessageTime = channel.lastMessage?.createdAt
    ? formatDistanceToNow(new Date(channel.lastMessage.createdAt), { addSuffix: false })
    : '';

  const initials = channelName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const unreadCount = channel.lastMessage?.unreadCount || 0;
  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => {
        router.push({
          pathname: '/chat/[id]',
          params: { name: channelName, id: channel.id }
        });
      }}
      className="bg-white"
    >
      <View className="flex-row items-center px-4 py-3.5">
        {/* Avatar Section */}
        <View className="relative">
          {channelAvatar ? (
            <Image
              source={{ uri: channelAvatar }}
              className='w-14 h-14 rounded-full bg-gray-100 border border-gray-50'
            />
          ) : (
            <View className="bg-[#0e9864]/10 w-14 h-14 rounded-full items-center justify-center border border-[#0e9864]/20">
              <Text className="text-[#0e9864] font-bold text-lg">{initials}</Text>
            </View>
          )}
          {otherUser && (
            <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
          )}
        </View>

        {/* Content Section */}
        <View className="flex-1 ml-4 justify-center">
          <View className="flex-row justify-between items-center mb-1">
            <Text className={`${hasUnread ? 'font-bold' : 'font-medium'} text-[17px] text-gray-900 flex-1 mr-2`} numberOfLines={1}>
              {channelName}
            </Text>
            <Text className={`text-xs ${hasUnread ? 'text-[#0e9864] font-bold' : 'text-gray-400'}`}>
              {lastMessageTime.replace('about ', '')}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text
              className={`text-[14px] flex-1 mr-4 ${hasUnread ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}
              numberOfLines={1}
            >
              {channel.lastMessage?.isMe ? 'You: ' : ''}
              {channel.lastMessage?.content || "No messages yet"}
            </Text>

            {hasUnread && (
              <View className="bg-[#0e9864] min-w-[20px] h-5 px-1.5 rounded-full items-center justify-center">
                <Text className="text-white text-[11px] font-bold">{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View className="h-[0.5px] bg-gray-100 ml-[88px]" />
    </TouchableOpacity>
  );
}