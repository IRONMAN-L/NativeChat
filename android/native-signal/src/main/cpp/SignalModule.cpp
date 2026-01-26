#include <jni.h>
#include <vector>
#include <string>
#include "jni_helper.h"
#include "SignalModule.h"
#include "signal_engine.h"
#include "secure_storage.h"
static JavaVM* gJvm = nullptr;

JavaVM* getJavaVM() {
    return gJvm;
}

JNIEnv* getJNIEnv() {
    if (!gJvm) return nullptr;

    JNIEnv* env = nullptr;
    jint result = gJvm->GetEnv((void**)&env, JNI_VERSION_1_6);

    if (result == JNI_EDETACHED) {
        // Attach current native thread to JVM
        if (gJvm->AttachCurrentThread(&env, nullptr) != JNI_OK) {
            return nullptr;
        }
    }

    return env;
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    gJvm = vm;
    return JNI_VERSION_1_6;
}


// Simple Base64 Encoder
static const std::string base64_chars = 
             "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
             "abcdefghijklmnopqrstuvwxyz"
             "0123456789+/";

std::string base64_encode(const std::vector<uint8_t>& buf) {
    std::string ret;
    int i = 0, j = 0;
    unsigned char char_array_3[3], char_array_4[4];

    for (auto byte : buf) {
        char_array_3[i++] = byte;
        if (i == 3) {
            char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
            char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
            char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
            char_array_4[3] = char_array_3[2] & 0x3f;
            for(i = 0; (i <4) ; i++) ret += base64_chars[char_array_4[i]];
            i = 0;
        }
    }
    if (i) {
        for(j = i; j < 3; j++) char_array_3[j] = '\0';
        char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
        char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
        char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
        char_array_4[3] = char_array_3[2] & 0x3f;
        for (j = 0; (j < i + 1); j++) ret += base64_chars[char_array_4[j]];
        while((i++ < 3)) ret += '=';
    }
    return ret;
}

