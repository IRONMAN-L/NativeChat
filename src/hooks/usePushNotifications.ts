import { useSupabase } from '@/providers/SupabaseProvider';
import { useUser } from '@clerk/clerk-expo';
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
        if (!myself) return;

        let retryNotification: ReturnType<typeof setTimeout>
        const registerForPushNotificationsAsync = async () => {
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

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus !== 'granted') {
                    console.log('Failed to get push token for push notification!');
                    return;
                }

                // Get the token
                try {
                    token = (await Notifications.getExpoPushTokenAsync({
                        projectId: Constants.expoConfig?.extra?.eas?.projectId,
                    })).data;
                } catch {
                    retryNotification = setTimeout(() => {
                        registerForPushNotificationsAsync();
                    }, 1000);
                }

                console.log("Expo Push Token:", token);
                await registerCategories();
            } else {
                console.log('Must use physical device for Push Notifications');
            }

            if (token) {
                setExpoPushToken(token);

                // Save to Supabase users table
                const { error } = await supabase
                    .from('users')
                    .update({ expo_push_token: token })
                    .eq('id', myself.id); // Assuming 'id' matches Clerk ID

                if (error) console.error("Error saving push token:", error);
                else console.log("Push Token linked to user in DB");
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
                opensAppToForeground: true, // Set TRUE if you want to open the app to chat
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