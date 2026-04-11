import { useSupabase } from '@/providers/SupabaseProvider';
import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
// Configure how notifications appear when app is OPEN (Foreground)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const usePushNotifications = () => {
    const { user: myself } = useUser()
    const { supabase } = useSupabase()
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    useEffect(() => {
        console.log("🔔 usePushNotifications: Effect running. User:", myself?.id);
        if (!myself) {
            console.log("🔔 usePushNotifications: No user logged in yet.");
            return;
        }

        let retryNotification: ReturnType<typeof setTimeout>
        const registerForPushNotificationsAsync = async () => {
            console.log("🔔 usePushNotifications: registerForPushNotificationsAsync started");
            let token;
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });

                await Notifications.setNotificationChannelAsync('silent', {
                    importance: Notifications.AndroidImportance.LOW,
                    name: 'silent',
                    vibrationPattern: [0],
                    lightColor: '#FF231F7C',
                })
            }

            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;
                console.log("🔔 usePushNotifications: Existing permission:", existingStatus);

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                    console.log("🔔 usePushNotifications: New permission:", finalStatus);
                }

                if (finalStatus !== 'granted') {
                    console.log('🔔 Failed to get push token for push notification! Permission denied.');
                    return;
                }

                // Get the token
                const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                console.log("🔔 usePushNotifications: Project ID:", projectId);

                try {
                    token = (await Notifications.getExpoPushTokenAsync({
                        projectId: projectId,
                    })).data;
                    console.log("🔔 usePushNotifications: Token fetched successfully:", token);

                    const storedToken = await AsyncStorage.getItem('expo_push_token');
                    if (token !== storedToken) {
                        console.log("🔔 Token changed! Updating Supabase...");

                        // 1. Save to AsyncStorage
                        await AsyncStorage.setItem('expo_push_token', token);

                        // 2. Save to Supabase (Update user profile)
                        const { error } = await supabase
                            .from('users')
                            .update({ expo_push_token: token })
                            .eq('id', myself.id);

                        if (error) {
                            console.error("🔔 Failed to update token in Supabase:", error);
                        } else {
                            console.log("🔔 Token updated in Supabase successfully!");
                        }
                    } else {
                        console.log("🔔 Token is the same as stored. No update needed.");
                    }

                } catch (err) {
                    console.log("🔔 usePushNotifications: Error fetching token:", err);
                    retryNotification = setTimeout(() => {
                        console.log("🔔 usePushNotifications: Retrying...");
                        registerForPushNotificationsAsync();
                    }, 1000);
                }

                await registerCategories();
            } else {
                console.log('Must use physical device for Push Notifications');
            }

            if (token) {
                setExpoPushToken(token);
                // ... rest of logic

                const storedToken = await AsyncStorage.getItem('expo_push_token');
                if (token !== storedToken) {
                    // ...
                }
            }
        };

        registerForPushNotificationsAsync();

        return () => {
            clearTimeout(retryNotification);
        }
    }, [myself, supabase]);

    return { expoPushToken };
};

const registerCategories = async () => {
    await Notifications.setNotificationCategoryAsync('chat_message', [
        {
            identifier: 'reply',
            buttonTitle: 'Reply',
            textInput: {
                submitButtonTitle: 'Send',
                placeholder: 'Type your message...',
            },
            // Opens the app in the background (Android) or allows text input (iOS)
            options: {
                opensAppToForeground: false,
            },
        },
        {
            identifier: 'mark_read',
            buttonTitle: 'Mark as Read',
            options: {
                opensAppToForeground: false, // Keep app in background
            },
        },
    ]);
};