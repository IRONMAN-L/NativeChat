#pragma once
#include <jni.h>

#ifdef __cplusplus
extern "C" {
#endif

JNIEXPORT void JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_initialize(
  JNIEnv* env, jclass, jstring path
);

// NEW: PreKey Bundle Processing
JNIEXPORT jboolean JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_processPreKeyBundle(
  JNIEnv*, jclass,
  jstring peerId,
  jint registrationId,
  jint deviceId,
  jint preKeyId,
  jbyteArray preKeyPublic,
  jint signedPreKeyId,
  jbyteArray signedPreKeyPublic,
  jbyteArray signature,
  jbyteArray identityKey
);

JNIEXPORT jbyteArray JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_encrypt(
  JNIEnv*, jclass,
  jstring peerId,
  jbyteArray plaintext
);

JNIEXPORT jbyteArray JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_decrypt(
  JNIEnv*, jclass,
  jstring peerId,
  jbyteArray ciphertext
);

JNIEXPORT jboolean JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_sessionExists(
  JNIEnv*, jclass,
  jstring peerId
);

JNIEXPORT jstring JNICALL
Java_com_potato_1chip_nativechat_signal_SignalModule_getRegistrationData(
  JNIEnv*, jclass
);

#ifdef __cplusplus
}
#endif