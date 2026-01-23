#pragma once

#include <signal_protocol.h>

#include "identity_store.h"
#include "prekey_store.h"
#include "signed_prekey_store.h"
#include "session_store.h"
#include "sender_key_store.h"

class SignalProtocolStore {
public:
    SignalProtocolStore();

    // Initialize and wire all stores
    void init(signal_context* ctx);

    // Used by SignalEngine
    signal_protocol_store_context* getStoreContext();

public:
    // Stores (owned by this object)
    IdentityKeyStore identityStore;
    PreKeyStore preKeyStore;
    SignedPreKeyStore signedPreKeyStore;
    SessionStore sessionStore;
    SenderKeyStore senderKeyStore;

private:
    signal_protocol_store_context* storeCtx = nullptr;
};
