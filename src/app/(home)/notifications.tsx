import { View, Text, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationsSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [pushEnabled, setPushEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      const push = await AsyncStorage.getItem('settings_notify_push');
      const inApp = await AsyncStorage.getItem('settings_notify_inapp');
      const sound = await AsyncStorage.getItem('settings_notify_sound');
      
      if (push !== null) setPushEnabled(push === 'true');
      if (inApp !== null) setInAppEnabled(inApp === 'true');
      if (sound !== null) setSoundEnabled(sound === 'true');
    }
    loadSettings();
  }, []);

  const togglePush = async (val: boolean) => {
    setPushEnabled(val);
    await AsyncStorage.setItem('settings_notify_push', String(val));
  };
  const toggleInApp = async (val: boolean) => {
    setInAppEnabled(val);
    await AsyncStorage.setItem('settings_notify_inapp', String(val));
  };
  const toggleSound = async (val: boolean) => {
    setSoundEnabled(val);
    await AsyncStorage.setItem('settings_notify_sound', String(val));
  };

  return (
    <View className="flex-1 bg-[#f8fafc]">
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 16 }} className="bg-white flex-row items-center justify-between border-b border-gray-100 shadow-sm z-10">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-slate-800">Notifications</Text>
          </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false}>
        
        <View className="items-center mb-8 mt-2">
            <View className="w-20 h-20 rounded-full bg-blue-50 items-center justify-center mb-4">
                <Feather name="bell" size={36} color="#3b82f6" />
            </View>
            <Text className="text-slate-800 font-bold text-xl">Manage Alerts</Text>
            <Text className="text-slate-500 text-center mt-1 text-sm mx-4">
               Stay updated on your newest messages and calls while maintaining your focus.
            </Text>
        </View>

        <View className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
            <View className="flex-row items-center justify-between p-5 border-b border-slate-50">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-4">
                      <Feather name="smartphone" size={20} color="#475569" />
                  </View>
                  <View className="flex-1 mr-4">
                      <Text className="text-base font-semibold text-slate-700">Push Notifications</Text>
                      <Text className="text-xs text-slate-500 mt-0.5">Receive alerts when the app is in the background.</Text>
                  </View>
                </View>
                <Switch 
                  value={pushEnabled} 
                  onValueChange={togglePush} 
                  trackColor={{ false: '#cbd5e1', true: '#0e9484' }}
                  thumbColor={'#ffffff'}
                />
            </View>

            <View className="flex-row items-center justify-between p-5 border-b border-slate-50">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-4">
                      <Feather name="message-circle" size={20} color="#475569" />
                  </View>
                  <View className="flex-1 mr-4">
                      <Text className="text-base font-semibold text-slate-700">In-App Alerts</Text>
                      <Text className="text-xs text-slate-500 mt-0.5">Show banner previews while using the app.</Text>
                  </View>
                </View>
                <Switch 
                  value={inAppEnabled} 
                  onValueChange={toggleInApp} 
                  trackColor={{ false: '#cbd5e1', true: '#0e9484' }}
                  thumbColor={'#ffffff'}
                />
            </View>

            <View className="flex-row items-center justify-between p-5">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-4">
                      <Feather name="volume-2" size={20} color="#475569" />
                  </View>
                  <View className="flex-1 mr-4">
                      <Text className="text-base font-semibold text-slate-700">Notification Sounds</Text>
                      <Text className="text-xs text-slate-500 mt-0.5">Play a sound when an alert is received.</Text>
                  </View>
                </View>
                <Switch 
                  value={soundEnabled} 
                  onValueChange={toggleSound} 
                  trackColor={{ false: '#cbd5e1', true: '#0e9484' }}
                  thumbColor={'#ffffff'}
                />
            </View>
        </View>

        <Text className="text-slate-400 text-xs text-center mb-8 mx-4">
          Changes are automatically saved. System-level permissions may also need to be configured in your device Settings.
        </Text>

      </ScrollView>
    </View>
  );
}
