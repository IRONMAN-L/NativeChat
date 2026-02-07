import { Database } from '@/types/database.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';
import { documentDirectory, EncodingType, makeDirectoryAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
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

    async encrypt(recipientUserId: string, message: string) {
        try {
            // 1. Convert string to Base64 (Signal Native expects Base64 input)
            const plaintextBase64 = Buffer.from(message, 'utf8').toString('base64');

            console.log(`🔒 Encrypting for ${recipientUserId}: "${message}"`);

            // 2. Call Native Module
            // The result will be a JSON string containing { type: 3, body: "..." }
            const ciphertext = await SignalModule.encrypt(recipientUserId, plaintextBase64);

            console.log("📦 Ciphertext received:", ciphertext.substring(0, 20) + "...");
            return ciphertext;
        } catch (error) {
            console.error("Encryption Failed:", error);
            throw error;
        }
    }, // TODO
    async decrypt(senderUserId: string, ciphertext: string) {
        try {
            const plaintextBase64 = await SignalModule.decrypt(senderUserId, ciphertext);

            // convert Base64 -> UTF-8 string
            const plaintext = Buffer.from(plaintextBase64, 'base64').toString('utf8');
            console.log("Decrypted: ", plaintext);
            return plaintext;
        } catch (err) {
            console.error(`Decryption Failed for ${senderUserId}:`, err);
            return null;
        }
    }, // TODO


    async establishSession(recipientUserId: string, supabase: SupabaseClient<Database>) {
        try {
            console.log(`🔗 Establishing session with ${recipientUserId}...`);
            await this.initialize();

            // Check if session already exists
            const exists = await SignalModule.sessionExists(recipientUserId);
            if (exists) {
                console.log('Session already Exists. Skipping Handshake');
                return true;
            }
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


            // 3. Process the PreKeyBundle in Native C++
            // The peerId is usually "userId:deviceId" 
            const peerAddress = `${recipientUserId}:1`;

            console.log("🔍 --- PRE-FLIGHT CHECK ---");
            console.log(`Target: ${peerAddress}`);
            console.log(`Registration ID: ${device.registration_id} (Type: ${typeof device.registration_id})`);

            // 1. Check Identity Key (Should be ~44 chars, starting with 'B' or 'A')
            console.log(`Identity Key: ${device.identity_key} (Len: ${device.identity_key.length})`);

            // 2. Check Signed PreKey
            console.log(`Signed PreKey ID: ${device.signed_prekey_id}`);
            console.log(`Signed PreKey: ${device.signed_prekey} (Len: ${device.signed_prekey.length})`);
            console.log(`Signature: ${device.signed_prekey_signature} (Len: ${device.signed_prekey_signature.length})`);

            // 3. Check One-Time PreKey
            console.log(`PreKey ID: ${preKeyData?.prekey_id}`);
            console.log(`PreKey: ${preKeyData?.prekey} (Len: ${preKeyData?.prekey?.length})`);
            console.log("---------------------------");

            const success = await SignalModule.processPreKeyBundle(
                recipientUserId,           // peerId (Internal Address)
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
    },

    async encryptImage(imageUri: string) {
        try {
            // 1. Read file as Base64 
            // (You'll need expo-file-system for this)
            const base64Data = await readAsStringAsync(imageUri, { encoding: EncodingType.Base64 })

            // 2. Encrypt using Native AES (Fast)
            // Returns: { ciphertext: "...", key: "...", iv: "..." }
            const result = await SignalModule.encryptFile(base64Data);
            console.log("✅ Image Encrypted");
            return result;
        } catch (e) {
            console.error("Image Encryption Failed:", e);
            throw e;
        }
    },

    async decryptImage(ciphertextBase64: string, keyBase64: string, ivBase64: string) {
        try {
            console.log("🔓 Decrypting image...");

            // 1. Decrypt using Native AES (C++/Java)
            // Returns the raw Base64 string of the image
            const plaintextBase64 = await SignalModule.decryptFile(ciphertextBase64, keyBase64, ivBase64);

            // 2. Save to a persistent folder structure (similar to WhatsApp)
            const mediaDir = `${documentDirectory}Media/Nativechat Images/`;
            await makeDirectoryAsync(mediaDir, { intermediates: true });

            const filename = `IMG-${Date.now()}.jpg`;
            const path = `${mediaDir}${filename}`;

            // 3. Write decrypted data to the persistent path
            await writeAsStringAsync(path, plaintextBase64, { encoding: EncodingType.Base64 });

            // 4. Register with MediaLibrary to show in Gallery
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
                const asset = await MediaLibrary.createAssetAsync(path);
                const album = await MediaLibrary.getAlbumAsync('Nativechat');

                if (album == null) {
                    await MediaLibrary.createAlbumAsync('Nativechat', asset, false);
                } else {
                    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                }
                console.log("🖼️ Image saved to Gallery album");
            }

            console.log("✅ Image saved to:", path);
            return path;

        } catch (e) {
            console.error("Image Decryption Failed:", e);
            return null;
        }
    },

}
