#include "signal_engine.h"
#include "protocol_store.h"
#include "secure_storage.h"
#include <session_pre_key.h>
#include <curve.h>

#include <signal_protocol.h>
#include <session_cipher.h>
#include <session_builder.h> 
#include <protocol.h>
#include "signal_crypto_provider.h"
extern signal_crypto_provider g_crypto_provider;

static SignalProtocolStore g_store;
static signal_context* g_ctx = nullptr;
static bool g_initialized = false;

SignalEngine& SignalEngine::instance() {
    static SignalEngine instance;
    return instance;
}

SignalEngine::SignalEngine() {}

void SignalEngine::initialize() {
    if (g_initialized) return;
    if (signal_context_create(&g_ctx, nullptr) != SG_SUCCESS) return;
    if (signal_context_set_crypto_provider(g_ctx, &g_crypto_provider) != SG_SUCCESS) return;

    g_store.init(g_ctx);

    bool isRegistered = secure::exists("registration_id");
    if (!isRegistered) {
        g_store.identityStore.ensureIdentity(g_ctx);
        g_store.preKeyStore.generatePreKeys(g_ctx);
        g_store.signedPreKeyStore.generateSignedPreKey(g_ctx);
    }
    
    g_initialized = true;
}

std::vector<uint8_t> SignalEngine::getIdentityKeyPublic() {
    std::vector<uint8_t> pub;
    // Reads directly from the file created by IdentityKeyStore
    secure::read("identity_pub", pub);
    return pub;
}

uint32_t SignalEngine::getLocalRegistrationId() {
    uint32_t regId = 0;
    secure::read_uint32("registration_id", regId);
    return regId;
}

SignedPreKeyData SignalEngine::getSignedPreKeyData() {
    SignedPreKeyData result = {0, {}, {}};
    
    // We generated ID 1 in SignedPreKeyStore::generateSignedPreKey
    uint32_t signedPreKeyId = 1; 
    std::string key = "signed_prekey_" + std::to_string(signedPreKeyId);
    
    std::vector<uint8_t> data;
    if (!secure::read(key, data)) return result;

    // Deserialize the record
    session_signed_pre_key* record = nullptr;
    if (session_signed_pre_key_deserialize(&record, data.data(), data.size(), g_ctx) != SG_SUCCESS) {
        return result;
    }

    // 1. Get ID
    result.id = session_signed_pre_key_get_id(record);

    // 2. Get Public Key (FIXED: Use Getter)
    ec_key_pair* keyPair = session_signed_pre_key_get_key_pair(record);
    ec_public_key* pubKey = ec_key_pair_get_public(keyPair); // <--- Accessor function
    
    signal_buffer* buf = nullptr;
    ec_public_key_serialize(&buf, pubKey);
    result.publicKey.assign(signal_buffer_data(buf), signal_buffer_data(buf) + signal_buffer_len(buf));
    signal_buffer_free(buf);

    // 3. Get Signature (FIXED: Handle raw bytes)
    // The compiler error confirms this returns 'const uint8_t*', not 'signal_buffer*'
    const uint8_t* sigBytes = session_signed_pre_key_get_signature(record);
    size_t sigLen = 64; // Standard Ed25519 signature length
    
    if (sigBytes) {
        result.signature.assign(sigBytes, sigBytes + sigLen);
    }

    SIGNAL_UNREF(record);
    return result;
}

std::vector<PreKeyData> SignalEngine::getOneTimePreKeys() {
    std::vector<PreKeyData> results;
    
    // We generated 100 keys starting at ID 1 in PreKeyStore::generatePreKeys
    for (uint32_t i = 1; i <= 100; i++) {
        std::string key = "prekey_" + std::to_string(i);
        std::vector<uint8_t> data;
        
        // If file exists, load it
        if (secure::read(key, data)) {
            session_pre_key* record = nullptr;
            if (session_pre_key_deserialize(&record, data.data(), data.size(), g_ctx) == SG_SUCCESS) {
                
                ec_key_pair* keyPair = session_pre_key_get_key_pair(record);
                ec_public_key* pubKey = ec_key_pair_get_public(keyPair);
                
                signal_buffer* buf = nullptr;
                ec_public_key_serialize(&buf, pubKey);
                
                PreKeyData p;
                p.id = i;
                p.publicKey.assign(signal_buffer_data(buf), signal_buffer_data(buf) + signal_buffer_len(buf));
                
                results.push_back(p);
                
                signal_buffer_free(buf);
                SIGNAL_UNREF(record);
            }
        }
    }
    return results;
}

