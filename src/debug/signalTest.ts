import { Signal } from '@/native/signal';

export function testSignalEncryptDecrypt() {
    const peerId = 'naveen';

    const message = 'Hello bob';
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const plainText = encoder.encode(message);
    console.log('[Signal Test] plaintext: ', plainText);
    
    // Encrypt
    const cipherText = Signal.encrypt(peerId, plainText);
    console.log('[Signal Test] ciphertext bytes:', cipherText);

    // Decrypt
    const decryptedBytes = Signal.decrypt(peerId, cipherText);
    const decryptedText = decoder.decode(decryptedBytes);

    console.log('[Signal Test] decrypted:', decryptedText);

    if (decryptedText === message) {
        console.log('Signal E2EE test PASSED');
    }else {
        console.log('Signal E2EE test FAILED');
    }
}