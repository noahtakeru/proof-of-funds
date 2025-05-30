#!/bin/bash
set -e

# Consolidated Secure Entropy Generation Script
# Supports both Linux and macOS with robust entropy collection
# Used for ZK proof key generation with production-grade security

# Parse arguments
PLATFORM="auto"
ENTROPY_COUNT=3
EXPORT=true

# Process command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --platform=*)
      PLATFORM="${1#*=}"
      shift
      ;;
    --count=*)
      ENTROPY_COUNT="${1#*=}"
      shift
      ;;
    --no-export)
      EXPORT=false
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --platform=<os>   Set platform: linux, macos, or auto (default: auto)"
      echo "  --count=<number>  Number of entropy values to generate (default: 3)"
      echo "  --no-export       Don't export entropy values as environment variables"
      echo "  --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Auto-detect platform if not specified
if [[ "$PLATFORM" == "auto" ]]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
  else
    PLATFORM="linux"
  fi
fi

echo "===== Generating Secure Entropy (${PLATFORM}) ====="
echo "🔐 Collecting entropy from multiple sources..."

# macOS entropy generation function
generate_macos_entropy() {
  entropy=""
  
  # Function to get hash on macOS
  get_hash() {
    echo -n "$1" | openssl dgst -sha256 | cut -d' ' -f2
  }
  
  # Source 1: System random (cryptographically secure)
  entropy="${entropy}$(head -c 32 /dev/urandom | base64)"
  
  # Source 2: Current time with nanosecond precision (fallback to seconds if not available)
  entropy="${entropy}$(date +%s%N 2>/dev/null || date +%s)"
  
  # Source 3: System state
  entropy="${entropy}$(ps aux | openssl dgst -sha256 | cut -d' ' -f2)"
  
  # Source 4: Current directory listing
  entropy="${entropy}$(ls -la / | openssl dgst -sha256 | cut -d' ' -f2)"
  
  # Source 5: Network interfaces
  entropy="${entropy}$(ifconfig | openssl dgst -sha256 | cut -d' ' -f2)"
  
  # Source 6: Memory statistics
  entropy="${entropy}$(vm_stat | openssl dgst -sha256 | cut -d' ' -f2)"
  
  # Source 7: Disk usage
  entropy="${entropy}$(df | openssl dgst -sha256 | cut -d' ' -f2)"
  
  # Source 8: Environment variables (hashed)
  entropy="${entropy}$(env | openssl dgst -sha256 | cut -d' ' -f2)"
  
  # Source 9: System profiler data (if available)
  if command -v system_profiler &> /dev/null; then
    entropy="${entropy}$(system_profiler SPHardwareDataType | openssl dgst -sha256 | cut -d' ' -f2)"
  fi
  
  # Mix everything with a final hash
  echo -n "${entropy}" | openssl dgst -sha512 | cut -d' ' -f2
}

# Linux entropy generation function
generate_linux_entropy() {
  entropy=""
  
  # Source 1: System random (cryptographically secure)
  entropy="${entropy}$(head -c 32 /dev/urandom | base64)"
  
  # Source 2: Current time with nanosecond precision
  entropy="${entropy}$(date +%s%N)"
  
  # Source 3: System state
  entropy="${entropy}$(ps aux | sha256sum | cut -d' ' -f1)"
  
  # Source 4: Network interfaces (MAC addresses)
  if command -v ifconfig &> /dev/null; then
    entropy="${entropy}$(ifconfig | grep -o '[0-9a-fA-F:]\{17\}' | sha256sum | cut -d' ' -f1)"
  elif command -v ip &> /dev/null; then
    entropy="${entropy}$(ip addr | grep -o '[0-9a-fA-F:]\{17\}' | sha256sum | cut -d' ' -f1)"
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
  
  # Source 9: Kernel parameters (if available)
  if [ -f /proc/sys/kernel/random/entropy_avail ]; then
    entropy="${entropy}$(cat /proc/sys/kernel/random/entropy_avail | sha256sum | cut -d' ' -f1)"
  fi
  
  # Mix everything with a final hash
  echo "${entropy}" | sha512sum | cut -d' ' -f1
}

# Generate entropy values based on platform
entropy_values=()
for i in $(seq 1 $ENTROPY_COUNT); do
  if [[ "$PLATFORM" == "macos" ]]; then
    entropy_values+=("$(generate_macos_entropy)")
  else
    entropy_values+=("$(generate_linux_entropy)")
  fi
  
  # Add small delay to ensure different system state for next value
  sleep 0.1
done

# Export entropy values if requested
if [[ "$EXPORT" == true ]]; then
  for i in $(seq 1 $ENTROPY_COUNT); do
    export "ENTROPY_$i"="${entropy_values[$((i-1))]}"
    echo "✅ Exported ENTROPY_$i environment variable"
  done
  
  # Also export a combined final entropy value
  combined=$(echo "${entropy_values[@]}" | tr ' ' '\n' | sort | tr -d '\n')
  if [[ "$PLATFORM" == "macos" ]]; then
    export FINAL_ENTROPY=$(echo -n "$combined" | openssl dgst -sha512 | cut -d' ' -f2)
  else
    export FINAL_ENTROPY=$(echo -n "$combined" | sha512sum | cut -d' ' -f1)
  fi
  echo "✅ Exported FINAL_ENTROPY environment variable"
else
  # Print entropy values if not exporting
  for i in $(seq 1 $ENTROPY_COUNT); do
    echo "ENTROPY_$i=${entropy_values[$((i-1))]}"
  done
  
  # Print combined final entropy
  combined=$(echo "${entropy_values[@]}" | tr ' ' '\n' | sort | tr -d '\n')
  if [[ "$PLATFORM" == "macos" ]]; then
    FINAL_ENTROPY=$(echo -n "$combined" | openssl dgst -sha512 | cut -d' ' -f2)
  else
    FINAL_ENTROPY=$(echo -n "$combined" | sha512sum | cut -d' ' -f1)
  fi
  echo "FINAL_ENTROPY=$FINAL_ENTROPY"
fi

echo "✅ Secure entropy generated from multiple sources"
echo "🔐 Entropy values are cryptographically secure"
echo "🔒 Sources include: system random, timestamps, system state, network config, hardware info"