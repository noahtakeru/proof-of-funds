#!/bin/bash
set -e

# Secure entropy generation for production use
# Uses multiple sources of randomness to ensure cryptographic security

echo "===== Generating Secure Entropy ====="

# Function to generate secure entropy from multiple sources
generate_entropy() {
    local entropy=""
    
    # Source 1: System random (cryptographically secure)
    entropy="${entropy}$(head -c 32 /dev/urandom | base64)"
    
    # Source 2: Current time with nanosecond precision
    entropy="${entropy}$(date +%s%N)"
    
    # Source 3: System state
    entropy="${entropy}$(ps aux | sha256sum | cut -d' ' -f1)"
    
    # Source 4: Network interfaces (MAC addresses)
    if command -v ifconfig &> /dev/null; then
        entropy="${entropy}$(ifconfig | grep -o '[0-9a-fA-F:]\{17\}' | sha256sum | cut -d' ' -f1)"
    fi
    
    # Source 5: CPU info
    if [ -f /proc/cpuinfo ]; then
        entropy="${entropy}$(cat /proc/cpuinfo | sha256sum | cut -d' ' -f1)"
    fi
    
    # Source 6: Memory state
    if command -v free &> /dev/null; then
        entropy="${entropy}$(free | sha256sum | cut -d' ' -f1)"
    fi
    
    # Source 7: Disk usage
    entropy="${entropy}$(df | sha256sum | cut -d' ' -f1)"
    
    # Source 8: Environment variables (hashed)
    entropy="${entropy}$(env | sha256sum | cut -d' ' -f1)"
    
    # Final mixing with SHA-512 for maximum entropy
    echo "${entropy}" | sha512sum | cut -d' ' -f1
}

# Generate multiple entropy values
ENTROPY_1=$(generate_entropy)
sleep 0.1  # Small delay to ensure different system state
ENTROPY_2=$(generate_entropy)
sleep 0.1
ENTROPY_3=$(generate_entropy)

# Export for use in other scripts
export ENTROPY_1
export ENTROPY_2
export ENTROPY_3

echo "✅ Secure entropy generated from multiple sources"
echo "🔐 Entropy values are cryptographically secure"