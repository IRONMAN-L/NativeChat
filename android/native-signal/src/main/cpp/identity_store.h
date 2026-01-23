#pragma once

#include <signal_protocol.h>
#include <cstdint>

class IdentityKeyStore {
public:
    IdentityKeyStore();

    // Called during engine initialization
    void ensureIdentity(signal_context* ctx);

    // Expose callbacks to libsignal
    signal_protocol_identity_key_store* callbacks();

private:
    // Internal helpers
    bool hasIdentity() const;
    void loadIdentity();
    void saveIdentity(signal_buffer* pub,
                      signal_buffer* priv,
                      uint32_t registrationId);

    // ===== libsignal callbacks =====

    static int get_identity_key_pair(
        signal_buffer** public_key,
        signal_buffer** private_key,
        void* user_data
    );

    static int get_local_registration_id(
        void* user_data,
        uint32_t* registration_id
    );

    static int save_identity(
        const signal_protocol_address* address,
        uint8_t* identity_key,
        size_t identity_key_len,
        void* user_data
    );

    static int is_trusted_identity(
        const signal_protocol_address* address,
        uint8_t* identity_key,
        size_t identity_key_len,
        void* user_data
    );

private:
    signal_buffer* publicKey = nullptr;
    signal_buffer* privateKey = nullptr;
    uint32_t registrationId = 0;

    signal_protocol_identity_key_store store;
};
