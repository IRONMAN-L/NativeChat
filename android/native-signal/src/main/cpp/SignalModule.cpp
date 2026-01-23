#include <jni.h>
#include <vector>
#include <string>
#include "jni_helper.h"
#include "SignalModule.h"
#include "signal_engine.h"

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

extern "C" {

JNIEXPORT void JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_initialize(
    JNIEnv*,
    jclass   // ✅ static method → jclass
) {
    SignalEngine::instance().initialize();
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
