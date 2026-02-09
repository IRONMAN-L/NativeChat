import { useAuth } from '@clerk/clerk-expo';
import { Button, Text, View } from 'react-native';
export default function Settings() {
  const { signOut } = useAuth(); // take userId or details of the user


  return (
    <View className='flex-1 justify-center items-center gap-4'>
      <Text className='text-2xl text-emerald-500'>settings</Text>

      <Button onPress={() => signOut()} title='Sign Out' />
    </View>
  )
}