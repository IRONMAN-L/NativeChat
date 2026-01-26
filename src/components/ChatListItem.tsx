import { View, Text, Image, TouchableOpacity, } from 'react-native'
import { router } from 'expo-router';
import { ChannelWithUsers } from '@/types'
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '@clerk/clerk-expo';

type ChannelListItemProps = {
  channel: ChannelWithUsers
}
export default function ChatListItem({ channel }: ChannelListItemProps) {
  const { user } = useUser();
  let channelName = channel.name || '';
  let channelAvatar = channel.avatar;
  if (channel.type === 'direct') {
    const otherUser = channel.users.find(u => u.id !== user!.id);
    channelName = otherUser?.full_name || 'Unknown';
    channelAvatar = otherUser?.avatar_url || null;
  }
  return (
    <TouchableOpacity
      onPress={() => {
        router.push({
          pathname: `/chat/${channel.id}`,
          params: { name: channelName }
        })
      }}>
      <View className="flex-row gap-4 p-4 border-b border-gray-200">
        {channelAvatar ? (
          <Image source={{ uri: channelAvatar }} className='w-12 h-12 rounded-full bg-neutral-200' />
        ) :
          (
            <View className="bg-purple-200 w-12 h-12 rounded-full items-center justify-center">
              <Text className="text-white font-semibold text-2xl" >{channelName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        <View className='flex-1'>
          <Text className='font-bold text-lg text-neutral-700' numberOfLines={1}>{channelName}</Text>
          <Text className='text-sm text-gray-500' numberOfLines={1}>{channel.lastMessage?.content || "No messages yet"}</Text>
        </View>
        {channel.lastMessage ? <Text className='text-xs text-neutral-500'>{formatDistanceToNow(new Date(channel.lastMessage.createdAt), { addSuffix: true, })}</Text> : null}
      </View>
    </TouchableOpacity>
  )
}