extern "C" {

JNIEXPORT void JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_initialize(
    JNIEnv* env,
    jclass,   // ✅ static method → jclass
    jstring path
) {
    const char* pathChars = env->GetStringUTFChars(path, nullptr);
    std::string storagePath(pathChars);
    env->ReleaseStringUTFChars(path, pathChars);

    secure::setBasePath(storagePath);
    
    SignalEngine::instance().initialize();
}

JNIEXPORT jstring JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_getRegistrationData(
    JNIEnv* env,
    jclass
) {
    try {
        auto& engine = SignalEngine::instance();
        
        auto identity = engine.getIdentityKeyPublic();
        auto regId = engine.getLocalRegistrationId();
        auto spk = engine.getSignedPreKeyData();
        // 1. Fetch PreKeys
        auto preKeys = engine.getOneTimePreKeys();

        // 2. Build JSON
        std::string json = "{";
        json += "\"registrationId\": " + std::to_string(regId) + ",";
        json += "\"identityKey\": \"" + base64_encode(identity) + "\",";
        json += "\"signedPreKey\": {";
        json +=    "\"keyId\": " + std::to_string(spk.id) + ",";
        json +=    "\"publicKey\": \"" + base64_encode(spk.publicKey) + "\",";
        json +=    "\"signature\": \"" + base64_encode(spk.signature) + "\"";
        json += "},";
        
        // 3. Add PreKeys Array
        json += "\"preKeys\": [";
        for (size_t i = 0; i < preKeys.size(); i++) {
            json += "{";
            json += "\"keyId\": " + std::to_string(preKeys[i].id) + ",";
            json += "\"publicKey\": \"" + base64_encode(preKeys[i].publicKey) + "\"";
            json += "}";
            if (i < preKeys.size() - 1) json += ",";
        }
        json += "]";
        
        json += "}";

        return env->NewStringUTF(json.c_str());
    } catch (...) {
        return env->NewStringUTF("{}");
    }
}

JNIEXPORT jbyteArray JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_encrypt(
    JNIEnv* env,
    jclass,   // ✅ static method → jclass
    jstring peerId,
    jbyteArray plaintext
) {
    // Convert peerId
    const char* peerChars = env->GetStringUTFChars(peerId, nullptr);
    std::string peer(peerChars);
    env->ReleaseStringUTFChars(peerId, peerChars);

    // Convert plaintext
    jsize len = env->GetArrayLength(plaintext);
    std::vector<uint8_t> input(len);
    env->GetByteArrayRegion(
        plaintext,
        0,
        len,
        reinterpret_cast<jbyte*>(input.data())
    );

    try {
        auto output = SignalEngine::instance().encrypt(peer, input);

        jbyteArray result = env->NewByteArray((jsize)output.size());
        env->SetByteArrayRegion(
            result, 
            0, 
            (jsize)output.size(),
            (const jbyte*)output.data()
        );
        return result;
    } catch (const std::exception& e) {
        jclass exc = env->FindClass("java/lang/RuntimeException");
        env->ThrowNew(exc, e.what());
        return nullptr;
    }

}

JNIEXPORT jbyteArray JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_decrypt(
    JNIEnv* env,
    jclass,   // ✅ static method → jclass
    jstring peerId,
    jbyteArray ciphertext
) {
    // Convert peerId
    const char* peerChars = env->GetStringUTFChars(peerId, nullptr);
    std::string peer(peerChars);
    env->ReleaseStringUTFChars(peerId, peerChars);

    // Convert ciphertext
    jsize len = env->GetArrayLength(ciphertext);
    std::vector<uint8_t> input(len);
    env->GetByteArrayRegion(
        ciphertext,
        0,
        len,
        reinterpret_cast<jbyte*>(input.data())
    );

    // Decrypt
    try {
        auto output = SignalEngine::instance().decrypt(peer, input);

        jbyteArray result = env->NewByteArray((jsize)output.size());
        env->SetByteArrayRegion(
            result, 
            0, 
            (jsize)output.size(),
            (const jbyte*)output.data()
        );
        return result;
    } catch (const std::exception& e) {
        jclass exc = env->FindClass("java/lang/RuntimeException");
        env->ThrowNew(exc, e.what());
        return nullptr;
    }
}

// Add this inside the extern "C" block in SignalModule.cpp

JNIEXPORT jboolean JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_processPreKeyBundle(
    JNIEnv* env,
    jclass,
    jstring peerId,
    jint registrationId,
    jint deviceId,
    jint preKeyId,
    jbyteArray preKeyPublic,
    jint signedPreKeyId,
    jbyteArray signedPreKeyPublic,
    jbyteArray signature,
    jbyteArray identityKey
) {
    // 1. Convert Strings
    const char* peerChars = env->GetStringUTFChars(peerId, nullptr);
    std::string peer(peerChars);
    env->ReleaseStringUTFChars(peerId, peerChars);

    // 2. Helper lambda to convert jbyteArray to std::vector
    auto toVec = [&](jbyteArray arr) -> std::vector<uint8_t> {
        if (!arr) return {};
        jsize len = env->GetArrayLength(arr);
        std::vector<uint8_t> vec(len);
        env->GetByteArrayRegion(arr, 0, len, (jbyte*)vec.data());
        return vec;
    };

    // 3. Convert Byte Arrays
    auto vecPreKey = toVec(preKeyPublic);
    auto vecSignedPreKey = toVec(signedPreKeyPublic);
    auto vecSignature = toVec(signature);
    auto vecIdentity = toVec(identityKey);

    // 4. Call Engine
    bool success = SignalEngine::instance().processPreKeyBundle(
        peer,
        (uint32_t)registrationId,
        (uint32_t)deviceId,
        (uint32_t)preKeyId,
        vecPreKey,
        (uint32_t)signedPreKeyId,
        vecSignedPreKey,
        vecSignature,
        vecIdentity
    );

    return (jboolean)success;
}
} // extern "C"
