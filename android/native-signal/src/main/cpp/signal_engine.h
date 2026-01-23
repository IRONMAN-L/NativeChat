#pragma once

#include <string>
#include <vector>
#include <cstdint>

class SignalEngine {
public:
    static SignalEngine& instance();

    void initialize();

    // NEW: Needed to establish session with a new user
    bool processPreKeyBundle(
        const std::string& peerId,
        uint32_t registrationId,
        uint32_t deviceId,
        uint32_t preKeyId,
        const std::vector<uint8_t>& preKeyPublic,
        uint32_t signedPreKeyId,
        const std::vector<uint8_t>& signedPreKeyPublic,
        const std::vector<uint8_t>& signature,
        const std::vector<uint8_t>& identityKey
    );

    std::vector<uint8_t> encrypt(
        const std::string& peerId,
        const std::vector<uint8_t>& plaintext
    );

    std::vector<uint8_t> decrypt(
        const std::string& peerId,
        const std::vector<uint8_t>& ciphertext
    );

private:
    SignalEngine();
    SignalEngine(const SignalEngine&) = delete;
    SignalEngine& operator=(const SignalEngine&) = delete;
};