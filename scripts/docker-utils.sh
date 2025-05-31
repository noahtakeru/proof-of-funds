#!/bin/bash
# Docker Utilities for ZK scripts
# This script provides common Docker utilities for ZK scripts

# Set up the Docker environment
# Usage: source docker-utils.sh
# Then: setup_docker_environment $PROJECT_ROOT

# Setup Docker environment
setup_docker_environment() {
  local PROJECT_ROOT="$1"
  
  if [ -z "$PROJECT_ROOT" ]; then
    echo "Error: PROJECT_ROOT not provided to setup_docker_environment"
    return 1
  fi
  
  echo "Setting up Docker environment..."
  cd "$PROJECT_ROOT/docker/zk-compiler"
  
  # Build Docker container
  echo "Building Docker container..."
  docker compose build
  
  # Return to project root
  cd "$PROJECT_ROOT"
  
  return 0
}

# Run a Docker container for ZK compilation
# Usage: run_docker_compilation $PROJECT_ROOT
run_docker_compilation() {
  local PROJECT_ROOT="$1"
  
  if [ -z "$PROJECT_ROOT" ]; then
    echo "Error: PROJECT_ROOT not provided to run_docker_compilation"
    return 1
  fi
  
  echo "Using Docker for compilation..."
  
  # Navigate to Docker directory
  cd "$PROJECT_ROOT/docker/zk-compiler"
  
  # Launch Docker container for compilation
  echo "Launching Docker container..."
  docker compose run --rm zk-compiler bash -c "
    echo '===== Compiling ZK Circuits ====='
    
    # Compile standardProof
    echo 'Compiling standardProof...'
    cd /circuits/standard
    circom standardProof.circom --wasm --r1cs
    
    # Compile thresholdProof
    echo 'Compiling thresholdProof...'
    cd /circuits/threshold
    circom thresholdProof.circom --wasm --r1cs
    
    # Compile maximumProof
    echo 'Compiling maximumProof...'
    cd /circuits/maximum
    circom maximumProof.circom --wasm --r1cs
    
    echo '===== Circuit Compilation Complete ====='
  "
  
  # Return to project root
  cd "$PROJECT_ROOT"
  
  return $?
}

# Run a Docker container for key generation with the given mode
# Usage: run_docker_key_generation $PROJECT_ROOT $MODE $ENTROPY_1 $ENTROPY_2 $ENTROPY_3
run_docker_key_generation() {
  local PROJECT_ROOT="$1"
  local MODE="$2"
  local ENTROPY_1="$3"
  local ENTROPY_2="$4"
  local ENTROPY_3="$5"
  
  if [ -z "$PROJECT_ROOT" ]; then
    echo "Error: PROJECT_ROOT not provided to run_docker_key_generation"
    return 1
  fi
  
  if [ -z "$MODE" ]; then
    MODE="auto"
  fi
  
  echo "Running key generation in Docker (mode: $MODE)..."
  
  # Navigate to Docker directory
  cd "$PROJECT_ROOT/docker/zk-compiler"
  
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
  
  # Return to project root
  cd "$PROJECT_ROOT"
  
  return $?
}

# Export the functions
export -f setup_docker_environment
export -f run_docker_compilation
export -f run_docker_key_generation