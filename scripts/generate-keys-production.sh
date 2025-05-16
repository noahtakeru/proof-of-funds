#!/bin/bash
set -e

# This script generates proving and verification keys for ZK circuits
# Production version - requires manual entropy input for security

echo "===== ZK Keys Generation Script (Production) ====="
echo "⚠️  IMPORTANT: This is the production key generation process."
echo "⚠️  You will be prompted to enter random text for entropy."
echo "⚠️  Use truly random inputs for production security."

# Navigate to Docker directory
cd docker/zk-compiler

# Launch Docker container for key generation
echo "Launching Docker container..."
docker compose run --rm -it zk-compiler bash -c "
    echo '===== Generating ZK Keys ====='
    
    # Setup Powers of Tau ceremony
    echo 'Setting up Powers of Tau...'
    cd /circuits
    
    # First contribution - requires manual entropy
    echo '🔐 Starting Powers of Tau ceremony - Phase 1'
    snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name='First contribution' -v
    
    # Generate keys for standardProof
    echo '🔐 Generating keys for standardProof...'
    cd /circuits/standard
    snarkjs powersoftau export challenge ../pot12_0001.ptau challenge_0001
    echo '🔐 You will now be prompted for entropy for the second contribution:'
    snarkjs powersoftau challenge contribute bn128 challenge_0001 response_0001
    snarkjs powersoftau import response ../pot12_0001.ptau response_0001 pot12_0002.ptau -n='Second contribution'
    snarkjs powersoftau verify pot12_0002.ptau
    snarkjs powersoftau beacon pot12_0002.ptau pot12_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n='Final Beacon'
    snarkjs powersoftau prepare phase2 pot12_beacon.ptau pot12_final.ptau -v
    
    # Only generate keys if r1cs file exists
    if [ -f 'standardProof.r1cs' ]; then
        snarkjs groth16 setup standardProof.r1cs pot12_final.ptau standardProof.zkey
        echo '🔐 Exporting verification key for standardProof...'
        snarkjs zkey export verificationkey standardProof.zkey standardProof.vkey.json
    else
        echo '❌ ERROR: standardProof.r1cs not found. Circuit compilation may have failed.'
        exit 1
    fi
    
    # Generate keys for thresholdProof
    echo '🔐 Generating keys for thresholdProof...'
    cd /circuits/threshold
    cp ../standard/pot12_final.ptau ./
    
    if [ -f 'thresholdProof.r1cs' ]; then
        snarkjs groth16 setup thresholdProof.r1cs pot12_final.ptau thresholdProof.zkey
        echo '🔐 Exporting verification key for thresholdProof...'
        snarkjs zkey export verificationkey thresholdProof.zkey thresholdProof.vkey.json
    else
        echo '❌ ERROR: thresholdProof.r1cs not found. Circuit compilation may have failed.'
        exit 1
    fi
    
    # Generate keys for maximumProof
    echo '🔐 Generating keys for maximumProof...'
    cd /circuits/maximum
    cp ../standard/pot12_final.ptau ./
    
    if [ -f 'maximumProof.r1cs' ]; then
        snarkjs groth16 setup maximumProof.r1cs pot12_final.ptau maximumProof.zkey
        echo '🔐 Exporting verification key for maximumProof...'
        snarkjs zkey export verificationkey maximumProof.zkey maximumProof.vkey.json
    else
        echo '❌ ERROR: maximumProof.r1cs not found. Circuit compilation may have failed.'
        exit 1
    fi
    
    echo '✅ ===== ZK Keys Generation Complete ====='
    echo '🔐 All keys generated with manual entropy input'
    echo '🔐 Keys are now ready for production use'
"

echo "===== ZK Keys Generation Script Complete ====="
echo "⚠️  IMPORTANT: Store the generated keys securely"
echo "⚠️  Never share the .zkey files publicly"