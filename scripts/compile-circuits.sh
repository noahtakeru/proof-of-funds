#!/bin/bash
set -e

# Circuit Compilation Script (Consolidated Version)
# This script compiles ZK circuits with proper error handling and setup
# It can run either locally or in Docker based on the --use-docker flag

echo "===== ZK Circuit Compilation Script ====="

# Parse arguments
USE_DOCKER=false
if [[ "$1" == "--use-docker" ]]; then
    USE_DOCKER=true
fi

# Set paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CIRCUIT_DIR="$PROJECT_ROOT/packages/frontend/public/lib/zk/circuits"
BUILD_DIR="$CIRCUIT_DIR/build"

# Create build directory if it doesn't exist
mkdir -p "$BUILD_DIR"

# Check dependencies for local execution
check_dependencies() {
    # Check if circom is installed
    if ! command -v circom &> /dev/null; then
        echo "Error: circom is not installed. Please install it globally with:"
        echo "npm install -g circom"
        exit 1
    fi
    
    # Check if snarkjs is installed
    if ! command -v snarkjs &> /dev/null; then
        echo "Error: snarkjs is not installed. Please install it globally with:"
        echo "npm install -g snarkjs"
        exit 1
    fi
}

# Download Powers of Tau file (needed for the trusted setup)
download_powers_of_tau() {
    if [ ! -f "$BUILD_DIR/powersOfTau28_hez_final_10.ptau" ]; then
        echo "Downloading Powers of Tau file..."
        
        # Try primary source
        if ! curl -L -o "$BUILD_DIR/powersOfTau28_hez_final_10.ptau" https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau; then
            echo "Error downloading from primary source, trying alternative..."
            
            # Try alternative source
            if ! curl -L -o "$BUILD_DIR/powersOfTau28_hez_final_10.ptau" https://cloudflare-ipfs.com/ipfs/QmY3XTzMDsmn4KRRxHfXSDX1jKMh61Rb2wJEDXXYnLyU3w; then
                echo "Error downloading from alternative source."
                echo "Could not download Powers of Tau file from any source."
                exit 1
            fi
        fi
        
        # Verify the file size is reasonable (should be several MB)
        FILE_SIZE=$(wc -c < "$BUILD_DIR/powersOfTau28_hez_final_10.ptau")
        if [ "$FILE_SIZE" -lt 1000000 ]; then # Less than 1MB is suspicious
            echo "Downloaded file is suspiciously small: $FILE_SIZE bytes"
            echo "Powers of Tau file may be invalid. Please download it manually."
            exit 1
        fi
    fi
}

# Compile circuit locally
compile_circuit_local() {
    local CIRCUIT_NAME="$1"
    echo "Compiling circuit: $CIRCUIT_NAME"
    
    # Compile circuit to WebAssembly
    echo "Compiling $CIRCUIT_NAME to WebAssembly..."
    circom "$CIRCUIT_DIR/$CIRCUIT_NAME.circom" --wasm --output "$BUILD_DIR"
    
    # Generate proving key (zkey)
    echo "Generating proving key for $CIRCUIT_NAME..."
    snarkjs groth16 setup "$BUILD_DIR/$CIRCUIT_NAME.r1cs" "$BUILD_DIR/powersOfTau28_hez_final_10.ptau" "$BUILD_DIR/${CIRCUIT_NAME}_0.zkey"
    
    # Contribute to phase 2 of the ceremony
    echo "Contributing to ceremony for $CIRCUIT_NAME..."
    snarkjs zkey contribute "$BUILD_DIR/${CIRCUIT_NAME}_0.zkey" "$BUILD_DIR/$CIRCUIT_NAME.zkey" -n="First contribution" -e="random text for entropy"
    
    # Export verification key
    echo "Exporting verification key for $CIRCUIT_NAME..."
    snarkjs zkey export verificationkey "$BUILD_DIR/$CIRCUIT_NAME.zkey" "$BUILD_DIR/$CIRCUIT_NAME.vkey.json"
    
    # Copy build artifacts to the circuit directory
    echo "Copying build artifacts for $CIRCUIT_NAME..."
    cp "$BUILD_DIR/${CIRCUIT_NAME}_js/$CIRCUIT_NAME.wasm" "$CIRCUIT_DIR/$CIRCUIT_NAME.wasm"
    cp "$BUILD_DIR/$CIRCUIT_NAME.zkey" "$CIRCUIT_DIR/$CIRCUIT_NAME.zkey"
    cp "$BUILD_DIR/$CIRCUIT_NAME.vkey.json" "$CIRCUIT_DIR/$CIRCUIT_NAME.vkey.json"
    
    echo "Successfully compiled circuit: $CIRCUIT_NAME"
}

# Compile circuits using Docker
compile_with_docker() {
    echo "Using Docker for compilation..."
    
    # Navigate to Docker directory
    cd "$PROJECT_ROOT/docker/zk-compiler"
    
    # Build the Docker container if not already built
    echo "Building Docker container..."
    docker compose build
    
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
}

# Main execution
if [ "$USE_DOCKER" = true ]; then
    compile_with_docker
else
    check_dependencies
    download_powers_of_tau
    
    # Compile all circuits
    compile_circuit_local "standardProof"
    compile_circuit_local "thresholdProof"
    compile_circuit_local "maximumProof"
fi

echo "===== ZK Circuit Compilation Script Complete ====="