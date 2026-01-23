#include "protocol_store.h"

// -------------------------
// Constructor
// -------------------------
SignalProtocolStore::SignalProtocolStore() {}

// -------------------------
// Initialization
// -------------------------
void SignalProtocolStore::init(signal_context* ctx) {
    if (storeCtx) return; // already initialized
    if (!ctx) return;

    // 1) Create store context
    signal_protocol_store_context_create(&storeCtx, ctx);

    // 2) Register all stores
    signal_protocol_store_context_set_identity_key_store(
        storeCtx,
        identityStore.callbacks()
    );

    signal_protocol_store_context_set_pre_key_store(
        storeCtx,
        preKeyStore.callbacks()
    );

    signal_protocol_store_context_set_signed_pre_key_store(
        storeCtx,
        signedPreKeyStore.callbacks()
    );

    signal_protocol_store_context_set_session_store(
        storeCtx,
        sessionStore.callbacks()
    );

    signal_protocol_store_context_set_sender_key_store(
        storeCtx,
        senderKeyStore.callbacks()
    );
}

// -------------------------
// Accessor
// -------------------------
signal_protocol_store_context*
SignalProtocolStore::getStoreContext() {
    return storeCtx;
}
