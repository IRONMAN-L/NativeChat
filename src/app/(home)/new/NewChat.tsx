import UserList from '@/components/UserList';
import { useSupabase } from '@/providers/SupabaseProvider';
import { User } from '@/types';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
// TODO: Check if a direct channel with that clicked user already exists
export default function NewChat() {
  const { supabase } = useSupabase();
  const { user: myself } = useUser();
  const queryClient = useQueryClient();

  const createChannel = useMutation({
    mutationFn: async (clickedUser: User) => {
      // check if channel exist
      const { data: myChannels, error: myChannelsError } = await supabase
        .from('channel_users')
        .select('channel_id, channels!inner(type)') // Join to filter by type
        .eq('user_id', myself!.id)
        .eq('channels.type', 'direct');

      if (myChannelsError) throw myChannelsError;

      const myChannelIds = myChannels.map(c => c.channel_id);

      // 2. Check if the 'clickedUser' is inside any of MY channels
      if (myChannelIds.length > 0) {
        const { data: existingChannel } = await supabase
          .from('channel_users')
          .select('channel_id')
          .eq('user_id', clickedUser.id)
          .in('channel_id', myChannelIds) // Must be one of MY channels
          .maybeSingle(); // Returns null if not found (doesn't throw)

        // Found existing chat! Return it.
        if (existingChannel) {
          console.log("Found existing chat:", existingChannel.channel_id);
          return { channelId: existingChannel.channel_id, name: clickedUser.first_name };
        }
      }

      // create a channel
      const { data: channel } = await supabase.from('channels').insert({ type: 'direct' }).throwOnError().select('*').single();

      if (!channel) {
        throw new Error('Channel is null');
      }

      // Add user to the channel
      // Add myself to the channel
      await supabase.from('channel_users').insert([
        { channel_id: channel.id, user_id: clickedUser.id },
        { channel_id: channel.id, user_id: myself!.id }
      ]);


      return { channelId: channel.id, name: clickedUser.first_name };
    },
    // redirect if everthing success
    onSuccess(newChannel) {
      // to refetch updates results for the key 
      queryClient.invalidateQueries({
        queryKey: ['channels']
      });

      router.replace({
        pathname: '/chat/[id]',
        params: {
          id: newChannel.channelId,
          name: newChannel.name
        }
      });
    },
    onError(error) {
      console.log(error);
    }
  });
  const handleUserPress = async (user: User) => {
    console.log('User Clicked: ', user.first_name);


    createChannel.mutate(user);

  }


  return (
    <View className='bg-white flex-1'>
      <UserList onPress={handleUserPress} />
      {createChannel.isPending && (
        <View className="absolute inset-0 bg-white/60 justify-center items-center z-50">
          <ActivityIndicator size="large" color="#0e9484" />
        </View>
      )}
    </View>
  )
}