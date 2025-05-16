#!/bin/bash
set -e

# This script generates proving and verification keys for ZK circuits
# Uses automated secure entropy generation for production use

echo "===== ZK Keys Generation Script (Automated Secure) ====="
echo "🔐 Generating cryptographically secure entropy automatically..."

# Generate secure entropy
source ./scripts/generate-secure-entropy.sh

# Navigate to Docker directory
cd docker/zk-compiler

# Launch Docker container for key generation
echo "Launching Docker container..."
docker compose run --rm zk-compiler bash -c "
    echo '===== Generating ZK Keys with Secure Entropy ====='
    
    # Setup Powers of Tau ceremony
    echo 'Setting up Powers of Tau...'
    cd /circuits
    
    # First contribution with secure entropy
    echo '🔐 Starting Powers of Tau ceremony with secure entropy'
    echo '$ENTROPY_1' | snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
    echo '$ENTROPY_2' | snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name='First contribution' -v
    
    # Generate keys for standardProof
    echo '🔐 Generating keys for standardProof...'
    cd /circuits/standard
    snarkjs powersoftau export challenge ../pot12_0001.ptau challenge_0001
    echo '$ENTROPY_3' | snarkjs powersoftau challenge contribute bn128 challenge_0001 response_0001
    snarkjs powersoftau import response ../pot12_0001.ptau response_0001 pot12_0002.ptau -n='Second contribution'
    snarkjs powersoftau verify pot12_0002.ptau
    
    # Use beacon with hash of all entropy sources for final randomness
    BEACON_HASH=\$(echo '$ENTROPY_1$ENTROPY_2$ENTROPY_3' | sha256sum | cut -d' ' -f1)
    snarkjs powersoftau beacon pot12_0002.ptau pot12_beacon.ptau \$BEACON_HASH 10 -n='Final Beacon'
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
    echo '🔐 All keys generated with secure automated entropy'
    echo '🔐 Keys are ready for production use'
"

echo "===== ZK Keys Generation Script Complete ====="
echo "🔐 Keys generated using multiple entropy sources:"
echo "  - System random (/dev/urandom)"
echo "  - High-precision timestamps"
echo "  - System state hashes"
echo "  - Network configuration"
echo "  - Hardware information"
echo "⚠️  Store the generated keys securely"
echo "⚠️  Never share the .zkey files publicly"