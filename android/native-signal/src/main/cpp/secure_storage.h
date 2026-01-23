#pragma once

#include <vector>
#include <string>
#include <cstdint>

namespace secure {

    // Write raw bytes under a key
    bool write(const std::string& key, const std::vector<uint8_t>& data);

    // Read raw bytes stored under a key
    bool read(const std::string& key, std::vector<uint8_t>& out);

    // Remove a stored key
    bool remove(const std::string& key);

    // Store a uint32 value
    bool write_uint32(const std::string& key, uint32_t value);

    // Read a uint32 value
    bool read_uint32(const std::string& key, uint32_t& out);

    // Check if a key exists
    bool exists(const std::string& key);

    // Remove all keys starting with a prefix
    void remove_prefix(const std::string& prefix);
}
