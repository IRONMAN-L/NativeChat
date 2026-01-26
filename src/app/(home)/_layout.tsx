import { Stack } from "expo-router";
import { Platform } from "react-native";
export default function ChatsDrawerLayout() {
  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{
        animation: "slide_from_right"
      }}
    >
      <Stack.Screen name="(tabs)" options={{
        title: 'Chats',
        headerShown: false,
      }} />
      <Stack.Screen name="settings" options={{
        title: "Settings",
        headerTitleStyle: {
          fontWeight: "bold",
        },

      }} />
      <Stack.Screen name="chat/[id]"
        options={{
          title: "Chat",

          // ios
          // headerLargeTitleEnabled: true,
          // headerBackButtonDisplayMode: 'minimal',
          // headerTransparent:true,
        }}
      />
      <Stack.Screen name="new/NewChat" 
        options={{
          title: "New Chat",
          headerTitleStyle: {
            fontWeight:'bold'
          },
          presentation:"modal",
        }}
      />
    </Stack>
  );
}
