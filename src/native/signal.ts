import { Database } from '@/types/database.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient } from '@supabase/supabase-js';
import { NativeModules } from 'react-native';

const { SignalModule } = NativeModules;

type ClaimedKey = {
    prekey_id: number;
    prekey: string;
};

const UPLOAD_FLAG_KEY = 'signal_keys_uploaded_v1'
// Helper for waiting
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const signal = {
    async initialize() {
        // 1. Initialize C++ Engine
        const res = await SignalModule.initialize();
        console.log(res);
    },

    async encrypt() { }, // TODO
    async decrypt() { }, // TODO


    async establishSession(recipientUserId: string, supabase: SupabaseClient<Database>) {
        try {
            console.log(`🔗 Establishing session with ${recipientUserId}...`);
            await this.initialize();

            // 1. Get Recipient's Device Info (Identity & Signed PreKey)
            const { data: device, error: deviceError } = await supabase
                .from('signal_devices')
                .select('*')
                .eq('user_id', recipientUserId)
                .eq('device_id', 1) // Primary Mobile
                .single();

            if (deviceError || !device) {
                throw new Error(`Recipient device not found: ${deviceError?.message}`);
            }

            // 2. Claim One-Time PreKey (RPC Call)
            const { data, error: rpcError } = await supabase
                .rpc('claim_prekey', {
                    target_user_id: recipientUserId,
                    target_device_id: 1
                });

            if (rpcError) throw new Error(`Failed to claim PreKey: ${rpcError.message}`);

            const preKeyData = data as ClaimedKey | null;

            if (!preKeyData) {
                console.warn("⚠️ No One-Time PreKey available. Falling back to X3DH without OTPK.");
            }


            // 3. Process the Bundle in Native C++
            // The peerId is usually "userId:deviceId" 
            const peerAddress = `${recipientUserId}:1`;

            const success = await SignalModule.processPreKeyBundle(
                peerAddress,           // peerId (Internal Address)
                device.registration_id,
                1,                     // deviceId
                preKeyData?.prekey_id ?? 0,// preKeyId (0 if none)
                preKeyData?.prekey ?? "",  // preKeyPublic (Empty string if none)
                device.signed_prekey_id,
                device.signed_prekey,  // Signed PreKey Public
                device.signed_prekey_signature, // Signature
                device.identity_key    // Identity Key
            );

            if (success) {
                console.log(`Session established with ${peerAddress}`);
                return true;
            } else {
                console.error("Native Engine failed to process bundle");
                return false;
            }

        } catch (e) {
            console.error("Session Error:", e);
            return false;
        }
    },
    async registerDeviceOnServer(userId: string, supabase: SupabaseClient<Database>) {
        try {
            // Initialize signal
            await this.initialize();

            // checking if keys are already uploaded to server
            const userUploadFlag = `${UPLOAD_FLAG_KEY}`
            const hasUploaded = await AsyncStorage.getItem(userUploadFlag);
            if (hasUploaded === 'true') {
                console.log("Signal keys already on server. Skipping upload.");
                return true;
            }

            // 2. Get Keys
            const keysJson = await SignalModule.getRegistrationData();
            const keys = JSON.parse(keysJson);
            const DEVICE_ID = 1;

            // 3. Prepare Payload
            const deviceData = {
                user_id: userId,
                device_id: DEVICE_ID,
                registration_id: keys.registrationId,
                identity_key: keys.identityKey,
                signed_prekey_id: keys.signedPreKey.keyId,
                signed_prekey: keys.signedPreKey.publicKey,
                signed_prekey_signature: keys.signedPreKey.signature,
                updated_at: new Date().toISOString(),
            };


            // 4. Upload Device with RETRY (for Webhook latency)
            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts) {
                const { error: deviceError } = await supabase.from('signal_devices').upsert(deviceData);

                if (!deviceError) break; // Success!

                if (deviceError.code === '23503') { // Foreign Key Violation
                    console.log(`⏳ Webhook hasn't created user yet. Retrying (${attempts + 1}/${maxAttempts})...`);
                    await delay(2000); // Wait 2s
                    attempts++;
                } else {
                    throw new Error(`Device upload failed: ${deviceError.message}`);
                }
            }
            console.log("Signal Device Registered");

            // 5. Upload PreKeys (Batch)
            const preKeysData = keys.preKeys.map((pk: any) => ({
                user_id: userId,
                device_id: DEVICE_ID,
                prekey_id: pk.keyId,
                prekey: pk.publicKey,
            }));

            const { error: preKeyError } = await supabase
                .from('signal_prekeys')
                .upsert(preKeysData, { onConflict: 'user_id, device_id, prekey_id' });

            if (preKeyError) throw new Error(`PreKey Upload Failed: ${preKeyError.message}`);

            console.log(`Uploaded ${preKeysData.length} PreKeys`);

            // 6. Set Uploaded = true in AsyncStorage to avoid reupload
            await AsyncStorage.setItem(userUploadFlag, 'true');

            return true;
        } catch (error) {
            console.error("Signal Registration Error:", error);
            return false;
        }
    }

}
