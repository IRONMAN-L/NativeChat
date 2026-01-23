#include "signed_prekey_store.h"
#include "secure_storage.h"

#include <key_helper.h>
#include <session_pre_key.h>
#include <cstring>
#include <ctime>
#include <string>
#include <vector>

// -------------------------
// Constructor
// -------------------------
SignedPreKeyStore::SignedPreKeyStore() {
    memset(&store, 0, sizeof(store));

    store.load_signed_pre_key     = load_signed_pre_key;
    store.store_signed_pre_key    = store_signed_pre_key;
    store.contains_signed_pre_key = contains_signed_pre_key;
    store.remove_signed_pre_key   = remove_signed_pre_key;
    store.destroy_func            = nullptr;
    store.user_data               = this;
}


signal_protocol_signed_pre_key_store* SignedPreKeyStore::callbacks() {
    return &store;
}

// -------------------------
// Signed PreKey generation
// -------------------------
void SignedPreKeyStore::generateSignedPreKey(signal_context* ctx) {
    if (!ctx) return;

    // 1. Load Identity Key Pair (REQUIRED for signing)
    std::vector<uint8_t> pubBytes, privBytes;
    if (!secure::read("identity_pub", pubBytes) || !secure::read("identity_priv", privBytes)) {
        // Identity not generated yet?
        return;
    }

    signal_buffer* pubBuf = signal_buffer_create(pubBytes.data(), pubBytes.size());
    signal_buffer* privBuf = signal_buffer_create(privBytes.data(), privBytes.size());

    ratchet_identity_key_pair* identityKeyPair = nullptr;
    // Reconstruct the key pair object
    ec_public_key* pubKey = nullptr;
    ec_private_key* privKey = nullptr;
    
    curve_decode_point(&pubKey, signal_buffer_data(pubBuf), signal_buffer_len(pubBuf), ctx);
    curve_decode_private_point(&privKey, signal_buffer_data(privBuf), signal_buffer_len(privBuf), ctx);
    
    ratchet_identity_key_pair_create(&identityKeyPair, pubKey, privKey);

    // 2. Generate Signed PreKey
    const uint32_t SIGNED_PREKEY_ID = 1;
    uint64_t timestamp = (uint64_t)time(nullptr) * 1000;

    session_signed_pre_key* signedPreKey = nullptr;

    int rc = signal_protocol_key_helper_generate_signed_pre_key(
        &signedPreKey,
        identityKeyPair,      // <--- CHANGED: Passed actual key pair
        SIGNED_PREKEY_ID,
        timestamp,
        ctx
    );

    // 3. Cleanup temporary keys
    SIGNAL_UNREF(identityKeyPair); // This frees pubKey and privKey too usually, check libsignal impl
    signal_buffer_free(pubBuf);
    signal_buffer_free(privBuf);

    if (rc < 0 || !signedPreKey) return;

    // 4. Store it
    signal_buffer* record = nullptr;
    session_signed_pre_key_serialize(&record, signedPreKey);

    if (record) {
        store_signed_pre_key(
            SIGNED_PREKEY_ID,
            signal_buffer_data(record),
            signal_buffer_len(record),
            this
        );
        signal_buffer_free(record);
    }

    SIGNAL_UNREF(signedPreKey);
}

// -------------------------
// Callbacks (Unchanged)
// -------------------------
int SignedPreKeyStore::store_signed_pre_key(
    uint32_t signed_pre_key_id,
    uint8_t* record,
    size_t record_len,
    void* user_data
) {
    (void)user_data;
    std::string key = "signed_prekey_" + std::to_string(signed_pre_key_id);
    std::vector<uint8_t> data(record, record + record_len);
    secure::write(key, data);
    return SG_SUCCESS;
}

int SignedPreKeyStore::load_signed_pre_key(
    signal_buffer** record,
    uint32_t signed_pre_key_id,
    void* user_data
) {
    (void)user_data;
    std::string key = "signed_prekey_" + std::to_string(signed_pre_key_id);
    std::vector<uint8_t> data;
    if (!secure::read(key, data)) {
        return SG_ERR_INVALID_KEY_ID;
    }
    *record = signal_buffer_create(data.data(), data.size());
    return SG_SUCCESS;
}

int SignedPreKeyStore::contains_signed_pre_key(
    uint32_t signed_pre_key_id,
    void* user_data
) {
    std::string key = "signed_prekey_" + std::to_string(signed_pre_key_id);
    return secure::exists(key) ? 1 : 0;
}

int SignedPreKeyStore::remove_signed_pre_key(
    uint32_t signed_pre_key_id,
    void* user_data
) {
    (void)user_data;
    std::string key = "signed_prekey_" + std::to_string(signed_pre_key_id);
    secure::remove(key);
    return SG_SUCCESS;
}