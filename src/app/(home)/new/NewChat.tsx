import { View } from 'react-native'
import { router } from 'expo-router'
import UserList from '@/components/UserList'
import { User } from '@/types'
import { useSupabase } from '@/providers/SupabaseProvider';
import { useUser } from '@clerk/clerk-expo';
import { useMutation } from '@tanstack/react-query';

// TODO: Check if a direct channel with that clicked user already exists
export default function NewChat() {
  const { supabase } = useSupabase();
  const { user: myself } = useUser();

  const createChannel = useMutation({
    mutationFn: async (clickedUser: User) => {
      // create a channel
      const { data: channel } = await supabase.from('channels').insert({ type: 'direct' }).throwOnError().select('*').single();
      console.log(channel);
      if (!channel) {
        throw new Error('Channel is null');
      }

      // Add user to the channel
      await supabase.from('channel_users').insert({channel_id: channel.id, user_id: clickedUser.id}).throwOnError();

      // Add myself to the channel
      await supabase.from('channel_users').insert({channel_id: channel.id, user_id: myself!.id}).throwOnError();
      return channel;
    },
    // redirect if everthing success
    onSuccess(newChannel) {
      router.push(`/chat/${newChannel.id}`);
    },
  });
  const handleUserPress = async (user: User) => {
    console.log('User Clicked: ', user.first_name);


    createChannel.mutate(user);
    
  }
  return (
    <View className='bg-white flex-1'>
      <UserList onPress={handleUserPress} />
    </View>
  )
}