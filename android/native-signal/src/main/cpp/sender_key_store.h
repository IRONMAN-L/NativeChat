#pragma once

#include <signal_protocol.h>

class SenderKeyStore {
public:
    SenderKeyStore();

    // Expose callbacks to libsignal
    signal_protocol_sender_key_store* callbacks();

private:
    // ===== libsignal callbacks =====

    static int load_sender_key(
        signal_buffer** record,
        signal_buffer** user_record,
        const signal_protocol_sender_key_name* sender_key_name,
        void* user_data
    );

    static int store_sender_key(
        const signal_protocol_sender_key_name* sender_key_name,
        uint8_t* record,
        size_t record_len,
        uint8_t* user_record,
        size_t user_record_len,
        void* user_data
    );

private:
    signal_protocol_sender_key_store store;
};
