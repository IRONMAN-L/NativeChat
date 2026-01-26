package com.potato_chip.nativechat.signal;

import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.crypto.spec.IvParameterSpec;

public class SignalModule {
  static {
    try {
      System.loadLibrary("signal_native");
      android.util.Log.i("SignalModule", "Successfully loaded");
    } catch (UnsatisfiedLinkError e) {
      android.util.Log.e("SignalModule", "Failed to load signal_native library", e);
    }
  }

  public static native void initialize(String path);

  public static native byte[] encrypt(
    String peerId,
    byte[] plaintext
  );

  public static native byte[] decrypt(
    String peerId,
    byte[] ciphertext
  );


  public static native boolean processPreKeyBundle(
      String peerId,
      int registrationId,
      int deviceId,
      int preKeyId,
      byte[] preKeyPublic,
      int signedPreKeyId,
      byte[] signedPreKeyPublic,
      byte[] signature,
      byte[] identityKey
  );

  public static native String getRegistrationData();

  // Crypto helper methods called from C++ via JNI

  private static final SecureRandom secureRandom = new SecureRandom();

  public static byte[] getRandomBytes(int len) {
    byte[] out = new byte[len];
    secureRandom.nextBytes(out);
    return out;
  }

  public static byte[] hmacSha256(byte[] key, byte[] data) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    SecretKeySpec ks = new SecretKeySpec(key, "HmacSHA256");
    mac.init(ks);
    return mac.doFinal(data);
  }

  public static byte[] sha512(byte[] data) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-512");
    return md.digest(data);
  }

  public static byte[] aesEncrypt(int cipherMode, byte[] key, byte[] iv, byte[] plaintext) throws Exception {
    // libsignal uses AES-CTR or AES-CBC based on cipherMode
    Cipher cipher;

    if (cipherMode == 1) {
      // SG_CIPHER_AES_CTR_NOPADDING = 1
      cipher = Cipher.getInstance("AES/CTR/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
      return cipher.doFinal(plaintext);
    } else if (cipherMode == 2) {
      // SG_CIPHER_AES_CBC_PKCS5 = 2
      cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
      cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
      return cipher.doFinal(plaintext);
    } else {
      throw new IllegalArgumentException("Unsupported cipher mode: " + cipherMode);
    }
  }

  public static byte[] aesDecrypt(int cipherMode, byte[] key, byte[] iv, byte[] ciphertext) throws Exception {
    Cipher cipher;

    if (cipherMode == 1) {
      cipher = Cipher.getInstance("AES/CTR/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
      return cipher.doFinal(ciphertext);
    } else if (cipherMode == 2) {
      cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
      cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
      return cipher.doFinal(ciphertext);
    } else {
      throw new IllegalArgumentException("Unsupported cipher mode: " + cipherMode);
    }
  }
}
