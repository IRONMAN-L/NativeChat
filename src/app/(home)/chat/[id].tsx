import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { useState, useRef } from 'react';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';
import { useGradualAnimation } from '@/components/GradualAnimation';
import { ActivityIndicator, FlatList, View, Text} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/providers/SupabaseProvider';
type ChatScreenParams = {
  id: string;
  name?: string;
}
export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<ChatScreenParams>();
  const { height } = useGradualAnimation();
  const [inputHeight, setInputHeight] = useState(56);

  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const { supabase, isReady} = useSupabase();
  // Channels
  const { data: channel, error, isPending } = useQuery({
    queryKey: ['channels', id],
    queryFn: async () => {
      const { data } = await supabase.from('channels').select('*, users(*)').eq('id', id).throwOnError().single();
      return data;
    },
    enabled:isReady,
  });

  if (isPending) {
    return <ActivityIndicator />;
  }
  console.log(JSON.stringify(channel, null, 2));
  if (error || !channel) {
    return (
      <View className='flex-1 justify-center'>
        <Text className='text-red-600 text-xl'>Channel not found</Text>
      </View>
    )
  }
  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          <MessageList inputHeight={inputHeight}
            listRef={listRef}
            keyboardHeight={height}
            bottomInset={bottomInset}
          />
          <MessageInput
            setInputHeight={setInputHeight}
            keyboardHeight={height}
            bottomInset={bottomInset}
            onSend={() => {
              listRef.current?.scrollToOffset({
                offset: 0,
                animated: true,
              })
            }}
          />
      </SafeAreaView>
    </>
  )
}