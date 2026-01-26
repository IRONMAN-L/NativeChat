#include "secure_storage.h"

#include <fstream>
#include <cstdio>
#include <filesystem>

namespace secure {

    static std::string g_basePath = "";

    // 2. Add a function to set it
    void setBasePath(const std::string& path) {
        g_basePath = path;
    }

    static std::string pathFor(const std::string& key) {
        // 3. Prepend the base path
        if (g_basePath.empty()) return ".secure_" + key; // Fallback
        return g_basePath + "/.secure_" + key;
    }

    bool write(const std::string& key, const std::vector<uint8_t>& data) {
        std::ofstream file(pathFor(key), std::ios::binary | std::ios::trunc);
        if (!file) return false;

        file.write(reinterpret_cast<const char*>(data.data()), data.size());
        return true;
    }

    bool read(const std::string& key, std::vector<uint8_t>& out) {
        std::ifstream file(pathFor(key), std::ios::binary);
        if (!file) return false;

        file.seekg(0, std::ios::end);
        size_t size = file.tellg();
        file.seekg(0);

        out.resize(size);
        file.read(reinterpret_cast<char*>(out.data()), size);
        return true;
    }

    bool remove(const std::string& key) {
        return std::remove(pathFor(key).c_str()) == 0;
    }

    bool write_uint32(const std::string& key, uint32_t value) {
        std::vector<uint8_t> data(4);
        data[0] = (value >> 24) & 0xFF;
        data[1] = (value >> 16) & 0xFF;
        data[2] = (value >> 8) & 0xFF;
        data[3] = value & 0xFF;

        return write(key, data);
    }

    bool read_uint32(const std::string& key, uint32_t& out) {
        std::vector<uint8_t> data;
        if (!read(key, data) || data.size() != 4) return false;

        out =
            (data[0] << 24) |
            (data[1] << 16) |
            (data[2] << 8)  |
            data[3];

        return true;
    }

    bool exists(const std::string& key) {
        std::ifstream file(pathFor(key));
        return file.good();
    }

    void remove_prefix(const std::string& prefix) {
        for (const auto& entry : std::filesystem::directory_iterator(".")) {
            std::string name = entry.path().filename().string();
            if (name.rfind(".secure_" + prefix, 0) == 0) {
                std::remove(name.c_str());
            }
        }
    }
}
