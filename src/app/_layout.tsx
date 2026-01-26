import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../../global.css';
// import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { signal } from '@/native/signal';
import SupabaseProvider, { useSupabase } from '@/providers/SupabaseProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
            return null;
        }
    },
    async saveToken(key: string, value: string) {
        try {
            return SecureStore.setItemAsync(key, value);
        }
        catch (err) {
            return;
        }
    }
}
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
    throw new Error('Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
}


function RootStack() {
    const { isSignedIn, isLoaded, userId } = useAuth();
    const { supabase, isSupabaseReady } = useSupabase();
    useEffect(() => {
        async function setupSignal() {
            if (isSignedIn && userId && isSupabaseReady) {
                const success = await signal.registerDeviceOnServer(userId, supabase);
                if (success) {
                    console.log('Signal protocol is READY for user:', userId);
                }
            }
        }
        setupSignal();
    }, [isSignedIn, userId, isSupabaseReady]);

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