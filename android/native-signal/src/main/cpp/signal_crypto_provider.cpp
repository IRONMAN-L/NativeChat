#include <signal_protocol.h>
#include <jni.h>
#include <cstring>
#include <cstdlib>

#include "jni_helper.h"

extern "C" {

// -----------------------
// Helpers for JNI calls
// -----------------------

static jclass gSignalModuleClass = nullptr;

static bool ensureSignalModuleClass(JNIEnv* env) {
    if (gSignalModuleClass != nullptr) return true;

    jclass local = env->FindClass("com/potato_chip/nativechat/signal/SignalModule");
    if (!local) return false;

    gSignalModuleClass = (jclass)env->NewGlobalRef(local);
    env->DeleteLocalRef(local);

    return gSignalModuleClass != nullptr;
}

static signal_buffer* jbyteArrayToSignalBuffer(JNIEnv* env, jbyteArray arr) {
    if (!arr) return nullptr;

    jsize len = env->GetArrayLength(arr);
    if (len < 0) return nullptr;

    signal_buffer* out = signal_buffer_alloc((size_t)len);
    if (!out) return nullptr;

    env->GetByteArrayRegion(arr, 0, len, (jbyte*)signal_buffer_data(out));
    return out;
}

// -----------------------
// random_func
// -----------------------
static int random_func(uint8_t* data, size_t len, void* user_data) {
    (void)user_data;

    if (!data && len > 0) return SG_ERR_INVAL;

    JNIEnv* env = getJNIEnv();
    if (!env) return SG_ERR_UNKNOWN;

    if (!ensureSignalModuleClass(env)) return SG_ERR_UNKNOWN;

    jmethodID mid = env->GetStaticMethodID(gSignalModuleClass, "getRandomBytes", "(I)[B");
    if (!mid) return SG_ERR_UNKNOWN;

    jbyteArray bytes = (jbyteArray)env->CallStaticObjectMethod(
        gSignalModuleClass,
        mid,
        (jint)len
    );

    if (env->ExceptionCheck()) {
        env->ExceptionClear();
        return SG_ERR_UNKNOWN;
    }

    if (!bytes) return SG_ERR_UNKNOWN;

    env->GetByteArrayRegion(bytes, 0, (jsize)len, (jbyte*)data);
    env->DeleteLocalRef(bytes);

    return SG_SUCCESS;
}

// -----------------------
// HMAC-SHA256 context
// -----------------------
typedef struct {
    uint8_t* key;
    size_t key_len;

    uint8_t* buffer;
    size_t buffer_len;
} hmac_ctx;

static int hmac_sha256_init_func(void** hmac_context, const uint8_t* key, size_t key_len, void* user_data) {
    (void)user_data;

    if (!hmac_context || !key || key_len == 0) return SG_ERR_INVAL;

    hmac_ctx* ctx = (hmac_ctx*)calloc(1, sizeof(hmac_ctx));
    if (!ctx) return SG_ERR_NOMEM;

    ctx->key = (uint8_t*)malloc(key_len);
    if (!ctx->key) {
        free(ctx);
        return SG_ERR_NOMEM;
    }

    memcpy(ctx->key, key, key_len);
    ctx->key_len = key_len;

    ctx->buffer = nullptr;
    ctx->buffer_len = 0;

    *hmac_context = ctx;
    return SG_SUCCESS;
}

static int hmac_sha256_update_func(void* hmac_context, const uint8_t* data, size_t data_len, void* user_data) {
    (void)user_data;

    if (!hmac_context) return SG_ERR_INVAL;
    if (!data && data_len > 0) return SG_ERR_INVAL;

    hmac_ctx* ctx = (hmac_ctx*)hmac_context;

    uint8_t* newBuf = (uint8_t*)realloc(ctx->buffer, ctx->buffer_len + data_len);
    if (!newBuf) return SG_ERR_NOMEM;

    ctx->buffer = newBuf;

    if (data_len > 0) {
        memcpy(ctx->buffer + ctx->buffer_len, data, data_len);
        ctx->buffer_len += data_len;
    }

    return SG_SUCCESS;
}

static int hmac_sha256_final_func(void* hmac_context, signal_buffer** output, void* user_data) {
    (void)user_data;

    if (!hmac_context || !output) return SG_ERR_INVAL;

    hmac_ctx* ctx = (hmac_ctx*)hmac_context;

    JNIEnv* env = getJNIEnv();
    if (!env) return SG_ERR_UNKNOWN;
    if (!ensureSignalModuleClass(env)) return SG_ERR_UNKNOWN;

    jmethodID mid = env->GetStaticMethodID(gSignalModuleClass, "hmacSha256", "([B[B)[B");
    if (!mid) return SG_ERR_UNKNOWN;

    jbyteArray jKey = env->NewByteArray((jsize)ctx->key_len);
    if (!jKey) return SG_ERR_NOMEM;
    env->SetByteArrayRegion(jKey, 0, (jsize)ctx->key_len, (jbyte*)ctx->key);

    jbyteArray jData = env->NewByteArray((jsize)ctx->buffer_len);
    if (!jData) {
        env->DeleteLocalRef(jKey);
        return SG_ERR_NOMEM;
    }

    if (ctx->buffer_len > 0) {
        env->SetByteArrayRegion(jData, 0, (jsize)ctx->buffer_len, (jbyte*)ctx->buffer);
    }

    jbyteArray result = (jbyteArray)env->CallStaticObjectMethod(gSignalModuleClass, mid, jKey, jData);

    env->DeleteLocalRef(jKey);
    env->DeleteLocalRef(jData);

    if (env->ExceptionCheck()) {
        env->ExceptionClear();
        return SG_ERR_UNKNOWN;
    }

    if (!result) return SG_ERR_UNKNOWN;

    signal_buffer* out = jbyteArrayToSignalBuffer(env, result);
    env->DeleteLocalRef(result);

    if (!out) return SG_ERR_UNKNOWN;

    *output = out;
    return SG_SUCCESS;
}

static void hmac_sha256_cleanup_func(void* hmac_context, void* user_data) {
    (void)user_data;

    if (!hmac_context) return;

    hmac_ctx* ctx = (hmac_ctx*)hmac_context;

    if (ctx->key) {
        memset(ctx->key, 0, ctx->key_len);
        free(ctx->key);
    }

    if (ctx->buffer) {
        memset(ctx->buffer, 0, ctx->buffer_len);
        free(ctx->buffer);
    }

    free(ctx);
}

// -----------------------
// SHA512 context
// -----------------------
typedef struct {
    uint8_t* buffer;
    size_t buffer_len;
} sha512_ctx;

static int sha512_digest_init_func(void** digest_context, void* user_data) {
    (void)user_data;

    if (!digest_context) return SG_ERR_INVAL;

    sha512_ctx* ctx = (sha512_ctx*)calloc(1, sizeof(sha512_ctx));
    if (!ctx) return SG_ERR_NOMEM;

    *digest_context = ctx;
    return SG_SUCCESS;
}

static int sha512_digest_update_func(void* digest_context, const uint8_t* data, size_t data_len, void* user_data) {
    (void)user_data;

    if (!digest_context) return SG_ERR_INVAL;
    if (!data && data_len > 0) return SG_ERR_INVAL;

    sha512_ctx* ctx = (sha512_ctx*)digest_context;

    uint8_t* newBuf = (uint8_t*)realloc(ctx->buffer, ctx->buffer_len + data_len);
    if (!newBuf) return SG_ERR_NOMEM;

    ctx->buffer = newBuf;

    if (data_len > 0) {
        memcpy(ctx->buffer + ctx->buffer_len, data, data_len);
        ctx->buffer_len += data_len;
    }

    return SG_SUCCESS;
}

static int sha512_digest_final_func(void* digest_context, signal_buffer** output, void* user_data) {
    (void)user_data;

    if (!digest_context || !output) return SG_ERR_INVAL;

    sha512_ctx* ctx = (sha512_ctx*)digest_context;

    JNIEnv* env = getJNIEnv();
    if (!env) return SG_ERR_UNKNOWN;
    if (!ensureSignalModuleClass(env)) return SG_ERR_UNKNOWN;

    jmethodID mid = env->GetStaticMethodID(gSignalModuleClass, "sha512", "([B)[B");
    if (!mid) return SG_ERR_UNKNOWN;

    jbyteArray jData = env->NewByteArray((jsize)ctx->buffer_len);
    if (!jData) return SG_ERR_NOMEM;

    if (ctx->buffer_len > 0) {
        env->SetByteArrayRegion(jData, 0, (jsize)ctx->buffer_len, (jbyte*)ctx->buffer);
    }

    jbyteArray result = (jbyteArray)env->CallStaticObjectMethod(gSignalModuleClass, mid, jData);
    env->DeleteLocalRef(jData);

    if (env->ExceptionCheck()) {
        env->ExceptionClear();
        return SG_ERR_UNKNOWN;
    }

    if (!result) return SG_ERR_UNKNOWN;

    signal_buffer* out = jbyteArrayToSignalBuffer(env, result);
    env->DeleteLocalRef(result);

    if (!out) return SG_ERR_UNKNOWN;

    *output = out;
    return SG_SUCCESS;
}

static void sha512_digest_cleanup_func(void* digest_context, void* user_data) {
    (void)user_data;

    if (!digest_context) return;

    sha512_ctx* ctx = (sha512_ctx*)digest_context;

    if (ctx->buffer) {
        memset(ctx->buffer, 0, ctx->buffer_len);
        free(ctx->buffer);
    }

    free(ctx);
}

// -----------------------
// AES encrypt/decrypt
// -----------------------
static int encrypt_func(signal_buffer** output, int cipher,
                        const uint8_t* key, size_t key_len,
                        const uint8_t* iv, size_t iv_len,
                        const uint8_t* plaintext, size_t plaintext_len,
                        void* user_data) {
    (void)user_data;

    if (!output || !key || !iv) return SG_ERR_INVAL;
    if (!plaintext && plaintext_len > 0) return SG_ERR_INVAL;

    JNIEnv* env = getJNIEnv();
    if (!env) return SG_ERR_UNKNOWN;
    if (!ensureSignalModuleClass(env)) return SG_ERR_UNKNOWN;

    jmethodID mid = env->GetStaticMethodID(gSignalModuleClass, "aesEncrypt", "(I[B[B[B)[B");
    if (!mid) return SG_ERR_UNKNOWN;

    jbyteArray jKey = env->NewByteArray((jsize)key_len);
    if (!jKey) return SG_ERR_NOMEM;
    env->SetByteArrayRegion(jKey, 0, (jsize)key_len, (jbyte*)key);

    jbyteArray jIv = env->NewByteArray((jsize)iv_len);
    if (!jIv) {
        env->DeleteLocalRef(jKey);
        return SG_ERR_NOMEM;
    }
    env->SetByteArrayRegion(jIv, 0, (jsize)iv_len, (jbyte*)iv);

    jbyteArray jPlain = env->NewByteArray((jsize)plaintext_len);
    if (!jPlain) {
        env->DeleteLocalRef(jKey);
        env->DeleteLocalRef(jIv);
        return SG_ERR_NOMEM;
    }
    if (plaintext_len > 0) {
        env->SetByteArrayRegion(jPlain, 0, (jsize)plaintext_len, (jbyte*)plaintext);
    }

    jbyteArray result = (jbyteArray)env->CallStaticObjectMethod(
        gSignalModuleClass,
        mid,
        (jint)cipher,
        jKey,
        jIv,
        jPlain
    );

    env->DeleteLocalRef(jKey);
    env->DeleteLocalRef(jIv);
    env->DeleteLocalRef(jPlain);

    if (env->ExceptionCheck()) {
        env->ExceptionClear();
        return SG_ERR_UNKNOWN;
    }

    if (!result) return SG_ERR_UNKNOWN;

    signal_buffer* out = jbyteArrayToSignalBuffer(env, result);
    env->DeleteLocalRef(result);

    if (!out) return SG_ERR_UNKNOWN;

    *output = out;
    return SG_SUCCESS;
}

static int decrypt_func(signal_buffer** output, int cipher,
                        const uint8_t* key, size_t key_len,
                        const uint8_t* iv, size_t iv_len,
                        const uint8_t* ciphertext, size_t ciphertext_len,
                        void* user_data) {
    (void)user_data;

    if (!output || !key || !iv) return SG_ERR_INVAL;
    if (!ciphertext && ciphertext_len > 0) return SG_ERR_INVAL;

    JNIEnv* env = getJNIEnv();
    if (!env) return SG_ERR_UNKNOWN;
    if (!ensureSignalModuleClass(env)) return SG_ERR_UNKNOWN;

    jmethodID mid = env->GetStaticMethodID(gSignalModuleClass, "aesDecrypt", "(I[B[B[B)[B");
    if (!mid) return SG_ERR_UNKNOWN;

    jbyteArray jKey = env->NewByteArray((jsize)key_len);
    if (!jKey) return SG_ERR_NOMEM;
    env->SetByteArrayRegion(jKey, 0, (jsize)key_len, (jbyte*)key);

    jbyteArray jIv = env->NewByteArray((jsize)iv_len);
    if (!jIv) {
        env->DeleteLocalRef(jKey);
        return SG_ERR_NOMEM;
    }
    env->SetByteArrayRegion(jIv, 0, (jsize)iv_len, (jbyte*)iv);

    jbyteArray jCipher = env->NewByteArray((jsize)ciphertext_len);
    if (!jCipher) {
        env->DeleteLocalRef(jKey);
        env->DeleteLocalRef(jIv);
        return SG_ERR_NOMEM;
    }

    if (ciphertext_len > 0) {
        env->SetByteArrayRegion(jCipher, 0, (jsize)ciphertext_len, (jbyte*)ciphertext);
    }

    jbyteArray result = (jbyteArray)env->CallStaticObjectMethod(
        gSignalModuleClass,
        mid,
        (jint)cipher,
        jKey,
        jIv,
        jCipher
    );

    env->DeleteLocalRef(jKey);
    env->DeleteLocalRef(jIv);
    env->DeleteLocalRef(jCipher);

    if (env->ExceptionCheck()) {
        env->ExceptionClear();
        return SG_ERR_UNKNOWN;
    }

    if (!result) return SG_ERR_UNKNOWN;

    signal_buffer* out = jbyteArrayToSignalBuffer(env, result);
    env->DeleteLocalRef(result);

    if (!out) return SG_ERR_UNKNOWN;

    *output = out;
    return SG_SUCCESS;
}

// -----------------------
// Export provider instance
// -----------------------
signal_crypto_provider g_crypto_provider = {
    .random_func = random_func,
    .hmac_sha256_init_func = hmac_sha256_init_func,
    .hmac_sha256_update_func = hmac_sha256_update_func,
    .hmac_sha256_final_func = hmac_sha256_final_func,
    .hmac_sha256_cleanup_func = hmac_sha256_cleanup_func,

    .sha512_digest_init_func = sha512_digest_init_func,
    .sha512_digest_update_func = sha512_digest_update_func,
    .sha512_digest_final_func = sha512_digest_final_func,
    .sha512_digest_cleanup_func = sha512_digest_cleanup_func,

    .encrypt_func = encrypt_func,
    .decrypt_func = decrypt_func,

    .user_data = nullptr
};

} // extern "C"
