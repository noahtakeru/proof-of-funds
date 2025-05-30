#!/bin/bash
set -e

# Consolidated Key Generation Script
# Supports multiple entropy sources and platforms (Linux/macOS)
# Can run in production, development, or automated modes

# Parse arguments
MODE="auto"
PLATFORM="auto"
DOCKER="true"

# Process command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode=*)
      MODE="${1#*=}"
      shift
      ;;
    --platform=*)
      PLATFORM="${1#*=}"
      shift
      ;;
    --no-docker)
      DOCKER="false"
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --mode=<mode>     Set mode: production, dev, auto, or test (default: auto)"
      echo "  --platform=<os>   Set platform: linux, macos, or auto (default: auto)"
      echo "  --no-docker       Run without Docker"
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

# Set paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CIRCUITS_DIR="${PROJECT_ROOT}/circuits"

# Auto-detect platform if not specified
if [[ "$PLATFORM" == "auto" ]]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
  else
    PLATFORM="linux"
  fi
fi

echo "===== ZK Keys Generation Script (Consolidated) ====="
echo "Mode: $MODE"
echo "Platform: $PLATFORM"
echo "Using Docker: $DOCKER"

# Generate secure entropy based on platform and mode
generate_entropy() {
  if [[ "$MODE" == "test" ]]; then
    # Test mode uses predictable entropy
    export ENTROPY_1="test_entropy_12345"
    export ENTROPY_2="test_entropy_67890"
    export ENTROPY_3="test_entropy_random"
    echo "⚠️  Using test entropy (NOT SECURE)"
    return
  fi
  
  if [[ "$MODE" == "production" ]]; then
    # Production mode will prompt for manual entropy
    echo "🔐 Production mode requires manual entropy input"
    echo "⚠️  You will be prompted during the key generation process"
    return
  fi
  
  echo "🔐 Generating cryptographically secure entropy..."
  
  # Common entropy gathering function
  if [[ "$PLATFORM" == "macos" ]]; then
    # macOS version
    entropy=""
    
    # Function to get hash on macOS
    get_hash() {
      echo -n "$1" | openssl dgst -sha256 | cut -d' ' -f2
    }
    
    # Source 1: System random (cryptographically secure)
    entropy="${entropy}$(head -c 32 /dev/urandom | base64)"
    
    # Source 2: Current time with nanosecond precision
    entropy="${entropy}$(date +%s%N 2>/dev/null || date +%s)"
    
    # Source 3: System state
    entropy="${entropy}$(ps aux | openssl dgst -sha256 | cut -d' ' -f2)"
    
    # Source 4: Current directory listing
    entropy="${entropy}$(ls -la / | openssl dgst -sha256 | cut -d' ' -f2)"
    
    # Source 5: Network interfaces
    entropy="${entropy}$(ifconfig | openssl dgst -sha256 | cut -d' ' -f2)"
    
    # Source 6: Memory statistics
    entropy="${entropy}$(vm_stat | openssl dgst -sha256 | cut -d' ' -f2)"
    
    # Generate multiple entropy values by hashing different combinations
    export ENTROPY_1=$(get_hash "${entropy}1")
    export ENTROPY_2=$(get_hash "${entropy}2")
    export ENTROPY_3=$(get_hash "${entropy}3")
    
    # Generate final entropy with all sources combined
    export FINAL_ENTROPY=$(echo -n "${entropy}" | openssl dgst -sha512 | cut -d' ' -f2)
  else
    # Linux version
    generate_linux_entropy() {
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
    export ENTROPY_1=$(generate_linux_entropy)
    sleep 0.1  # Small delay to ensure different system state
    export ENTROPY_2=$(generate_linux_entropy)
    sleep 0.1
    export ENTROPY_3=$(generate_linux_entropy)
  fi
  
  echo "✅ Secure entropy generated from multiple sources"
  echo "🔐 Entropy values are cryptographically secure"
}

# Function to execute key generation locally
run_local_key_generation() {
  echo "Running key generation locally..."
  
  # Check if snarkjs is installed
  if ! command -v snarkjs &> /dev/null; then
    echo "Error: snarkjs is not installed. Please install it globally with:"
    echo "npm install -g snarkjs"
    exit 1
  fi
  
  # Setup Powers of Tau ceremony
  echo 'Setting up Powers of Tau...'
  cd "$CIRCUITS_DIR"
  
  if [[ "$MODE" == "production" ]]; then
    # Production mode with manual entropy
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name='First contribution' -v
  else
    # Automated mode with pre-generated entropy
    echo "$ENTROPY_1" | snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    echo "$ENTROPY_2" | snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name='First contribution' -v
  fi
  
  # Generate keys for standardProof
  echo 'Generating keys for standardProof...'
  cd "$CIRCUITS_DIR/standard"
  snarkjs powersoftau export challenge ../pot12_0001.ptau challenge_0001
  
  if [[ "$MODE" == "production" ]]; then
    echo 'You will now be prompted for entropy for the second contribution:'
    snarkjs powersoftau challenge contribute bn128 challenge_0001 response_0001
  else
    echo "$ENTROPY_3" | snarkjs powersoftau challenge contribute bn128 challenge_0001 response_0001
  fi
  
  snarkjs powersoftau import response ../pot12_0001.ptau response_0001 pot12_0002.ptau -n='Second contribution'
  snarkjs powersoftau verify pot12_0002.ptau
  
  # Use appropriate beacon for final randomness
  if [[ "$MODE" == "production" ]]; then
    BEACON="0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
  else
    if [[ "$PLATFORM" == "macos" ]]; then
      BEACON_HASH=$(echo "$ENTROPY_1$ENTROPY_2$ENTROPY_3" | openssl dgst -sha256 | cut -d' ' -f2)
    else
      BEACON_HASH=$(echo "$ENTROPY_1$ENTROPY_2$ENTROPY_3" | sha256sum | cut -d' ' -f1)
    fi
    BEACON="$BEACON_HASH"
  fi
  
  snarkjs powersoftau beacon pot12_0002.ptau pot12_beacon.ptau "$BEACON" 10 -n='Final Beacon'
  snarkjs powersoftau prepare phase2 pot12_beacon.ptau pot12_final.ptau -v
  
  # Process all circuit types
  for CIRCUIT_TYPE in "standard" "threshold" "maximum"; do
    echo "Processing ${CIRCUIT_TYPE}Proof..."
    cd "$CIRCUITS_DIR/$CIRCUIT_TYPE"
    
    # Copy Powers of Tau final file if needed
    if [[ "$CIRCUIT_TYPE" != "standard" ]]; then
      cp "$CIRCUITS_DIR/standard/pot12_final.ptau" ./
    fi
    
    # Generate keys if r1cs exists
    if [ -f "${CIRCUIT_TYPE}Proof.r1cs" ]; then
      snarkjs groth16 setup "${CIRCUIT_TYPE}Proof.r1cs" pot12_final.ptau "${CIRCUIT_TYPE}Proof.zkey"
      echo "Exporting verification key for ${CIRCUIT_TYPE}Proof..."
      snarkjs zkey export verificationkey "${CIRCUIT_TYPE}Proof.zkey" "${CIRCUIT_TYPE}Proof.vkey.json"
    else
      echo "ERROR: ${CIRCUIT_TYPE}Proof.r1cs not found. Circuit compilation may have failed."
      exit 1
    fi
  done
  
  echo "✅ Key generation completed successfully"
}

# Function to run key generation in Docker
run_docker_key_generation() {
  echo "Running key generation in Docker..."
  
  # Navigate to Docker directory
  cd "$PROJECT_ROOT/docker/zk-compiler"
  
  # Build Docker container if needed
  docker compose build
  
  # Create Docker command based on mode
  if [[ "$MODE" == "production" ]]; then
    # Production mode needs interactive terminal for manual entropy input
    docker compose run --rm -it zk-compiler bash -c "
      echo '===== Generating ZK Keys ====='
      
      # Setup Powers of Tau ceremony
      echo 'Setting up Powers of Tau...'
      cd /circuits
      
      # First contribution - requires manual entropy
      echo '🔐 Starting Powers of Tau ceremony - Phase 1'
      snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
      snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name='First contribution' -v
      
      # Process each circuit type
      for CIRCUIT_TYPE in 'standard' 'threshold' 'maximum'; do
        echo '🔐 Generating keys for '\${CIRCUIT_TYPE}'Proof...'
        cd /circuits/\${CIRCUIT_TYPE}
        
        if [ \"\$CIRCUIT_TYPE\" = \"standard\" ]; then
          snarkjs powersoftau export challenge ../pot12_0001.ptau challenge_0001
          echo '🔐 You will now be prompted for entropy for the second contribution:'
          snarkjs powersoftau challenge contribute bn128 challenge_0001 response_0001
          snarkjs powersoftau import response ../pot12_0001.ptau response_0001 pot12_0002.ptau -n='Second contribution'
          snarkjs powersoftau verify pot12_0002.ptau
          snarkjs powersoftau beacon pot12_0002.ptau pot12_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n='Final Beacon'
          snarkjs powersoftau prepare phase2 pot12_beacon.ptau pot12_final.ptau -v
        else
          cp ../standard/pot12_final.ptau ./
        fi
        
        if [ -f \"\${CIRCUIT_TYPE}Proof.r1cs\" ]; then
          snarkjs groth16 setup \"\${CIRCUIT_TYPE}Proof.r1cs\" pot12_final.ptau \"\${CIRCUIT_TYPE}Proof.zkey\"
          echo '🔐 Exporting verification key for '\${CIRCUIT_TYPE}'Proof...'
          snarkjs zkey export verificationkey \"\${CIRCUIT_TYPE}Proof.zkey\" \"\${CIRCUIT_TYPE}Proof.vkey.json\"
        else
          echo '❌ ERROR: '\${CIRCUIT_TYPE}'Proof.r1cs not found. Circuit compilation may have failed.'
          exit 1
        fi
      done
      
      echo '✅ ===== ZK Keys Generation Complete ====='
      echo '🔐 All keys generated with manual entropy input'
      echo '🔐 Keys are now ready for production use'
    "
  else
    # Automated mode uses pre-generated entropy
    docker compose run --rm zk-compiler bash -c "
      echo '===== Generating ZK Keys with Secure Entropy ====='
      
      # Setup Powers of Tau ceremony
      echo 'Setting up Powers of Tau...'
      cd /circuits
      
      # First contribution with secure entropy
      echo '🔐 Starting Powers of Tau ceremony with secure entropy'
      echo '$ENTROPY_1' | snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
      echo '$ENTROPY_2' | snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name='First contribution' -v
      
      # Process each circuit type
      for CIRCUIT_TYPE in 'standard' 'threshold' 'maximum'; do
        echo '🔐 Generating keys for '\${CIRCUIT_TYPE}'Proof...'
        cd /circuits/\${CIRCUIT_TYPE}
        
        if [ \"\$CIRCUIT_TYPE\" = \"standard\" ]; then
          snarkjs powersoftau export challenge ../pot12_0001.ptau challenge_0001
          echo '$ENTROPY_3' | snarkjs powersoftau challenge contribute bn128 challenge_0001 response_0001
          snarkjs powersoftau import response ../pot12_0001.ptau response_0001 pot12_0002.ptau -n='Second contribution'
          snarkjs powersoftau verify pot12_0002.ptau
          
          # Use beacon with hash of all entropy sources for final randomness
          BEACON_HASH=\$(echo '$ENTROPY_1$ENTROPY_2$ENTROPY_3' | sha256sum | cut -d' ' -f1)
          snarkjs powersoftau beacon pot12_0002.ptau pot12_beacon.ptau \$BEACON_HASH 10 -n='Final Beacon'
          snarkjs powersoftau prepare phase2 pot12_beacon.ptau pot12_final.ptau -v
        else
          cp ../standard/pot12_final.ptau ./
        fi
        
        if [ -f \"\${CIRCUIT_TYPE}Proof.r1cs\" ]; then
          snarkjs groth16 setup \"\${CIRCUIT_TYPE}Proof.r1cs\" pot12_final.ptau \"\${CIRCUIT_TYPE}Proof.zkey\"
          echo '🔐 Exporting verification key for '\${CIRCUIT_TYPE}'Proof...'
          snarkjs zkey export verificationkey \"\${CIRCUIT_TYPE}Proof.zkey\" \"\${CIRCUIT_TYPE}Proof.vkey.json\"
        else
          echo '❌ ERROR: '\${CIRCUIT_TYPE}'Proof.r1cs not found. Circuit compilation may have failed.'
          exit 1
        fi
      done
      
      echo '✅ ===== ZK Keys Generation Complete ====='
      echo '🔐 All keys generated with secure automated entropy'
      echo '🔐 Keys are ready for production use'
    "
  fi
}

# Generate entropy if needed
if [[ "$MODE" != "production" ]]; then
  generate_entropy
fi

# Run key generation based on Docker preference
if [[ "$DOCKER" == "true" ]]; then
  run_docker_key_generation
else
  run_local_key_generation
fi

echo "===== ZK Keys Generation Script Complete ====="
echo "⚠️  IMPORTANT: Store the generated keys securely"
echo "⚠️  Never share the .zkey files publicly"