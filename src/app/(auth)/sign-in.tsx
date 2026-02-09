import { useKeyboardLayoutStore } from '@/store/useKeyboardLayoutStore';
import { useSignIn } from '@clerk/clerk-expo';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TypeWriter from '../../components/TypeWriter';
export default function SignIn() {
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, signIn, setActive } = useSignIn();


  // layout key to force re-render on keyboard layout change
  const lastResumeAt = useKeyboardLayoutStore((state) => state.lastResumeAt);
  const onSignInPress = async () => {
    if (!isLoaded) return;
    console.log("Sign In pressed", emailAddress, password);

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId })
        router.replace('/');
      } else if (signInAttempt.status === 'needs_second_factor') {
        await signIn.prepareSecondFactor({
          strategy: 'email_code'
        });
        router.push('/SFA-mail');
      } else {
        console.log(JSON.stringify(signInAttempt, null, 2));
      }


    } catch (err: any) {
      console.log(JSON.stringify(err, null, 2));
      if (err.errors && err.errors[0].code === 'form_password_incorrect') {
        Alert.alert("Error", "Invalid credentials.");
      }
      else {
        Alert.alert("Error", (err as Error).message);
      }
    }
  }


  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>

      <KeyboardAwareScrollView
        key={lastResumeAt}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={9}
        className='flex-1'
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-8 w-full items-center gap-8">
          {/* Header Section*/}
          <View className="items-center gap-2">
            <View className='flex-row items-center'>
              <MaterialCommunityIcons name="nativescript" size={60} color="#0e9484" />
              <TypeWriter
                text="ativeChat"
                speed={100}
                textClass="text-4xl font-bold text-[#0e9484]"
                cursorClass="bg-[#2563eb]"
              />
            </View>
            <Text className="text-3xl font-bold text-[#0e9484]">
              Welcome Back!
            </Text>
            <Text className="text-gray-500 text-center px-4">
              Enter your details to connect with friends today.
            </Text>
          </View>

          {/* Form Section */}
          <View className="w-full gap-4">

            {/* EmailAddress Input */}
            <View>
              <Text className="text-gray-700 font-medium mb-1 ml-1">Email Address</Text>
              <TextInput
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder="hello@example.com"
                placeholderTextColor="#9ca3af" // Gray-400
                autoCapitalize="none"
                keyboardType="email-address"
                className="w-full bg-gray-100 border border-gray-200 rounded-2xl p-4 text-gray-800 text-base focus:border-[#0e9484]"
              />
            </View>

            {/* Password Input */}
            <View>
              <Text className="text-gray-700 font-medium mb-1 ml-1">Password</Text>
              <View className="flex-row items-center w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 h-14 focus:border-[#0e9484]">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  passwordRules="required: upper; required: lower; required: digit; required: special; minlength: 8;"
                  secureTextEntry={!showPassword}
                  className="flex-1 text-gray-800 text-base h-full"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={24} color="gray" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Button Section */}
          <View className="w-full gap-4 mt-4">
            <TouchableOpacity
              onPress={onSignInPress}
              activeOpacity={0.8}
              className="w-full bg-[#0e9484] p-4 rounded-full items-center shadow-sm"
            >
              {isLoaded ? <Text className="text-white font-bold text-lg">Sign In</Text> : <ActivityIndicator color="white" className="mr-2" />}

            </TouchableOpacity>

            {/* Footer / Login Link */}
            <View className="flex-row justify-center items-center gap-1">
              <Text className="text-gray-500">Don&apos;t have an account?</Text>
              <Link href="/sign-up" asChild>
                <TouchableOpacity>
                  <Text className="text-[#0e9484] font-bold">Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  )
}