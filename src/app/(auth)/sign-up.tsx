import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useState } from 'react'
import { Link } from 'expo-router';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignUp } from '@clerk/clerk-expo';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useKeyboardLayoutStore } from '@/store/useKeyboardLayoutStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TypeWriter from '../../components/TypeWriter';

export default function SignUp() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [pendingVerification, setPendingVerification] = useState<boolean>(false);
  const [isSigningUp, setIsSigningUp] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const lastResumeAt = useKeyboardLayoutStore((state) => state.lastResumeAt);
  const insets = useSafeAreaInsets();
  const { isLoaded, signUp, setActive } = useSignUp();

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setIsSigningUp(true);
    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      })

      setPendingVerification(true);
    } catch (err: any) {
      if (err.errors && err.errors[0].code === 'form_identifier_exists') {
        Alert.alert("Error", "This email is already taken. Please sign in instead.");
      } else {
        Alert.alert("Error", err.errors[0].message || "Something went wrong");
      }
    } finally {
      setIsSigningUp(false);
    }
  }

  const onVerifyPress = async () => {
    if (!isLoaded) return;
    setIsVerifying(true);
    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({ code });

      if (signUpAttempt.status === 'complete') {
        // Mark as new user for profile setup routing
        await AsyncStorage.setItem('is_new_user', 'true');
        await setActive({ session: signUpAttempt.createdSessionId });
        setPendingVerification(false);
      } else {
        Alert.alert("Verification Incomplete", "Please try again.");
      }
    } catch (err: any) {
      if (err.errors && err.errors[0].code === 'form_identifier_exists') {
        Alert.alert("Error", "This email is already taken. Please sign in instead.");
      } else {
        Alert.alert("Error", err.errors[0].message || "Something went wrong");
      }
    } finally {
      setIsVerifying(false);
    }
  }

  if (pendingVerification) {
    return (
      <View className="flex-1 bg-[#f8fafc] justify-center items-center px-8" style={{ paddingTop: insets.top }}>
        <View className="w-full bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 items-center">
          <Feather name="mail" size={48} color="#0e9484" className="mb-4" />
          <Text className="text-2xl font-extrabold text-slate-800 mb-2">
            Verify Email
          </Text>
          <Text className="text-slate-500 text-center mb-8">
            We{"'"}ve sent a verification code to your email. Please enter it below.
          </Text>
          
          <View className="w-full mb-6 relative">
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="e.g. 123456"
              placeholderTextColor="#94a3b8"
              keyboardType='number-pad'
              className="w-full bg-slate-50 border border-slate-200 rounded-[20px] px-6 h-[60px] text-slate-800 text-lg tracking-widest text-center focus:border-[#0e9484] shadow-sm"
            />
          </View>

          <TouchableOpacity
            onPress={onVerifyPress}
            disabled={isVerifying || !isLoaded || code.length === 0}
            activeOpacity={0.8}
            className={isVerifying ? "w-full bg-[#0e9484]/50 h-[60px] flex-row rounded-[20px] items-center justify-center shadow-lg shadow-[#0e9484]/30" : "w-full bg-[#0e9484] h-[60px] flex-row rounded-[20px] items-center justify-center shadow-lg shadow-[#0e9484]/30"}
          >
            {isVerifying ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg tracking-wide">{!isLoaded ? "Loading..." : "Verify Account"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <KeyboardAwareScrollView
        key={lastResumeAt}
        enableOnAndroid={true}
        extraScrollHeight={20}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
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
              Create Account
            </Text>
            <Text className="text-slate-500 text-center px-6 leading-6 text-base">
              Join NativeChat today and start connecting with friends.
            </Text>
          </View>

          {/* Form Section */}
          <View className="w-full gap-5">
            <View>
              <Text className="text-slate-700 font-semibold mb-2 ml-1 text-sm">Email Address</Text>
              <View className="flex-row items-center w-full bg-white border border-slate-200 rounded-[20px] px-4 h-[60px] focus:border-[#0e9484] shadow-sm">
                <Feather name="mail" size={20} color="#94a3b8" className="mr-3" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
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
                  placeholder="Create a strong password"
                  placeholderTextColor="#94a3b8"
                  passwordRules="required: upper; required: lower; required: digit; required: special; minlength: 8;"
                  secureTextEntry={!showPassword}
                  className="flex-1 text-slate-800 text-base h-full"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="pl-2">
                  <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Button Section */}
          <View className="w-full gap-6 mt-2 mb-10">
            <TouchableOpacity
              onPress={onSignUpPress}
              disabled={isSigningUp || !isLoaded}
              activeOpacity={0.8}
              className={isSigningUp ? "w-full bg-[#0e9484]/50 h-[60px] rounded-[20px] items-center justify-center shadow-lg shadow-[#0e9484]/30" : "w-full bg-[#0e9484] h-[60px] rounded-[20px] items-center justify-center shadow-lg shadow-[#0e9484]/30"}
            >
              {isSigningUp ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg tracking-wide">{!isLoaded ? "Loading..." : "Sign Up"}</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row justify-center items-center gap-2">
              <Text className="text-slate-500 text-base">Already have an account?</Text>
              <Link href="/sign-in" asChild>
                <TouchableOpacity>
                  <Text className="text-[#0e9484] font-bold text-base">Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

        </View>
      </KeyboardAwareScrollView>
    </View>
  )
}