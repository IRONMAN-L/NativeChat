#pragma once

#include <signal_protocol.h>

class PreKeyStore {
public:
    PreKeyStore();

    // Expose callbacks to libsignal
    signal_protocol_pre_key_store* callbacks();

    // Generate initial batch of prekeys
    void generatePreKeys(signal_context* ctx);

private:
    // ===== libsignal callbacks =====

    static int load_pre_key(
        signal_buffer** record,
        uint32_t pre_key_id,
        void* user_data
    );

    static int store_pre_key(
        uint32_t pre_key_id,
        uint8_t* record,
        size_t record_len,
        void* user_data
    );

    static int contains_pre_key(
        uint32_t pre_key_id,
        void* user_data
    );

    static int remove_pre_key(
        uint32_t pre_key_id,
        void* user_data
    );

private:
    signal_protocol_pre_key_store store;
};
