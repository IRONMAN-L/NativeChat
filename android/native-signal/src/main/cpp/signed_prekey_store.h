#pragma once

#include <signal_protocol.h>

class SignedPreKeyStore {
public:
    SignedPreKeyStore();

    // Expose callbacks to libsignal
    signal_protocol_signed_pre_key_store* callbacks();

    // Called once after identity exists
    void generateSignedPreKey(signal_context* ctx);

private:
    // ===== libsignal callbacks =====

    static int load_signed_pre_key(
        signal_buffer** record,
        uint32_t signed_pre_key_id,
        void* user_data
    );

    static int store_signed_pre_key(
        uint32_t signed_pre_key_id,
        uint8_t* record,
        size_t record_len,
        void* user_data
    );

    static int contains_signed_pre_key(
        uint32_t signed_pre_key_id,
        void* user_data
    );

    static int remove_signed_pre_key(
        uint32_t signed_pre_key_id,
        void* user_data
    );

private:
    signal_protocol_signed_pre_key_store store;
};
