import { useCall } from '@/providers/CallProvider';
import { callStore, CallRecord } from '@/store/callStore';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Calls Tab — Call history page.
 *
 * HOW IT WORKS (for learning):
 * ─────────────────────────────
 * 1. On focus, we load all call records from callStore (local AsyncStorage)
 * 2. Each record shows: avatar, name, call type icon, duration, timestamp
 * 3. Tapping a call starts a new call to that person via startCall()
 * 4. Color coding:
 *    - Red icon = missed/rejected call
 *    - Green icon = answered incoming call
 *    - Blue icon = outgoing call
 * 5. The FlatList uses the same styling patterns as your chat list
 */
export default function Calls() {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const { user } = useUser();
    const { startCall } = useCall();
    const insets = useSafeAreaInsets();

    // Reload call history whenever this tab is focused
    useFocusEffect(
        useCallback(() => {
            async function load() {
                const history = await callStore.loadCalls();
                setCalls(history);
            }
            load();
        }, [])
    );

    // ─── Helper: format duration as mm:ss ────────────────────────────
    function formatDuration(seconds: number): string {
        if (seconds <= 0) return '';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ─── Helper: get display info for a call ─────────────────────────
    function getCallDisplayInfo(call: CallRecord) {
        const isOutgoing = call.isOutgoing;
        const isMissed = call.status === 'missed' || call.status === 'rejected';

        // Show the OTHER person's name/avatar (not yourself)
        const displayName = isOutgoing ? call.receiverName : call.callerName;
        const displayAvatar = isOutgoing ? call.receiverAvatar : call.callerAvatar;
        const displayId = isOutgoing ? call.receiverId : call.callerId;

        // Icon and color based on call status
        let iconName: keyof typeof MaterialIcons.glyphMap = 'call-made';
        let iconColor = '#3b82f6'; // blue for outgoing

        if (isMissed) {
            iconName = isOutgoing ? 'call-made' : 'call-missed';
            iconColor = '#ef4444'; // red for missed
        } else if (!isOutgoing) {
            iconName = 'call-received';
            iconColor = '#22c55e'; // green for answered incoming
        }

        return { displayName, displayAvatar, displayId, iconName, iconColor, isOutgoing, isMissed };
    }

    // ─── Render a single call record ─────────────────────────────────
    const renderCallItem = ({ item }: { item: CallRecord }) => {
        const { displayName, displayAvatar, displayId, iconName, iconColor, isOutgoing, isMissed } = getCallDisplayInfo(item);

        const initials = displayName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

        const timeAgo = formatDistanceToNow(new Date(item.startedAt), { addSuffix: false });
        const duration = formatDuration(item.duration);

        const statusText = isMissed
            ? (isOutgoing ? 'No answer' : 'Missed')
            : (isOutgoing ? 'Outgoing' : 'Incoming');

        return (
            <Pressable
                onPress={() => {
                    // Tap to call back
                    if (displayId && displayName) {
                        startCall(item.channelId, displayId, displayName, displayAvatar);
                    }
                }}
                style={({ pressed }) => [
                    styles.callItem,
                    { opacity: pressed ? 0.6 : 1 }
                ]}
            >
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    {displayAvatar ? (
                        <Image
                            source={displayAvatar}
                            style={styles.avatar}
                            transition={200}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitials}>{initials}</Text>
                        </View>
                    )}
                </View>

                {/* Call Info */}
                <View style={styles.callInfo}>
                    <Text style={[styles.callerName, isMissed && styles.missedName]} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <View style={styles.callMeta}>
                        <MaterialIcons name={iconName} size={16} color={iconColor} />
                        <Text style={[styles.statusText, { color: iconColor }]}>
                            {statusText}
                        </Text>
                        {duration ? (
                            <Text style={styles.durationText}>• {duration}</Text>
                        ) : null}
                    </View>
                </View>

                {/* Time + Call button */}
                <View style={styles.rightSection}>
                    <Text style={styles.timeText}>{timeAgo.replace('about ', '')}</Text>
                    <View style={styles.callBackButton}>
                        <Ionicons name="call" size={18} color="#0e9864" />
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={calls}
                keyExtractor={(item) => item.id}
                renderItem={renderCallItem}
                contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconContainer}>
                            <MaterialIcons name="phone-in-talk" size={56} color="#0e9864" />
                        </View>
                        <Text style={styles.emptyTitle}>No calls yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Your call history will appear here.{'\n'}
                            Start a call from any chat!
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    callItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#f8fafc',
    },
    avatarPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(14, 152, 100, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(14, 152, 100, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#0e9864',
        fontSize: 18,
        fontWeight: 'bold',
    },
    callInfo: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    callerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
    },
    missedName: {
        color: '#ef4444',
    },
    callMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '500',
    },
    durationText: {
        fontSize: 13,
        color: '#94a3b8',
        marginLeft: 2,
    },
    rightSection: {
        alignItems: 'flex-end',
        gap: 8,
    },
    timeText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    callBackButton: {
        padding: 6,
        backgroundColor: 'rgba(14, 152, 100, 0.08)',
        borderRadius: 16,
    },
    separator: {
        height: 0.5,
        backgroundColor: '#f1f5f9',
        marginLeft: 82,
    },
    // ─── Empty state ─────────────────────────────────────────────────
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 120,
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(14, 152, 100, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 22,
    },
});