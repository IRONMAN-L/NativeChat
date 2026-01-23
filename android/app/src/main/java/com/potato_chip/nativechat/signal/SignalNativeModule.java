package com.potato_chip.nativechat.signal;

import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SignalNativeModule extends ReactContextBaseJavaModule {

  public SignalNativeModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "SignalModule";
  }

  @ReactMethod
  public void initialize(Promise promise) {
    try {
      SignalModule.initialize();
      promise.resolve("Signal Test: Module is ready");
    } catch (Exception e) {
      promise.reject("INIT_FAILED", e);
    }
  }


  @ReactMethod
  public void encrypt(String peerId, String plaintextBase64, Promise promise) {
    try {
      byte[] plaintext = Base64.decode(plaintextBase64, Base64.DEFAULT);
      byte[] cipher = SignalModule.encrypt(peerId, plaintext);
      String out = Base64.encodeToString(cipher, Base64.NO_WRAP);
      promise.resolve(out);
    } catch (Exception e) {
      promise.reject("ENCRYPT_FAILED", e);
    }
  }

  @ReactMethod
  public void decrypt(String peerId, String ciphertextBase64, Promise promise) {
    try {
      byte[] ciphertext = Base64.decode(ciphertextBase64, Base64.DEFAULT);
      byte[] plain = SignalModule.decrypt(peerId, ciphertext);
      String out = Base64.encodeToString(plain, Base64.NO_WRAP);
      promise.resolve(out);
    } catch (Exception e) {
      promise.reject("DECRYPT_FAILED", e);
    }
  }


  @ReactMethod
  public void processPreKeyBundle(
      String peerId,
      int registrationId,
      int deviceId,
      int preKeyId,
      String preKeyPublicBase64,
      int signedPreKeyId,
      String signedPreKeyPublicBase64,
      String signatureBase64,
      String identityKeyBase64,
      Promise promise
  ) {
    try {
      byte[] preKey = Base64.decode(preKeyPublicBase64, Base64.DEFAULT);
      byte[] signedPreKey = Base64.decode(signedPreKeyPublicBase64, Base64.DEFAULT);
      byte[] signature = Base64.decode(signatureBase64, Base64.DEFAULT);
      byte[] identity = Base64.decode(identityKeyBase64, Base64.DEFAULT);

      boolean success = SignalModule.processPreKeyBundle(
        peerId,
        registrationId,
        deviceId,
        preKeyId,
        preKey,
        signedPreKeyId,
        signedPreKey,
        signature,
        identity
      );
      if (success) {
          promise.resolve(true);
        } else {
          promise.reject("BUNDLE_ERROR", "Failed to process prekey bundle");
        }
    } catch (Exception e) {
      promise.reject("BUNDLE_EXCEPTION", e);
    }
  }
}
