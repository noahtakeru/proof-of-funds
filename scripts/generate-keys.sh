#!/bin/bash
set -e

# This script generates proving and verification keys for ZK circuits
# It should be run from the project root directory

echo "===== ZK Keys Generation Script ====="

# Navigate to Docker directory
cd docker/zk-compiler

# Launch Docker container for key generation
echo "Launching Docker container..."
docker compose run --rm zk-compiler bash -c "
    echo '===== Generating ZK Keys ====='
    
    # Setup Powers of Tau ceremony
    echo 'Setting up Powers of Tau...'
    cd /circuits
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name='First contribution' -v
    
    # Generate keys for standardProof
    echo 'Generating keys for standardProof...'
    cd /circuits/standard
    snarkjs powersoftau export challenge pot12_0001.ptau challenge_0001
    snarkjs powersoftau challenge contribute challenge_0001 response_0001 -e='random entropy'
    snarkjs powersoftau import response pot12_0001.ptau response_0001 pot12_0002.ptau -n='Second contribution'
    snarkjs powersoftau verify pot12_0002.ptau
    snarkjs powersoftau beacon pot12_0002.ptau pot12_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n='Final Beacon'
    snarkjs powersoftau prepare phase2 pot12_beacon.ptau pot12_final.ptau -v
    snarkjs groth16 setup standardProof.r1cs pot12_final.ptau standardProof.zkey
    snarkjs zkey export verificationkey standardProof.zkey standardProof.vkey.json
    
    # Generate keys for thresholdProof
    echo 'Generating keys for thresholdProof...'
    cd /circuits/threshold
    cp ../standard/pot12_final.ptau ./
    snarkjs groth16 setup thresholdProof.r1cs pot12_final.ptau thresholdProof.zkey
    snarkjs zkey export verificationkey thresholdProof.zkey thresholdProof.vkey.json
    
    # Generate keys for maximumProof
    echo 'Generating keys for maximumProof...'
    cd /circuits/maximum
    cp ../standard/pot12_final.ptau ./
    snarkjs groth16 setup maximumProof.r1cs pot12_final.ptau maximumProof.zkey
    snarkjs zkey export verificationkey maximumProof.zkey maximumProof.vkey.json
    
    echo '===== ZK Keys Generation Complete ====='
"

echo "===== ZK Keys Generation Script Complete ====="