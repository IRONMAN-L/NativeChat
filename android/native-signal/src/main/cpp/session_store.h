#pragma once

#include <signal_protocol.h>

class SessionStore {
public:
    SessionStore();

    // Expose callbacks to libsignal
    signal_protocol_session_store* callbacks();

private:
    // ===== libsignal callbacks =====

    static int load_session(
        signal_buffer** record,
        signal_buffer** user_record,
        const signal_protocol_address* address,
        void* user_data
    );

    static int store_session(
        const signal_protocol_address* address,
        uint8_t* record,
        size_t record_len,
        uint8_t* user_record,
        size_t user_record_len,
        void* user_data
    );

    static int contains_session(
        const signal_protocol_address* address,
        void* user_data
    );

    static int delete_session(
        const signal_protocol_address* address,
        void* user_data
    );

    static int delete_all_sessions(
        const char* name,
        size_t name_len,
        void* user_data
    );

private:
    signal_protocol_session_store store;
};
