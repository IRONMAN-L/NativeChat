import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useState } from 'react'
import { Link, router } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignUp } from '@clerk/clerk-expo';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useKeyboardLayoutStore } from '@/store/useKeyboardLayoutStore';
export default function SignUp() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [pendingVerification, setPendingVerification] = useState<boolean>(false);

  // layout key to force re-render on keyboard layout change
  const lastResumeAt = useKeyboardLayoutStore((state) => state.lastResumeAt);

  // const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, signUp, setActive } = useSignUp();


  const onSignUpPress = async () => {
    if (!isLoaded) return;
    console.log("Sign up pressed", email, password);

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
      console.log(JSON.stringify(err, null, 2));
    }
  }

  const onVerifyPress = async () => {
    if (!isLoaded) return;
    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({ code });

      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId });
        setPendingVerification(false);
        router.replace('/');
      } else {
        Alert.alert("Verification Incomplete", "Please try again.");
        console.log(JSON.stringify(signUpAttempt, null, 2));
      }
    } catch (err: any) {
      if (err.errors && err.errors[0].code === 'form_identifier_exists') {
        Alert.alert("Error", "This email is already taken. Please sign in instead.");
      } else {
        Alert.alert("Error", err.errors[0].message || "Something went wrong");
      }
      console.log(JSON.stringify(err, null, 2));
    }
  }
  if (pendingVerification) {
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
          activeOpacity={0.8}
          className="w-full bg-[#0e9484] p-4 rounded-full items-center shadow-sm"
        >
          {isLoaded ? <Text className="text-white font-bold text-lg">Verify</Text> : <ActivityIndicator color="white" className="mr-2" />}
        </TouchableOpacity>
      </View>
    )
  }
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>

      <KeyboardAwareScrollView
        key={lastResumeAt}
        enableOnAndroid={true}
        extraScrollHeight={9}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-8 w-full items-center gap-8">
          {/* Header Section*/}
          <View className="items-center gap-2">
            <MaterialCommunityIcons name="nativescript" size={60} color="#0e9484" />
            <Text className="text-3xl font-bold text-[#0e9484]">
              Create Account
            </Text>
            <Text className="text-gray-500 text-center px-4">
              Enter your details to connect with friends today.
            </Text>
          </View>

          {/* Form Section */}
          <View className="w-full gap-4">

            {/* Email Input */}
            <View>
              <Text className="text-gray-700 font-medium mb-1 ml-1">Email Address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
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
              onPress={onSignUpPress}
              activeOpacity={0.8}
              className="w-full bg-[#0e9484] p-4 rounded-full items-center shadow-sm"
            >
              {isLoaded ? <Text className="text-white font-bold text-lg">Sign Up</Text> : <ActivityIndicator color="white" className="mr-2" />}

            </TouchableOpacity>

            {/* Footer / Login Link */}
            <View className="flex-row justify-center items-center gap-1">
              <Text className="text-gray-500">Already have an account?</Text>
              <Link href="/sign-in" asChild>
                <TouchableOpacity>
                  <Text className="text-[#0e9484] font-bold">Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>

      </KeyboardAwareScrollView>
    </View>
  )
}