import { useSignIn } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
export default function VerifyMail() {
  const [code, setCode] = useState<string>('');
  const { signIn, isLoaded, setActive } = useSignIn();
  const [buttonClicked, setButtonClicked] = useState<boolean>(false);
  const onVerifyPress = async () => {
    if (!isLoaded) return;
    setButtonClicked(true);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code,
      });

      if (result?.status === 'complete') {
        setButtonClicked(false);
        await setActive({ session: result.createdSessionId })
        router.replace('/');
      }
    } catch {
      Alert.alert("Incorrect code", "Please enter correct code");
      setButtonClicked(false);
    }
  }

  return (
    <View className="p-4 gap-4 bg-white flex-1 justify-center items-center">
      <Text className="text-3xl font-bold text-[#0e9484]">
        Verify your Email
      </Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="eg.12344"
        placeholderTextColor="#9ca3af" // Gray-400
        keyboardType='phone-pad'
        className="w-full bg-gray-100 border border-gray-200 rounded-2xl p-4 text-gray-800 text-base focus:border-[#0e9484]"
      />
      <TouchableOpacity
        onPress={onVerifyPress}
        disabled={buttonClicked || !isLoaded || code.length === 0}
        activeOpacity={0.8}
        className="w-full bg-[#0e9484] p-4 rounded-full items-center shadow-sm"
      >
        {buttonClicked ? <ActivityIndicator color="white" className="mr-2" /> : <Text className="text-white font-bold text-lg">Verify</Text>}
      </TouchableOpacity>
    </View>
  )
}