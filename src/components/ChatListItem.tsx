import { LocalChannel } from '@/store/channelListStore';
import { useUser } from '@clerk/clerk-expo';
import { formatDistanceToNow } from 'date-fns';
import { router } from 'expo-router';
import { Image, Text, TouchableOpacity, View } from 'react-native';


type ChannelListItemProps = {
  channel: LocalChannel
}
export default function ChatListItem({ channel }: ChannelListItemProps) {

  const { user } = useUser();
  let channelName = channel.name || '';
  let channelAvatar = channel.avatar;
  let otherUser = null;
  if (channel.type === 'direct') {
    otherUser = channel.users.find(u => u.id !== user!.id);
    channelName = otherUser?.first_name || 'Unknown';
    channelAvatar = otherUser?.avatar_url || null;
  }


  return (
    <TouchableOpacity
      onPress={async () => {
        router.push({
          pathname: '/chat/[id]',
          params: { name: channelName, id: channel.id }
        })
      }}
    >
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