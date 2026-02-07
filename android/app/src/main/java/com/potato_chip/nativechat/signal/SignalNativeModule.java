package com.potato_chip.nativechat.signal;

import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap; 
import com.facebook.react.bridge.Arguments;

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
      String path = getReactApplicationContext().getFilesDir().getAbsolutePath();
      SignalModule.initialize(path);
      promise.resolve("Signal Test: Module is ready");
    } catch (Exception e) {
      promise.reject("INIT_FAILED", e);
    }
  }

  @ReactMethod
  public void getRegistrationData(Promise promise) {
    try {
      String json = SignalModule.getRegistrationData();
      promise.resolve(json);
    } catch (Exception e) {
        promise.reject("ERR_GET_KEYS", e);
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

  @ReactMethod
  public void encryptFile(String plaintextBase64, Promise promise) {
    try {
        // 1. Generate Random Key & IV
        byte[] key = SignalModule.getRandomBytes(32);
        byte[] iv = SignalModule.getRandomBytes(16);
        byte[] data = Base64.decode(plaintextBase64, Base64.DEFAULT);

        // 2. Encrypt using the existing helper (Mode 2 = AES-CBC usually, check your C++ constants)
        // Note: SignalModule.java uses mode 1 (CTR) or 2 (CBC). CTR is generally faster for streams.
        byte[] ciphertext = SignalModule.aesEncrypt(1, key, iv, data);

        // 3. Return everything needed to decrypt later
        WritableMap map = Arguments.createMap();
        map.putString("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP));
        map.putString("key", Base64.encodeToString(key, Base64.NO_WRAP));
        map.putString("iv", Base64.encodeToString(iv, Base64.NO_WRAP));
        
        promise.resolve(map);
    } catch (Exception e) {
        promise.reject("FILE_ENCRYPT_ERR", e);
    }
  }

  @ReactMethod
  public void decryptFile(String ciphertextBase64, String keyBase64, String ivBase64, Promise promise) {
    try {
        byte[] key = Base64.decode(keyBase64, Base64.DEFAULT);
        byte[] iv = Base64.decode(ivBase64, Base64.DEFAULT);
        byte[] ciphertext = Base64.decode(ciphertextBase64, Base64.DEFAULT);

        // Decrypt (Mode 1 = CTR)
        byte[] plaintext = SignalModule.aesDecrypt(1, key, iv, ciphertext);
        
        promise.resolve(Base64.encodeToString(plaintext, Base64.NO_WRAP));
    } catch (Exception e) {
        promise.reject("FILE_DECRYPT_ERR", e);
    }
  }

  @ReactMethod
  public void sessionExists(String peerId, Promise promise) {
    try {
      boolean exists = SignalModule.sessionExists(peerId);
      promise.resolve(exists);
    } catch (Exception e) {
      promise.reject("SESSION_EXISTS_ERR", e);
    }
  }
}
