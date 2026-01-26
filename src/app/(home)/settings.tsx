import { Alert, Button, Text, View } from 'react-native';

import { signal } from '@/native/signal';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useAuth } from '@clerk/clerk-expo';
export default function Settings() {
  const { signOut, userId } = useAuth();
  const { supabase } = useSupabase();

  const testHandShake = async () => {
    if (!userId) return;

    const success = await signal.establishSession(userId, supabase);
    if (success) {
      Alert.alert('Success", "Signal Session Established!');
    } else {
      Alert.alert("❌ Failed", "Check console logs for details.");
    }

  }
  return (
    <View className='flex-1 justify-center items-center gap-4'>
      <Text className='text-2xl text-emerald-500'>settings</Text>

      <Button onPress={() => signOut()} title='Sign Out' />
      <Button onPress={testHandShake} title="Test Handshake" />
    </View>
  )
}