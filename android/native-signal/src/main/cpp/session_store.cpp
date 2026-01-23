#include "session_store.h"
#include "secure_storage.h"

#include <string>
#include <vector>
#include <cstring>

// -------------------------
// Constructor
// -------------------------
SessionStore::SessionStore() {
    memset(&store, 0, sizeof(store));

    store.load_session_func       = load_session;
    store.store_session_func      = store_session;
    store.contains_session_func   = contains_session;
    store.delete_session_func     = delete_session;
    store.delete_all_sessions_func= delete_all_sessions;
    store.get_sub_device_sessions_func = nullptr; // optional
    store.destroy_func            = nullptr;
    store.user_data               = this;
}


signal_protocol_session_store* SessionStore::callbacks() {
    return &store;
}

// -------------------------
// Helpers
// -------------------------
static std::string sessionKey(const signal_protocol_address* address) {
    return "session_" +
        std::string(address->name, address->name_len) +
        "_" +
        std::to_string(address->device_id);
}

// -------------------------
// Callbacks
// -------------------------
int SessionStore::load_session(
    signal_buffer** record,
    signal_buffer** user_record,
    const signal_protocol_address* address,
    void* user_data
) {
    (void)user_data;

    std::string key = sessionKey(address);

    std::vector<uint8_t> data;
    if (!secure::read(key, data)) {
        return 0; // session not found
    }

    *record = signal_buffer_create(data.data(), data.size());
    *user_record = nullptr;

    return 1; // session found
}

int SessionStore::store_session(
    const signal_protocol_address* address,
    uint8_t* record,
    size_t record_len,
    uint8_t* user_record,
    size_t user_record_len,
    void* user_data
) {
    (void)user_data;
    (void)user_record;
    (void)user_record_len;

    std::string key = sessionKey(address);

    std::vector<uint8_t> data(record, record + record_len);
    secure::write(key, data);

    return SG_SUCCESS;
}

int SessionStore::contains_session(
    const signal_protocol_address* address,
    void* user_data
) {
    (void)user_data;

    std::string key = sessionKey(address);
    return secure::exists(key) ? 1 : 0;
}

int SessionStore::delete_session(
    const signal_protocol_address* address,
    void* user_data
) {
    (void)user_data;

    secure::remove(sessionKey(address));
    return SG_SUCCESS;
}

int SessionStore::delete_all_sessions(
    const char* name,
    size_t name_len,
    void* user_data
) {
    (void)user_data;

    std::string prefix = "session_" + std::string(name, name_len);
    secure::remove_prefix(prefix);

    return SG_SUCCESS;
}
