#!/bin/bash
set -e

# Secure Entropy Generation Script for macOS
# Generates cryptographically secure entropy from multiple sources
# For production ZK proof key generation

echo "===== Generating Secure Entropy (macOS) ====="

# Initialize entropy
entropy=""

# Function to get hash on macOS
get_hash() {
    echo -n "$1" | openssl dgst -sha256 | cut -d' ' -f2
}

# Source 1: System random (cryptographically secure)
entropy="${entropy}$(head -c 32 /dev/urandom | base64)"

# Source 2: Current time with nanosecond precision
entropy="${entropy}$(date +%s%N | openssl dgst -sha256 | cut -d' ' -f2)"

# Source 3: System state
entropy="${entropy}$(ps aux | openssl dgst -sha256 | cut -d' ' -f2)"

# Source 4: Current directory listing
entropy="${entropy}$(ls -la / | openssl dgst -sha256 | cut -d' ' -f2)"

# Source 5: Network interfaces
entropy="${entropy}$(ifconfig | openssl dgst -sha256 | cut -d' ' -f2)"

# Source 6: Memory statistics
entropy="${entropy}$(vm_stat | openssl dgst -sha256 | cut -d' ' -f2)"

# Generate multiple entropy values by hashing different combinations
ENTROPY_1=$(get_hash "${entropy}1")
ENTROPY_2=$(get_hash "${entropy}2")
ENTROPY_3=$(get_hash "${entropy}3")

# Generate final entropy with all sources combined
FINAL_ENTROPY=$(echo -n "${entropy}" | openssl dgst -sha512 | cut -d' ' -f2)

# Export for use in other scripts
export ENTROPY_1
export ENTROPY_2
export ENTROPY_3
export FINAL_ENTROPY

echo "✅ Secure entropy generated from multiple sources"
echo "🔐 Entropy values are cryptographically secure"