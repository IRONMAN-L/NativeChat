import { userStore } from '@/store/userStore';
import { User } from '@/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { ActivityIndicator, Alert, FlatList, PermissionsAndroid, Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import NativeTaskModule from '../../../../modules/native-task/src/NativeTaskModule';

/** Helper: show an alert and wait for the user to press OK (returns a Promise) */
function alertAsync(title: string, message: string): Promise<void> {
    return new Promise((resolve) => {
        Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
    });
}

async function requestPermissionsFlow() {
    const { status: locStatus } = await Location.getForegroundPermissionsAsync();
    if (locStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            alert('Permission to access location was denied.');
            return false;
        }
    }

    if (Platform.OS === 'android' && Platform.Version >= 31) {
        const checks = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ];
        // Only ask if not all granted
        const hasAll = await Promise.all(checks.map(p => PermissionsAndroid.check(p)));
        if (!hasAll.every(Boolean)) {
            const granted = await PermissionsAndroid.requestMultiple(checks);
            if (Object.values(granted).some(g => g !== 'granted')) {
                return false;
            }
        }
    }
    
    // Check if location services are actually on, but don't loop annoyingly
    const locationEnabled = await Location.hasServicesEnabledAsync();
    if (!locationEnabled) {
        await alertAsync(
            'Location Required',
            'Nearby Discovery needs Location services to find devices. Please turn on Location.'
        );
        if (Platform.OS === 'android') {
            await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS);
        }
        const recheck = await Location.hasServicesEnabledAsync();
        if (!recheck) {
            return false;
        }
    }

    return true;
}

