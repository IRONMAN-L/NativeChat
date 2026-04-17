import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';

export default function PrivacySettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const pulseValue = useSharedValue(1);

  useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseValue.value }]
    };
  });

  return (
    <View className="flex-1 bg-[#0f172a]">
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 16 }} className="bg-[#1e293b] flex-row items-center justify-between border-b border-slate-800 shadow-sm z-10">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
                <Ionicons name="arrow-back" size={24} color="#f8fafc" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-slate-100">Privacy & Security</Text>
          </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-8" showsVerticalScrollIndicator={false}>
        
        <View className="items-center mb-10 mt-2">
            <Animated.View style={[animatedStyle]} className="w-24 h-24 rounded-full bg-emerald-500/20 items-center justify-center mb-5 border border-emerald-500/30">
                <View className="w-16 h-16 rounded-full bg-emerald-500 items-center justify-center shadow-lg shadow-emerald-500/50">
                   <MaterialCommunityIcons name="shield-check" size={36} color="white" />
                </View>
            </Animated.View>
            <Text className="text-white font-extrabold text-2xl tracking-wide">End-to-End Encrypted</Text>
            <Text className="text-slate-400 text-center mt-2 text-[15px] mx-4 leading-6">
               Your messages, calls, and shared files stay between you and the people you choose. Not even NativeChat can read or listen to them.
            </Text>
        </View>

        <View className="bg-[#1e293b] rounded-3xl p-6 shadow-xl border border-slate-700 mb-6">
            <View className="flex-row items-start mb-6">
                 <View className="w-12 h-12 rounded-2xl bg-blue-500/10 items-center justify-center mr-4 mt-1">
                     <Feather name="lock" size={24} color="#60a5fa" />
                 </View>
                 <View className="flex-1">
                     <Text className="text-slate-100 font-bold text-lg mb-1">Signal Protocol Standard</Text>
                     <Text className="text-slate-400 text-sm leading-5">
                         We employ the industry-leading Signal Protocol. Every message is secured with an uncompromising, state-of-the-art cryptographic ratchet.
                     </Text>
                 </View>
            </View>

            <View className="flex-row items-start mb-6">
                 <View className="w-12 h-12 rounded-2xl bg-purple-500/10 items-center justify-center mr-4 mt-1">
                     <Feather name="key" size={24} color="#c084fc" />
                 </View>
                 <View className="flex-1">
                     <Text className="text-slate-100 font-bold text-lg mb-1">Local Key Generation</Text>
                     <Text className="text-slate-400 text-sm leading-5">
                         Your cryptographic keys are generated locally on your device and are never sent to any cloud server or database. Identity verification stays in your control.
                     </Text>
                 </View>
            </View>

            <View className="flex-row items-start">
                 <View className="w-12 h-12 rounded-2xl bg-orange-500/10 items-center justify-center mr-4 mt-1">
                     <Feather name="wifi-off" size={24} color="#fb923c" />
                 </View>
                 <View className="flex-1">
                     <Text className="text-slate-100 font-bold text-lg mb-1">Secure Nearby Connections</Text>
                     <Text className="text-slate-400 text-sm leading-5">
                         Files transferred directly over P2P WiFi or Bluetooth are fully encrypted offline using dynamic AES streaming before leaving your device.
                     </Text>
                 </View>
            </View>
        </View>

        <TouchableOpacity onPress={() => {}} activeOpacity={0.8} className="bg-[#0e9484] rounded-2xl p-4 flex-row justify-center items-center mb-10 shadow-lg shadow-[#0e9484]/20">
            <Text className="text-white font-bold text-base mr-2">Learn more about our Security</Text>
            <Feather name="external-link" size={18} color="white" />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
