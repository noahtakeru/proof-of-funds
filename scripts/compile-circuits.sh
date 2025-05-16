#!/bin/bash
set -e

# This script compiles ZK circuits using the Docker environment
# It should be run from the project root directory

echo "===== ZK Circuit Compilation Script ====="

# Navigate to Docker directory
cd docker/zk-compiler

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

echo "===== ZK Circuit Compilation Script Complete ====="