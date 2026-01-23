#include "prekey_store.h"
#include "secure_storage.h"

#include <key_helper.h>
#include <cstring>
#include <string>
#include <vector>

// -------------------------
// Constructor
// -------------------------
PreKeyStore::PreKeyStore() {
    memset(&store, 0, sizeof(store));

    store.load_pre_key = load_pre_key;
    store.store_pre_key = store_pre_key;
    store.contains_pre_key = contains_pre_key;
    store.remove_pre_key = remove_pre_key;
    store.user_data = this;
}

signal_protocol_pre_key_store* PreKeyStore::callbacks() {
    return &store;
}

// -------------------------
// PreKey generation
// -------------------------
void PreKeyStore::generatePreKeys(signal_context* ctx) {
    if (!ctx) return;

    const uint32_t START_ID = 1;
    const uint32_t COUNT = 100;

    signal_protocol_key_helper_pre_key_list_node* head = nullptr;

    int rc = signal_protocol_key_helper_generate_pre_keys(
        &head,
        START_ID,
        COUNT,
        ctx
    );

    if (rc < 0 || !head) return;

    signal_protocol_key_helper_pre_key_list_node* node = head;

    while (node) {
        session_pre_key* preKey =
            signal_protocol_key_helper_key_list_element(node);

        uint32_t id = session_pre_key_get_id(preKey);

        signal_buffer* buffer = nullptr;
        session_pre_key_serialize(&buffer, preKey);


        if (buffer) {
            store_pre_key(
                id,
                signal_buffer_data(buffer),
                signal_buffer_len(buffer),
                this
            );
            signal_buffer_free(buffer);
        }

        node = signal_protocol_key_helper_key_list_next(node);
    }

    signal_protocol_key_helper_key_list_free(head);
}

// -------------------------
// Callbacks
// -------------------------
int PreKeyStore::store_pre_key(
    uint32_t pre_key_id,
    uint8_t* record,
    size_t record_len,
    void* user_data
) {
    (void)user_data;

    std::string key = "prekey_" + std::to_string(pre_key_id);

    std::vector<uint8_t> data(record, record + record_len);
    secure::write(key, data);

    return SG_SUCCESS;
}

int PreKeyStore::load_pre_key(
    signal_buffer** record,
    uint32_t pre_key_id,
    void* user_data
) {
    (void)user_data;

    std::string key = "prekey_" + std::to_string(pre_key_id);

    std::vector<uint8_t> data;
    if (!secure::read(key, data)) {
        return SG_ERR_INVALID_KEY_ID;
    }

    *record = signal_buffer_create(data.data(), data.size());
    return SG_SUCCESS;
}

int PreKeyStore::contains_pre_key(
    uint32_t pre_key_id,
    void* user_data
) {
    std::string key = "prekey_" + std::to_string(pre_key_id);
    return secure::exists(key) ? 1 : 0;
}


int PreKeyStore::remove_pre_key(
    uint32_t pre_key_id,
    void* user_data
) {
    (void)user_data;

    std::string key = "prekey_" + std::to_string(pre_key_id);
    secure::remove(key);

    return SG_SUCCESS;
}
