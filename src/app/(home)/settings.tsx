import { useAuth } from '@clerk/clerk-expo';
import { Text, View, Alert, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter , useFocusEffect } from 'expo-router';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState, useCallback } from 'react';
import { userStore } from '@/store/userStore';
import { User } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import { useSupabase } from '@/providers/SupabaseProvider';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Settings() {
  const { signOut, userId } = useAuth();
  const { supabase } = useSupabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null | undefined>(null);
  const [isLoading, setIsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadUser() {
        const u = await userStore.getMyDetails();
        if (u) {
          setUser(u);
          setFirstName(u.first_name || '');
          setLastName(u.last_name || '');
          setAvatarUri(u.avatar_url || null);
        }
      }
      loadUser();
    }, [])
  );

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
      setBase64Data(result.assets[0].base64);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Details", "First Name and Last Name are required.");
      return;
    }
    if (!userId) return;

    setIsLoading(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const updates: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
      };

      if (base64Data) {
        const filePath = `${userId}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(base64Data), { contentType: 'image/jpeg' });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          updates.avatar_url = publicUrlData.publicUrl;
        } else {
             console.log("Avatar upload failed: ", uploadError);
             Alert.alert("Notice", "Profile picture upload failed.");
        }
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      if (data) {
        await userStore.saveMyDetails(data);
        setUser(data);
      }
      
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch(err: any) {
        Alert.alert("Failed", err.message || "An error occurred");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <View className='flex-1 bg-[#f8fafc]'>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 16 }} className="bg-white flex-row items-center justify-between border-b border-gray-100 shadow-sm z-10">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-slate-800">Settings</Text>
          </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <TouchableOpacity 
              activeOpacity={0.8} 
              onPress={() => setIsEditing(!isEditing)}
              className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex-row items-center justify-between mb-6"
          >
              <View className="flex-row items-center">
                  {user?.avatar_url ? (
                      <Image source={user.avatar_url} style={{width: 64, height: 64, borderRadius: 32}} transition={200} />
                  ) : (
                      <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center">
                          <MaterialIcons name="person" size={32} color="#cbd5e1" />
                      </View>
                  )}
                  <View className="ml-4">
                      <Text className="text-xl font-bold text-slate-800">{user?.full_name || 'Your Profile'}</Text>
                      <Text className="text-sm text-slate-500 mt-1">Tap to edit profile</Text>
                  </View>
              </View>
              <Feather name={isEditing ? "chevron-up" : "chevron-down"} size={24} color="#94a3b8" />
          </TouchableOpacity>

          {/* Edit Profile Form */}
          {isEditing && (
              <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
                <Text className="text-lg font-bold text-slate-800 mb-4">Edit Details</Text>
                
                <View className="items-center mb-6">
                    <TouchableOpacity onPress={pickImage} activeOpacity={0.8} className="relative">
                        {avatarUri ? (
                            <Image source={avatarUri} style={{width: 90, height: 90, borderRadius: 45}} transition={200} />
                        ) : (
                            <View className="w-[90px] h-[90px] rounded-full bg-slate-100 items-center justify-center">
                                <MaterialIcons name="person" size={40} color="#cbd5e1" />
                            </View>
                        )}
                        <View className="absolute bottom-0 right-0 bg-[#0e9484] p-2 rounded-full border-2 border-white">
                            <Feather name="camera" size={14} color="white" />
                        </View>
                    </TouchableOpacity>
                </View>

                <View className="mb-4">
                    <Text className="text-slate-700 font-medium mb-1 ml-1 text-sm">First Name</Text>
                    <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 h-14">
                        <Feather name="user" size={18} color="#94a3b8" className="mr-3" />
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="First Name"
                            className="flex-1 text-slate-800 text-base h-full"
                        />
                    </View>
                </View>

                <View className="mb-6">
                    <Text className="text-slate-700 font-medium mb-1 ml-1 text-sm">Last Name</Text>
                    <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 h-14">
                        <Feather name="users" size={18} color="#94a3b8" className="mr-3" />
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Last Name"
                            className="flex-1 text-slate-800 text-base h-full"
                        />
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={handleSave} 
                    disabled={isLoading}
                    className={`w-full h-14 rounded-2xl items-center justify-center shadow-sm ${isLoading ? 'bg-[#0e9484]/70' : 'bg-[#0e9484]'}`}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">Save Changes</Text>
                    )}
                </TouchableOpacity>
              </View>
          )}

          {/* Other Settings Options */}
          <View className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
              <TouchableOpacity onPress={() => router.push('/notifications')} className="flex-row items-center justify-between p-5 border-b border-slate-50 active:bg-slate-50">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-4">
                        <Feather name="bell" size={20} color="#3b82f6" />
                    </View>
                    <Text className="text-base font-semibold text-slate-700">Notifications</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#cbd5e1" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/privacy')} className="flex-row items-center justify-between p-5 border-b border-slate-50 active:bg-slate-50">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-purple-50 items-center justify-center mr-4">
                        <Feather name="lock" size={20} color="#a855f7" />
                    </View>
                    <Text className="text-base font-semibold text-slate-700">Privacy & Security</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#cbd5e1" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => signOut()} className="flex-row items-center justify-between p-5 active:bg-slate-50">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center mr-4">
                        <Feather name="log-out" size={20} color="#ef4444" />
                    </View>
                    <Text className="text-base font-semibold text-red-500">Sign Out</Text>
                  </View>
              </TouchableOpacity>
          </View>
      </ScrollView>
    </View>
  )
}