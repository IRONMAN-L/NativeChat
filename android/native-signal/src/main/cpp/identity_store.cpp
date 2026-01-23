#include "identity_store.h"
#include "secure_storage.h"

#include <key_helper.h>
#include <curve.h>

#include <vector>
#include <cstring>

// -------------------------
// Constructor
// -------------------------
IdentityKeyStore::IdentityKeyStore() {
    loadIdentity();

    memset(&store, 0, sizeof(store));
    store.get_identity_key_pair = get_identity_key_pair;
    store.get_local_registration_id = get_local_registration_id;
    store.save_identity = save_identity;
    store.is_trusted_identity = is_trusted_identity;
    store.user_data = this;
}

signal_protocol_identity_key_store* IdentityKeyStore::callbacks() {
    return &store;
}

// -------------------------
// Identity lifecycle
// -------------------------
bool IdentityKeyStore::hasIdentity() const {
    return publicKey && privateKey && registrationId != 0;
}

void IdentityKeyStore::loadIdentity() {
    std::vector<uint8_t> pub;
    std::vector<uint8_t> priv;
    uint32_t reg = 0;

    if (!secure::read("identity_pub", pub)) return;
    if (!secure::read("identity_priv", priv)) return;
    if (!secure::read_uint32("registration_id", reg)) return;

    publicKey = signal_buffer_create(pub.data(), pub.size());
    privateKey = signal_buffer_create(priv.data(), priv.size());
    registrationId = reg;
}

void IdentityKeyStore::saveIdentity(signal_buffer* pub,
                                   signal_buffer* priv,
                                   uint32_t regId) {
    if (publicKey) signal_buffer_free(publicKey);
    if (privateKey) signal_buffer_free(privateKey);

    publicKey = signal_buffer_copy(pub);
    privateKey = signal_buffer_copy(priv);
    registrationId = regId;

    std::vector<uint8_t> pubData(
        signal_buffer_data(publicKey),
        signal_buffer_data(publicKey) + signal_buffer_len(publicKey)
    );

    std::vector<uint8_t> privData(
        signal_buffer_data(privateKey),
        signal_buffer_data(privateKey) + signal_buffer_len(privateKey)
    );

    secure::write("identity_pub", pubData);
    secure::write("identity_priv", privData);
    secure::write_uint32("registration_id", regId);
}

void IdentityKeyStore::ensureIdentity(signal_context* ctx) {
    if (hasIdentity()) return;
    if (!ctx) return;

    ratchet_identity_key_pair* keypair = nullptr;
    uint32_t regId = 0;

    int rc = signal_protocol_key_helper_generate_identity_key_pair(&keypair, ctx);
    if (rc != SG_SUCCESS || !keypair) return;

    rc = signal_protocol_key_helper_generate_registration_id(&regId, 0, ctx);
    if (rc != SG_SUCCESS) {
        SIGNAL_UNREF(keypair);
        return;
    }

    signal_buffer* pubBuf = nullptr;
    signal_buffer* privBuf = nullptr;

    ec_public_key_serialize(&pubBuf, ratchet_identity_key_pair_get_public(keypair));
    ec_private_key_serialize(&privBuf, ratchet_identity_key_pair_get_private(keypair));

    saveIdentity(pubBuf, privBuf, regId);

    signal_buffer_free(pubBuf);
    signal_buffer_free(privBuf);
    SIGNAL_UNREF(keypair);
}

// -------------------------
// Callbacks
// -------------------------
int IdentityKeyStore::get_identity_key_pair(
    signal_buffer** public_key,
    signal_buffer** private_key,
    void* user_data
) {
    auto* self = static_cast<IdentityKeyStore*>(user_data);

    if (!self->hasIdentity()) return SG_ERR_UNKNOWN;

    *public_key = signal_buffer_copy(self->publicKey);
    *private_key = signal_buffer_copy(self->privateKey);

    return SG_SUCCESS;
}

int IdentityKeyStore::get_local_registration_id(
    void* user_data,
    uint32_t* registration_id
) {
    auto* self = static_cast<IdentityKeyStore*>(user_data);
    *registration_id = self->registrationId;
    return SG_SUCCESS;
}

int IdentityKeyStore::save_identity(
    const signal_protocol_address* address,
    uint8_t* identity_key,
    size_t identity_key_len,
    void* user_data
) {
    (void)user_data;

    std::string name(address->name, address->name_len);
    std::string key = "remote_" + name;

    std::vector<uint8_t> data(identity_key, identity_key + identity_key_len);
    secure::write(key, data);

    return SG_SUCCESS;
}

int IdentityKeyStore::is_trusted_identity(
    const signal_protocol_address* address,
    uint8_t* identity_key,
    size_t identity_key_len,
    void* user_data
) {
    (void)user_data;

    std::string name(address->name, address->name_len);
    std::string key = "remote_" + name;

    std::vector<uint8_t> stored;

    // TOFU
    if (!secure::read(key, stored)) {
        secure::write(key,
            std::vector<uint8_t>(identity_key, identity_key + identity_key_len));
        return 1;
    }

    return stored.size() == identity_key_len &&
           memcmp(stored.data(), identity_key, identity_key_len) == 0;
}