bool SignalEngine::processPreKeyBundle(
    const std::string& peerId,
    uint32_t registrationId,
    uint32_t deviceId,
    uint32_t preKeyId,
    const std::vector<uint8_t>& preKeyPublic,
    uint32_t signedPreKeyId,
    const std::vector<uint8_t>& signedPreKeyPublic,
    const std::vector<uint8_t>& signature,
    const std::vector<uint8_t>& identityKey
) {
    if (!g_initialized) return false;

    signal_protocol_address address = {
        peerId.c_str(),
        peerId.size(),
        (int32_t)deviceId 
    };

    session_builder* builder = nullptr;
    if (session_builder_create(&builder, g_store.getStoreContext(), &address, g_ctx) != SG_SUCCESS) {
        return false;
    }

    session_pre_key_bundle* bundle = nullptr;
    
    // --- Decode Keys using standard API ---
    ec_public_key* preKeyObj = nullptr;
    ec_public_key* signedPreKeyObj = nullptr;
    ec_public_key* identityKeyObj = nullptr;

    // We must check return codes for curve_decode_point, 
    // but for brevity we check pointers after calls.
    curve_decode_point(&preKeyObj, preKeyPublic.data(), preKeyPublic.size(), g_ctx);
    curve_decode_point(&signedPreKeyObj, signedPreKeyPublic.data(), signedPreKeyPublic.size(), g_ctx);
    curve_decode_point(&identityKeyObj, identityKey.data(), identityKey.size(), g_ctx);

    // Validate decoding
    if (!preKeyObj || !signedPreKeyObj || !identityKeyObj) {
        if(preKeyObj) SIGNAL_UNREF(preKeyObj);
        if(signedPreKeyObj) SIGNAL_UNREF(signedPreKeyObj);
        if(identityKeyObj) SIGNAL_UNREF(identityKeyObj);
        session_builder_free(builder);
        return false;
    }

    // Create the bundle struct
    int rc = session_pre_key_bundle_create(
        &bundle,
        registrationId,
        (int32_t)deviceId,
        preKeyId,
        preKeyObj,
        signedPreKeyId,
        signedPreKeyObj,
        (uint8_t*)signature.data(),
        signature.size(),
        identityKeyObj
    );

    if (rc == SG_SUCCESS) {
        rc = session_builder_process_pre_key_bundle(builder, bundle);
    }

    // Cleanup
    if (bundle) {
        SIGNAL_UNREF(bundle);
    }
    
    // Release our local references (bundle_create usually increments them internally)
    SIGNAL_UNREF(preKeyObj);
    SIGNAL_UNREF(signedPreKeyObj);
    SIGNAL_UNREF(identityKeyObj);

    session_builder_free(builder);
    return (rc == SG_SUCCESS);
}

std::vector<uint8_t> SignalEngine::encrypt(
    const std::string& peerId,
    const std::vector<uint8_t>& plaintext
) {
    if (!g_initialized) return {};

    signal_protocol_address address = {
        peerId.c_str(),
        peerId.size(),
        1 // Default device ID 1
    };

    session_cipher* cipher = nullptr;
    if (session_cipher_create(&cipher, g_store.getStoreContext(), &address, g_ctx) != SG_SUCCESS)
        return {};

    ciphertext_message* encrypted = nullptr;
    
    // Encrypt the message
    if (session_cipher_encrypt(cipher, plaintext.data(), plaintext.size(), &encrypted) != SG_SUCCESS) {
        session_cipher_free(cipher);
        return {};
    }

    // FIXED: Use accessor method instead of direct member access
    signal_buffer* buf = ciphertext_message_get_serialized(encrypted);
    
    std::vector<uint8_t> out;
    if (buf) {
        out.assign(
            signal_buffer_data(buf),
            signal_buffer_data(buf) + signal_buffer_len(buf)
        );
    }

    SIGNAL_UNREF(encrypted);
    session_cipher_free(cipher);
    return out;
}

std::vector<uint8_t> SignalEngine::decrypt(
    const std::string& peerId,
    const std::vector<uint8_t>& ciphertext
) {
    if (!g_initialized) return {};

    signal_protocol_address address = {
        peerId.c_str(),
        peerId.size(),
        1
    };

    session_cipher* cipher = nullptr;
    if (session_cipher_create(&cipher, g_store.getStoreContext(), &address, g_ctx) != SG_SUCCESS)
        return {};

    signal_buffer* plaintext = nullptr;
    int rc = SG_ERR_UNKNOWN;
    
    // Try PreKey Message first (Common for first message)
    pre_key_signal_message* preKeyMsg = nullptr;
    rc = pre_key_signal_message_deserialize(&preKeyMsg, ciphertext.data(), ciphertext.size(), g_ctx);
    
    if (rc == SG_SUCCESS) {
        rc = session_cipher_decrypt_pre_key_signal_message(cipher, preKeyMsg, nullptr, &plaintext);
        SIGNAL_UNREF(preKeyMsg);
    } else {
        // Fallback to normal Signal Message
        signal_message* sigMsg = nullptr;
        rc = signal_message_deserialize(&sigMsg, ciphertext.data(), ciphertext.size(), g_ctx);
        if (rc == SG_SUCCESS) {
            rc = session_cipher_decrypt_signal_message(cipher, sigMsg, nullptr, &plaintext);
            SIGNAL_UNREF(sigMsg);
        }
    }

    if (rc != SG_SUCCESS || !plaintext) {
        session_cipher_free(cipher);
        return {};
    }

    std::vector<uint8_t> out(
        signal_buffer_data(plaintext),
        signal_buffer_data(plaintext) + signal_buffer_len(plaintext)
    );

    signal_buffer_free(plaintext);
    session_cipher_free(cipher);
    return out;
}