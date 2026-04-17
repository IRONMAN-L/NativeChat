import { useCall } from '@/providers/CallProvider';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

const { height } = Dimensions.get('window');

/**
 * IncomingCallOverlay — Full-screen overlay shown when someone calls you.
 *
 * HOW IT WORKS (for learning):
 * ─────────────────────────────
 * This component reads `incomingCall` from the CallProvider context.
 * When it's non-null, it renders a premium incoming call UI on top of everything.
 *
 * It sits in (home)/_layout.tsx so it can appear over any screen.
 * The Animated API is used for:
 * - A pulsing ring effect around the avatar (creates the "ringing" visual)
 * - A slide-up entrance animation
 * - Breathing glow on the accept button
 */
export default function IncomingCallOverlay() {
    const { incomingCall, acceptIncomingCall, rejectIncomingCall } = useCall();

    // ─── Animations ──────────────────────────────────────────────────
    const slideAnim = useRef(new Animated.Value(height)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const buttonGlow = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        if (incomingCall) {
            // Slide up + fade in
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 9,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            // Pulsing ring
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.4,
                        duration: 1000,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        easing: Easing.in(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Accept button glow
            Animated.loop(
                Animated.sequence([
                    Animated.timing(buttonGlow, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(buttonGlow, {
                        toValue: 0.6,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            // Reset animations
            slideAnim.setValue(height);
            opacityAnim.setValue(0);
            pulseAnim.setValue(1);
        }
    }, [incomingCall]);

    if (!incomingCall) return null;

    const initials = incomingCall.callerName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: opacityAnim,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            {/* Background gradient effect */}
            <View style={styles.backgroundGradient} />

            {/* Top section — "Incoming Call" label */}
            <View style={styles.topSection}>
                <View style={styles.callTypeIndicator}>
                    <MaterialIcons name="phone-in-talk" size={16} color="#4ade80" />
                    <Text style={styles.callTypeText}>Incoming Voice Call</Text>
                </View>
            </View>

            {/* Center section — Caller info */}
            <View style={styles.centerSection}>
                {/* Pulsing ring behind avatar */}
                <Animated.View
                    style={[
                        styles.pulseRing,
                        {
                            transform: [{ scale: pulseAnim }],
                            opacity: pulseAnim.interpolate({
                                inputRange: [1, 1.4],
                                outputRange: [0.4, 0],
                            }),
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.pulseRingOuter,
                        {
                            transform: [
                                {
                                    scale: pulseAnim.interpolate({
                                        inputRange: [1, 1.4],
                                        outputRange: [1.1, 1.6],
                                    }),
                                },
                            ],
                            opacity: pulseAnim.interpolate({
                                inputRange: [1, 1.4],
                                outputRange: [0.2, 0],
                            }),
                        },
                    ]}
                />

                {/* Avatar */}
                {incomingCall.callerAvatar ? (
                    <Image
                        source={incomingCall.callerAvatar}
                        style={styles.avatar}
                        transition={200}
                    />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                )}

                <Text style={styles.callerName}>{incomingCall.callerName}</Text>
                <Text style={styles.callerSubtitle}>NativeChat Audio Call</Text>
            </View>

            {/* Bottom section — Accept / Reject buttons */}
            <View style={styles.bottomSection}>
                {/* Reject */}
                <View style={styles.rejectButton}>
                    <TouchableOpacity
                        style={styles.rejectButtonInner}
                        onPress={rejectIncomingCall}
                        activeOpacity={0.7}
                    >
                        <MaterialIcons name="call-end" size={32} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.buttonLabel}>Decline</Text>
                </View>

                {/* Accept */}
                <View style={styles.acceptButton}>
                    <TouchableOpacity
                        onPress={acceptIncomingCall}
                        activeOpacity={0.7}
                    >
                        <Animated.View style={[styles.acceptButtonInner, { opacity: buttonGlow }]}>
                            <Ionicons name="call" size={32} color="white" />
                        </Animated.View>
                    </TouchableOpacity>
                    <Text style={styles.buttonLabel}>Accept</Text>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        backgroundColor: '#0a0f1a',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 60,
    },
    backgroundGradient: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        // Simulated gradient with overlapping colors
        borderTopWidth: 300,
        borderTopColor: 'rgba(14, 152, 100, 0.08)',
    },
    topSection: {
        alignItems: 'center',
        marginTop: 40,
    },
    callTypeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    callTypeText: {
        color: '#4ade80',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    centerSection: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 3,
        borderColor: '#0e9864',
    },
    pulseRingOuter: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        borderColor: '#0e9864',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: 'rgba(14, 152, 100, 0.5)',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(14, 152, 100, 0.2)',
        borderWidth: 3,
        borderColor: 'rgba(14, 152, 100, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#4ade80',
        fontSize: 40,
        fontWeight: 'bold',
    },
    callerName: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: 24,
        letterSpacing: 0.5,
    },
    callerSubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 15,
        marginTop: 8,
        letterSpacing: 0.3,
    },
    bottomSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 80,
        marginBottom: 40,
    },
    rejectButton: {
        alignItems: 'center',
        gap: 12,
    },
    acceptButton: {
        alignItems: 'center',
        gap: 12,
    },
    acceptButtonInner: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    buttonLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontWeight: '600',
    },
    rejectButtonInner: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
});
