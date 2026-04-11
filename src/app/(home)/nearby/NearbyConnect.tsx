import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Button, FlatList, PermissionsAndroid, Platform, Text, View } from 'react-native';
import NativeTaskModule from '../../../../modules/native-task/src/NativeTaskModule';

async function requestPermissionsFlow() {
    // 1. Request Location Permission
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        alert('Permission to access location was denied. Nearby Chat will not work.');
        return false;
    }

    // 2. Request Android 12+ Bluetooth Permissions natively
    if (Platform.OS === 'android' && Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ]);

        if (granted['android.permission.BLUETOOTH_CONNECT'] !== 'granted') {
            return false;
        }
    }
    return true;
}
export default function OfflineScreen() {
    const [users, setUsers] = useState<{ endpointId: string, userName: string }[]>([]);
    const [permissionStatus, setPermissionStatus] = useState<boolean>(false);
    useEffect(() => {
        if (!requestPermissionsFlow()) {
            setPermissionStatus(false);
            return;
        }
        setPermissionStatus(true);
        // 1. Setup listeners to catch events from Kotlin
        const userSub = NativeTaskModule.addListener('onUserFound', (event) => {
            setUsers(prev => [...prev, event]);
        });

        const msgSub = NativeTaskModule.addListener('onMessageReceived', (event) => {
            alert(`Message from ${event.endpointId}: ${event.message}`);
            // Later: This is where you pass event.message to signal.decrypt()
        });


        // Cleanup when screen closes
        return () => {
            userSub.remove();
            msgSub.remove();
            NativeTaskModule.stopAll();
        };
    }, []);

    return (
        <View style={{ flex: 1, padding: 50 }}>
            {permissionStatus && <Button title="Host a Room" onPress={() => NativeTaskModule.startAdvertising("My Phone")} />}
            {permissionStatus && <Button title="Find Rooms" onPress={() => NativeTaskModule.startDiscovery()} />}

            <Text>Found Devices:</Text>
            <FlatList
                data={users}
                keyExtractor={(item) => item.endpointId}
                renderItem={({ item }) => (
                    <Button
                        title={`Connect to ${item.userName}`}
                        onPress={() => NativeTaskModule.connectToUser(item.endpointId, "My Phone")}
                    />
                )}
            />

            <Button
                title="Send 'Hello'"
                onPress={() => {
                    // Example sending to the first connected user
                    if (users[0]) NativeTaskModule.sendMessage(users[0].endpointId, "Hello World!");
                }}
            />
        </View>
    );
}