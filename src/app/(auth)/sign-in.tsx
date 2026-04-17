import { useKeyboardLayoutStore } from '@/store/useKeyboardLayoutStore';
import { useSignIn } from '@clerk/clerk-expo';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
  const [buttonClicked, setButtonClicked] = useState<boolean>(false);
  const lastResumeAt = useKeyboardLayoutStore((state) => state.lastResumeAt);

  const onSignInPress = async () => {
    if (!isLoaded) return;
    setButtonClicked(true);
    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId })
        setButtonClicked(false);
        router.replace('/');
      } else if (signInAttempt.status === 'needs_second_factor') {
        await signIn.prepareSecondFactor({ strategy: 'email_code' });
        setButtonClicked(false);
        router.push('/SFA-mail');
      }
    } catch (err: any) {
      if (err.errors && err.errors[0].code === 'form_password_incorrect') {
        Alert.alert("Error", "Invalid credentials.");
      } else {
        Alert.alert("Error", (err as Error).message);
      }
      setButtonClicked(false);
    }
  }

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <KeyboardAwareScrollView
        key={lastResumeAt}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        className='flex-1'
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-8 w-full items-center gap-10">

          {/* Header Section */}
          <View className="items-center gap-3 mt-10">
            <View className='flex-row items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100'>
              <MaterialCommunityIcons name="nativescript" size={48} color="#0e9484" />
              <TypeWriter
                text="ativeChat"
                speed={100}
                textClass="text-3xl font-extrabold text-slate-800 tracking-tight"
                cursorClass="bg-[#0e9484]"
              />
            </View>
            <Text className="text-3xl font-bold text-slate-800 mt-4">
              Welcome Back
            </Text>
            <Text className="text-slate-500 text-center px-6 leading-6 text-base">
              Sign in to continue connecting with your friends seamlessly.
            </Text>
          </View>

          {/* Form Section */}
          <View className="w-full gap-5">
            <View>
              <Text className="text-slate-700 font-semibold mb-2 ml-1 text-sm">Email Address</Text>
              <View className="flex-row items-center w-full bg-white border border-slate-200 rounded-[20px] px-4 h-[60px] focus:border-[#0e9484] shadow-sm">
                <Feather name="mail" size={20} color="#94a3b8" className="mr-3" />
                <TextInput
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  placeholder="hello@example.com"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="flex-1 text-slate-800 text-base h-full"
                />
              </View>
            </View>

            <View>
              <Text className="text-slate-700 font-semibold mb-2 ml-1 text-sm">Password</Text>
              <View className="flex-row items-center w-full bg-white border border-slate-200 rounded-[20px] px-4 h-[60px] focus:border-[#0e9484] shadow-sm">
                <Feather name="lock" size={20} color="#94a3b8" className="mr-3" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  className="flex-1 text-slate-800 text-base h-full"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="pl-2">
                  <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity className="items-end mt-[-8px]">
              <Text className="text-[#0e9484] font-medium text-sm">Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Button Section */}
          <View className="w-full gap-6 mt-2 mb-10">
            <TouchableOpacity
              disabled={buttonClicked}
              onPress={onSignInPress}
              activeOpacity={0.8}
              className={buttonClicked ? "w-full bg-[#0e9484]/50 h-[60px] rounded-[20px] items-center justify-center shadow-lg shadow-[#0e9484]/30" : "w-full bg-[#0e9484] h-[60px] rounded-[20px] items-center justify-center shadow-lg shadow-[#0e9484]/30"}
            >
              {buttonClicked ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg tracking-wide">Sign In</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row justify-center items-center gap-2">
              <Text className="text-slate-500 text-base">Don&apos;t have an account?</Text>
              <Link href="/sign-up" asChild>
                <TouchableOpacity>
                  <Text className="text-[#0e9484] font-bold text-base">Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

        </View>
      </KeyboardAwareScrollView>
    </View>
  )
}