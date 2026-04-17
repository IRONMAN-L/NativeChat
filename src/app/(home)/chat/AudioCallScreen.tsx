import { useCall } from '@/providers/CallProvider';
import { userStore } from '@/store/userStore';
import { MaterialIcons } from '@expo/vector-icons';
import { ONE_ON_ONE_VOICE_CALL_CONFIG, ZegoUIKitPrebuiltCall } from '@zegocloud/zego-uikit-prebuilt-call-rn';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * AudioCallScreen — The actual ZegoCloud call screen.
 *
 * HOW IT WORKS (for learning):
 * ─────────────────────────────
 * 1. This screen receives params: callId, channelId, recipientId, recipientName, recipientAvatar
 * 2. The `callId` is the ZegoCloud room ID — BOTH users join the same callId
 * 3. ZegoUIKitPrebuiltCall handles all the WebRTC/audio logic internally
 * 4. When the call ends (via hang up button), we:
 *    - Calculate duration
 *    - Call endActiveCall() from CallProvider to save history
 *    - Navigate back
 *
 * The ONE_ON_ONE_VOICE_CALL_CONFIG preset configures:
 * - Audio only (no video)
 * - 1-on-1 layout
 * - Built-in mute/speaker/hangup buttons
 */

type AudioCallParams = {
    callId: string;
    channelId: string;
    recipientId: string;
    recipientName: string;
    recipientAvatar: string;
};

export default function AudioCallScreen() {
    const {
        callId,
        channelId,
        recipientId,
        recipientName,
        recipientAvatar,
    } = useLocalSearchParams<AudioCallParams>();
    const router = useRouter();
    const { endActiveCall } = useCall();
    const callStartTime = useRef(Date.now());

    // Get my details for ZegoCloud user identification
    const [myName, setMyName] = useState('User');
    const [myId, setMyId] = useState('');

    useEffect(() => {
        async function loadMyDetails() {
            const me = await userStore.getMyDetails();
            if (me) {
                setMyName(me.full_name || me.first_name || 'User');
                setMyId(me.id);
            }
        }
        loadMyDetails();
    }, []);

    if (!myId || !callId) {
        return (
            <View style={styles.loadingContainer}>
                <MaterialIcons name="phone-in-talk" size={48} color="#0e9864" />
                <Text style={styles.loadingText}>Connecting call...</Text>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.container}>
                <ZegoUIKitPrebuiltCall
                    appID={parseInt(process.env.EXPO_PUBLIC_ZEGOCLOUD_APPID!)}
                    appSign={process.env.EXPO_PUBLIC_ZEGOCLOUD_APPSIGN!}
                    userID={myId}
                    userName={myName}
                    callID={callId}
                    config={{
                        // This preset configures the UI as a 1-on-1 voice call
                        ...ONE_ON_ONE_VOICE_CALL_CONFIG,

                        // Called when the call ends (user presses hang up)
                        onCallEnd: (callID: string, reason: any, duration: number) => {
                            console.log(`📞 Call ended. Reason: ${reason}, Duration: ${duration}s`);

                            // Calculate actual duration from when screen mounted
                            const actualDuration = Math.floor((Date.now() - callStartTime.current) / 1000);

                            // Save call record via the provider
                            endActiveCall(duration || actualDuration);

                            // Go back to the chat
                            router.back();
                        },

                        // Called when another user joins the call
                        onUserJoin: (users: any[]) => {
                            console.log('📞 User joined the call:', users.map(u => u.userName));
                        },

                        // Called when another user leaves the call
                        onUserLeave: (users: any[]) => {
                            console.log('📞 User left the call:', users.map(u => u.userName));
                        },
                    }}
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0f1a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0f1a',
        gap: 16,
    },
    loadingText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        fontWeight: '500',
    },
});