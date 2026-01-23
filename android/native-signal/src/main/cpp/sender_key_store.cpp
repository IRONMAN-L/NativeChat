#include "sender_key_store.h"
#include "secure_storage.h"

#include <cstring>
#include <string>
#include <vector>

// -------------------------
// Constructor
// -------------------------
SenderKeyStore::SenderKeyStore() {
    memset(&store, 0, sizeof(store));

    store.load_sender_key = load_sender_key;
    store.store_sender_key = store_sender_key;
    store.user_data = this;
}

signal_protocol_sender_key_store* SenderKeyStore::callbacks() {
    return &store;
}

// -------------------------
// Helpers
// -------------------------
static std::string senderKeyId(
    const signal_protocol_sender_key_name* name
) {
    std::string group(
        name->group_id,
        name->group_id_len
    );

    std::string sender(
        name->sender.name,
        name->sender.name_len
    );

    int deviceId = name->sender.device_id;

    return "sender_key_" +
           group + "_" +
           sender + "_" +
           std::to_string(deviceId);
}

// -------------------------
// Callbacks
// -------------------------
int SenderKeyStore::load_sender_key(
    signal_buffer** record,
    signal_buffer** user_record,
    const signal_protocol_sender_key_name* sender_key_name,
    void* user_data
) {
    (void)user_data;

    std::string key = senderKeyId(sender_key_name);

    std::vector<uint8_t> data;
    if (!secure::read(key, data)) {
        return 0; // not found
    }

    *record = signal_buffer_create(data.data(), data.size());
    *user_record = nullptr;

    return 1;
}

int SenderKeyStore::store_sender_key(
    const signal_protocol_sender_key_name* sender_key_name,
    uint8_t* record,
    size_t record_len,
    uint8_t* user_record,
    size_t user_record_len,
    void* user_data
) {
    (void)user_record;
    (void)user_record_len;
    (void)user_data;

    std::string key = senderKeyId(sender_key_name);

    std::vector<uint8_t> data(record, record + record_len);
    secure::write(key, data);

    return SG_SUCCESS;
}
