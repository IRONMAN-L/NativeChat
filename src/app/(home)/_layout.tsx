import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import { ChatsProvider } from "@/hooks/useChats";
import { CallProvider } from "@/providers/CallProvider";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function useNewUser() {
  const [isFetching, setIsFecthing] = useState<boolean>(true);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);
  useEffect(() => {
    async function checkNewUser() {
      const isNewUser = await AsyncStorage.getItem('is_new_user');
      if (isNewUser === 'true') {
        setIsNewUser(true);
      } else setIsNewUser(false);
      setIsFecthing(false);
    }
    checkNewUser();
  }, []);
  return { isFetching, isNewUser };
}
export default function ChatsDrawerLayout() {
  const router = useRouter();
  const { isFetching, isNewUser } = useNewUser();
  // useEffect(() => {
  //   async function checkNewUser() {
  //     const isNewUser = await AsyncStorage.getItem('is_new_user');
  //     if (isNewUser === 'true') {
  //       router.replace('/profile-setup');
  //     }
  //   }
  //   checkNewUser();
  // }, []);
  if (isFetching) {
    <SafeAreaView style={{ flex: 1 }}>
      <ActivityIndicator size="large" />
    </SafeAreaView>
  }
  return (
    <ChatsProvider>
      <CallProvider>
        <Stack
          initialRouteName="(tabs)"
          screenOptions={{
            animation: "slide_from_right"
          }}
        >
          <Stack.Protected guard={!isNewUser}>
            <Stack.Screen name="(tabs)" options={{
              title: 'Chats',
              headerShown: false,
            }} />
            {/* <Stack.Screen name="profile-setup" options={{ headerShown: false, gestureEnabled: false }} /> */}
            <Stack.Screen name="settings" options={{
              title: "Settings",
              headerShown: false
            }} />
            <Stack.Screen name="notifications" options={{
              title: "Notifications",
              headerShown: false
            }} />
            <Stack.Screen name="privacy" options={{
              title: "Privacy & Security",
              headerShown: false
            }} />
            <Stack.Screen name="chat/[id]"
              options={{
                title: "Chat",
              }}
            />
            <Stack.Screen name="chat/AudioCallScreen"
              options={{
                headerShown: false,
                animation: "fade",
                gestureEnabled: false,
              }}
            />
            <Stack.Screen name="new/NewChat"
              options={{
                title: "New Chat",
                headerTitleStyle: {
                  fontWeight: 'bold'
                },
                presentation: "modal",
              }}
            />
            <Stack.Screen name="nearby/NearbyConnect"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="nearby/chat"
              options={{
                headerStyle: { backgroundColor: '#0f172a' },
                headerTintColor: '#f8fafc',
                headerTitleStyle: { fontWeight: 'bold' as const },
              }}
            />
          </Stack.Protected>
          <Stack.Protected guard={isNewUser}>
            <Stack.Screen name="profile-setup" options={{ headerShown: false, gestureEnabled: false }} />
          </Stack.Protected>
        </Stack>
        <IncomingCallOverlay />
      </CallProvider>
    </ChatsProvider>
  );
}
