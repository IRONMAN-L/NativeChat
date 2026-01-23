/* * dummy_tests.c
 * This file exists solely to satisfy the Linker.
 * It provides empty implementations for test functions called by the core library.
 */

// The Linker is looking for this symbol.
// We define it here so the build succeeds.
int all_fast_tests(int breakdown) {
    // Return 0 to indicate success (or simply do nothing).
    return 0;
}