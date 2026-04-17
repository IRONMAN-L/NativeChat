import { useSupabase } from '@/providers/SupabaseProvider';
import { userStore } from '@/store/userStore';
import { useAuth } from '@clerk/clerk-expo';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileSetup() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null | undefined>(null);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { userId } = useAuth();
  const { supabase } = useSupabase();
  const insets = useSafeAreaInsets();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true, // request base64 string
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
      setBase64Data(result.assets[0].base64);
    }
  };

  const onCompleteProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Details", "First Name and Last Name are required.");
      return;
    }

    if (!userId) {
      Alert.alert("Error", "Authentication issue. Please sign in again.");
      return;
    }

    setIsLoading(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // Basic update for user's profile text fields.
      const updates: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
      };

      // Upload avatar logic
      if (base64Data) {
        const filePath = `${userId}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(base64Data), {
            contentType: 'image/jpeg',
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          updates.avatar_url = publicUrlData.publicUrl;
        } else {
          console.log("Avatar upload failed: ", uploadError);
          Alert.alert("Upload Notice", "Your profile picture could not be uploaded to cloud storage, but we'll save the rest of your profile.");
        }
      }

      // Sync to supabase
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Update local storage representation 
      if (data) {
        await userStore.saveMyDetails(data);
      }

      // Complete New User workflow state
      await AsyncStorage.removeItem('is_new_user');

      setIsLoading(false);
      // Ensure we hit the (tabs) screen explicitly
      router.replace('/');

    } catch (err: any) {
      setIsLoading(false);
      Alert.alert("Failed to update profile", err.message || "An unknown error occurred");
    }
  };

  return (
    <View className="flex-1 bg-[#f8fafc]" style={{ paddingTop: insets.top }}>
      <KeyboardAwareScrollView
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-8 w-full gap-8">

          {/* Header Section */}
          <View className="items-center mt-10">
            <View className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-4">
              <Feather name="user-check" size={40} color="#0e9484" />
            </View>
            <Text className="text-3xl font-bold text-slate-800">
              Complete Profile
            </Text>
            <Text className="text-slate-500 text-center mt-2 px-4 leading-5 text-sm">
              Let your friends know who you are by setting up your basic info.
            </Text>
          </View>

          {/* Profile Picture Section */}
          <View className="items-center mt-4">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={pickImage}
              className="relative rounded-full bg-white shadow-sm border-[4px] border-white elevation-5 w-32 h-32 justify-center items-center overflow-visible"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} className="w-full h-full rounded-full" />
              ) : (
                <MaterialIcons name="person" size={60} color="#cbd5e1" />
              )}

              <View className="absolute bottom-0 right-0 bg-[#0e9484] border-2 border-white rounded-full p-2.5 shadow-sm">
                <Feather name="camera" size={16} color="white" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Form Section */}
          <View className="w-full gap-5 mt-4">
            <View>
              <Text className="text-slate-700 font-semibold mb-2 ml-1 text-sm">First Name</Text>
              <View className="flex-row items-center w-full bg-white border border-slate-200 rounded-[20px] px-4 h-[60px] focus:border-[#0e9484] shadow-sm">
                <Feather name="user" size={20} color="#94a3b8" className="mr-3" />
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                  className="flex-1 text-slate-800 text-base h-full"
                />
              </View>
            </View>

            <View>
              <Text className="text-slate-700 font-semibold mb-2 ml-1 text-sm">Last Name</Text>
              <View className="flex-row items-center w-full bg-white border border-slate-200 rounded-[20px] px-4 h-[60px] focus:border-[#0e9484] shadow-sm">
                <Feather name="users" size={20} color="#94a3b8" className="mr-3" />
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                  className="flex-1 text-slate-800 text-base h-full"
                />
              </View>
            </View>
          </View>

          {/* Button Section */}
          <View className="w-full mt-6">
            <TouchableOpacity
              onPress={onCompleteProfile}
              activeOpacity={0.8}
              disabled={isLoading}
              className={`w-full h-[60px] rounded-[20px] items-center justify-center shadow-lg shadow-[#0e9484]/30 ${isLoading ? 'bg-[#0e9484]/70' : 'bg-[#0e9484]'}`}
            >
              {isLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="white" className="mr-3" />
                  <Text className="text-white font-semibold text-lg">Saving Profile...</Text>
                </View>
              ) : (
                <Text className="text-white font-bold text-lg tracking-wide">Finish Setup</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