export default function OfflineScreen() {
    const [users, setUsers] = useState<{ endpointId: string, userName: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isAdvertising, setIsAdvertising] = useState(false);
    const [myData, setMyData] = useState<User | null>(null);
    const usersRef = useRef(users);
    usersRef.current = users;
    useEffect(() => {
        let mounted = true;
        let cleanupFn: (() => void) | undefined;

        const init = async () => {
            const ok = await requestPermissionsFlow();
            if (!ok || !mounted) return;

            setMyData(await userStore.getMyDetails());
            
            const userSub = NativeTaskModule.addListener('onUserFound', (event) => {
                setUsers(prev => {
                    if (prev.find(u => u.endpointId === event.endpointId)) return prev;
                    return [...prev, event];
                });
            });

            const connectSub = NativeTaskModule.addListener('onConnected', async (event) => {
                const connectedUser = usersRef.current.find(u => u.endpointId === event.endpointId);
                const myself = await userStore.getMyDetails();

                NativeTaskModule.sendMessage(event.endpointId, JSON.stringify({
                    type: 'KEY_REQUEST',
                    userName: myself?.first_name || myself?.full_name || "Nearby User",
                    userId: myself?.id
                }))

                router.push({
                    pathname: '/(home)/nearby/chat',
                    params: {
                        endpointId: event.endpointId,
                        userName: connectedUser?.userName || 'Nearby User',
                    }
                } as any);
            });

            cleanupFn = () => {
                userSub.remove();
                connectSub.remove();
                NativeTaskModule.stopAll();
            };
        };

        init();

        return () => {
            mounted = false;
            if (cleanupFn) cleanupFn();
            else NativeTaskModule.stopAll(); // Backup cleanup
        };
    }, []);

    const startDiscovery = () => {
        setUsers([]);
        setIsSearching(true);
        NativeTaskModule.startDiscovery();
    };

    const startAdvertising = () => {
        setIsAdvertising(true);
        NativeTaskModule.startAdvertising(myData?.full_name || myData?.first_name || "My phone");
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nearby Discovery</Text>
            </View>

            <View style={styles.container}>
                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                    {/* Host Room */}
                    <TouchableOpacity
                        onPress={startAdvertising}
                        activeOpacity={0.8}
                        style={[
                            styles.actionBtn,
                            isAdvertising ? styles.hostActiveBtn : styles.hostInactiveBtn
                        ]}
                    >
                        <View style={[styles.iconWrap, isAdvertising ? styles.activeIconWrap : styles.hostInactiveIconWrap]}>
                            <MaterialCommunityIcons name="broadcast" size={30} color={isAdvertising ? 'white' : '#10b981'} />
                        </View>
                        <Text style={[styles.actionTitle, isAdvertising ? styles.activeText : styles.hostInactiveText]}>
                            {isAdvertising ? 'Broadcasting...' : 'Host Room'}
                        </Text>
                        <Text style={[styles.actionSubtitle, isAdvertising ? styles.hostActiveSubtitle : styles.hostInactiveSubtitle]}>Others can find you</Text>
                    </TouchableOpacity>

                    {/* Find Rooms */}
                    <TouchableOpacity
                        onPress={startDiscovery}
                        activeOpacity={0.8}
                        style={[
                            styles.actionBtn,
                            isSearching ? styles.findActiveBtn : styles.findInactiveBtn
                        ]}
                    >
                        <View style={[styles.iconWrap, isSearching ? styles.activeIconWrap : styles.findInactiveIconWrap]}>
                            {isSearching ? <ActivityIndicator color="white" /> : <MaterialCommunityIcons name="magnify" size={30} color="#2563eb" />}
                        </View>
                        <Text style={[styles.actionTitle, isSearching ? styles.activeText : styles.findInactiveText]}>
                            {isSearching ? 'Searching...' : 'Find Rooms'}
                        </Text>
                        <Text style={[styles.actionSubtitle, isSearching ? styles.findActiveSubtitle : styles.findInactiveSubtitle]}>Join nearby chats</Text>
                    </TouchableOpacity>
                </View>

                {/* Results or Radar */}
                {isSearching && users.length === 0 ? (
                    <View style={styles.radarContainer}>
                        <View style={styles.centerWrap}>
                            {/* Static Icon */}
                            <View style={styles.radarStaticIcon}>
                                <MaterialCommunityIcons name="radar" size={80} color="#3b82f6" />
                            </View>
                        </View>
                        <Text style={styles.scanningText}>Scanning the area...</Text>
                        <Text style={styles.scanningSubtext}>Make sure the other person is hosting a room on their device.</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.resultsHeader}>
                            <Text style={styles.resultsTitle}>Devices found: {users.length}</Text>
                            {isSearching && <ActivityIndicator size="small" color="#3b82f6" />}
                        </View>

                        <FlatList
                            data={users}
                            keyExtractor={(item) => item.endpointId}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => NativeTaskModule.connectToUser(item.endpointId, myData?.full_name || myData?.first_name || "My phone")}
                                    style={styles.card}
                                >
                                    <View style={styles.cardIcon}>
                                        <MaterialCommunityIcons name="cellphone" size={24} color="white" />
                                    </View>
                                    <View style={styles.cardBody}>
                                        <Text style={styles.cardTitle}>{item.userName}</Text>
                                        <View style={styles.statusRow}>
                                            <View style={styles.statusDot} />
                                            <Text style={styles.statusText}>Available to connect</Text>
                                        </View>
                                    </View>
                                    <View style={styles.cardArrow}>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'white' },
    header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#f3f4f6' },
    backBtn: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'black' },
    container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
    actionsRow: { flexDirection: 'row', gap: 16, marginBottom: 32 },
    actionBtn: { flex: 1, padding: 20, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    
    hostActiveBtn: { backgroundColor: '#10b981', borderColor: '#10b981', elevation: 4 },
    hostInactiveBtn: { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' },
    findActiveBtn: { backgroundColor: '#2563eb', borderColor: '#2563eb', elevation: 4 },
    findInactiveBtn: { backgroundColor: '#eff6ff', borderColor: '#dbeafe' },

    iconWrap: { padding: 12, borderRadius: 16, marginBottom: 8 },
    activeIconWrap: { backgroundColor: 'rgba(255,255,255,0.2)' },
    hostInactiveIconWrap: { backgroundColor: '#a7f3d0' },
    findInactiveIconWrap: { backgroundColor: '#bfdbfe' },

    actionTitle: { fontWeight: 'bold', fontSize: 14 },
    activeText: { color: 'white' },
    hostInactiveText: { color: '#047857' },
    findInactiveText: { color: '#1d4ed8' },

    actionSubtitle: { fontSize: 10, marginTop: 4 },
    hostActiveSubtitle: { color: '#ecfdf5' },
    hostInactiveSubtitle: { color: '#059669' },
    findActiveSubtitle: { color: '#eff6ff' },
    findInactiveSubtitle: { color: '#2563eb' },

    radarContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
    centerWrap: { alignItems: 'center', justifyContent: 'center' },
    radarStaticIcon: { backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
    scanningText: { color: '#0f172a', fontWeight: 'bold', marginTop: 32, fontSize: 18 },
    scanningSubtext: { color: '#64748b', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },

    resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    resultsTitle: { color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 10 },
    
    card: { backgroundColor: 'white', padding: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    cardIcon: { backgroundColor: '#10b981', padding: 12, borderRadius: 16, marginRight: 16 },
    cardBody: { flex: 1 },
    cardTitle: { fontWeight: '800', color: '#1f2937', fontSize: 18 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    statusDot: { backgroundColor: '#10b981', width: 6, height: 6, borderRadius: 3, marginRight: 8 },
    statusText: { color: '#059669', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' },
    cardArrow: { backgroundColor: '#f9fafb', padding: 8, borderRadius: 12 }
});