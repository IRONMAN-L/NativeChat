cmake_minimum_required(VERSION 3.10)
project(signal_native)

set(CMAKE_CXX_STANDARD 17)

# --------------------------------------------------------
# 1. VISIBILITY SETTINGS (Prevents crashes)
# --------------------------------------------------------
set(CMAKE_C_VISIBILITY_PRESET hidden)
set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)

# --------------------------------------------------------
# 2. FILE COLLECTION
# --------------------------------------------------------

# Core Signal Files
file(GLOB SIGNAL_CORE_SRCS 
    "libsignal/*.c"
    "libsignal/protocol/*.c"
)

# Math Files (Exclude the real 'tests' folder)
file(GLOB_RECURSE CURVE_RAW_SRCS 
    "libsignal/curve25519/*.c"
)

set(CURVE_SRCS "")
foreach(FILE ${CURVE_RAW_SRCS})
    if(NOT "${FILE}" MATCHES "/tests/")
        list(APPEND CURVE_SRCS ${FILE})
    endif()
endforeach()

# Protobuf Files
file(GLOB PROTOBUF_SRCS 
    "libsignal/protobuf-c/*.c"
)

# --------------------------------------------------------
# 3. DEFINE LIBRARY
# --------------------------------------------------------
add_library(
  signal_native
  SHARED

  # Native Bridge
  SignalModule.cpp
  signal_engine.cpp
  signal_crypto_provider.cpp

  # Stores
  identity_store.cpp
  session_store.cpp
  prekey_store.cpp
  signed_prekey_store.cpp
  sender_key_store.cpp
  protocol_store.cpp
  secure_storage.cpp

  # Helper source files
  ${SIGNAL_CORE_SRCS}
  ${CURVE_SRCS}
  ${PROTOBUF_SRCS}
  libsignal/LocalStorageProtocol.pb-c.c

  # --- THE FIX ---
  # Include our dummy file to satisfy 'all_fast_tests' symbol
  dummy_tests.c
)

# --------------------------------------------------------
# 4. INCLUDE DIRECTORIES
# --------------------------------------------------------
target_include_directories(signal_native PRIVATE 
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${CMAKE_CURRENT_SOURCE_DIR}/libsignal
  ${CMAKE_CURRENT_SOURCE_DIR}/libsignal/protobuf-c
  ${CMAKE_CURRENT_SOURCE_DIR}/libsignal/curve25519
  ${CMAKE_CURRENT_SOURCE_DIR}/libsignal/curve25519/ed25519
  ${CMAKE_CURRENT_SOURCE_DIR}/libsignal/curve25519/ed25519/nacl_includes
  ${CMAKE_CURRENT_SOURCE_DIR}/libsignal/curve25519/ed25519/nacl_sha512
  ${CMAKE_CURRENT_SOURCE_DIR}/libsignal/curve25519/ed25519/additions
  ${CMAKE_CURRENT_SOURCE_DIR}/libsignal/curve25519/ed25519/additions/generalized
)

# --------------------------------------------------------
# 5. LINKING
# --------------------------------------------------------
find_library(log-lib log)
find_library(android-lib android)
find_library(cpp_shared c++_shared)


target_link_libraries(signal_native ${log-lib} ${android-lib} ${cpp_shared})