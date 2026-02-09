import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../../global.css';
// import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { signal } from '@/native/signal';
import SupabaseProvider, { useSupabase } from '@/providers/SupabaseProvider';
import { registerBackgroundNotificationTask } from '@/services/backgroundNotificationTask';
import { sendBackgroundTextMessage } from '@/services/chatService';
import { channelListStore } from '@/store/channelListStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useEffect, } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
// TanStack query
const queryClient = new QueryClient();

const tokenCache = {
    async getToken(key: string) {
        try {
            return await SecureStore.getItemAsync(key);
        } catch (err) {
            console.log(err);
            return null;
        }
    },
    async saveToken(key: string, value: string) {
        try {
            return SecureStore.setItemAsync(key, value);
        }
        catch (err) {
            console.log(err);
            return;
        }
    }
}
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
    throw new Error('Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
}


function RootStack() {
    const { isSignedIn, isLoaded, userId: myId } = useAuth();
    const { supabase, isSupabaseReady } = useSupabase();
    const { expoPushToken } = usePushNotifications();

    useEffect(() => {
        if (expoPushToken) {
            registerBackgroundNotificationTask();
        }
    }, [expoPushToken]);

    useEffect(() => {
        async function setupSignal() {
            if (isSignedIn && myId && isSupabaseReady) {
                const success = await signal.registerDeviceOnServer(myId, supabase);
                if (success) {
                    console.log('Signal protocol is READY for user:', myId);
                }
            }
        }
        setupSignal();
    }, [isSignedIn, myId, isSupabaseReady, supabase]);

    useEffect(() => {
        if (!myId || !supabase) return;
        const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
            const actionId = response.actionIdentifier;
            const userText = response.userText; // The text they typed!
            const data = response.notification.request.content.data;
            const channelId = data.channelId as string;
            const messageId = data.messageId as string;
            // 1. Handle "Reply"
            if (actionId === 'reply' && userText && channelId) {
                console.log(`User replied: ${userText} to channel ${channelId}`);

                // TODO: Call your send message logic here
                // Note: To do this purely in the background requires "Background Tasks"
                // For now, it's easier to set opensAppToForeground: true in Step 1
                const { data: channelUser } = await supabase
                    .from('channel_users')
                    .select('user_id')
                    .eq('channel_id', channelId)
                    .neq('user_id', myId) // not me
                    .single();
                if (channelUser) {
                    await sendBackgroundTextMessage(supabase, channelId, myId, channelUser.user_id, userText)
                    router.push(`/chat/${channelId}`)
                }
            }

            // 2. Handle "Mark as Read"
            if (actionId === 'mark_read' && channelId && messageId) {
                console.log("Marking as read...");
                await channelListStore.updateChannelPreview(supabase, channelId, { content: "", createdAt: "", isRead: true })
                // Call Supabase to update status
                await supabase.from('message_recipients')
                    .update({ status: 'read' })
                    .eq('message_id', messageId)
                    .eq('recipient_user_id', myId)
            }
        });

        return () => {
            responseListener.remove();
        };
    }, [myId, supabase]);

    if (!isLoaded) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size={65} color="#0e9484" />
                <Text className="text-[#0e9484] text-3xl"> Just a sec...</Text>
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!isSignedIn}>
                <Stack.Screen name="(auth)" />
            </Stack.Protected>

            <Stack.Protected guard={!!isSignedIn}>
                <Stack.Screen name="(home)" />
            </Stack.Protected>
        </Stack>
    )
}
export default function RootLayout() {
    return (
        <KeyboardProvider>
            <StatusBar
                style="dark"
                translucent={false}
                backgroundColor="white"
            />
            <QueryClientProvider client={queryClient}>
                <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
                    <SupabaseProvider>
                        <RootStack />
                    </SupabaseProvider>
                </ClerkProvider>
            </QueryClientProvider>
        </KeyboardProvider>
    )
}