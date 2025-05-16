#!/bin/bash
set -e

echo "===== ZK Proof Implementation - Direct Installation ====="

# Check if circom and snarkjs are installed
if ! command -v circom &> /dev/null || ! command -v snarkjs &> /dev/null; then
    echo "Installing circom and snarkjs..."
    npm install -g circom@2.1.4 snarkjs@0.7.0
fi

echo "Creating necessary directories..."
mkdir -p circuits/standard circuits/threshold circuits/maximum
mkdir -p packages/frontend/public/lib/zk/circuits

echo "Compiling circuits..."
cd circuits

# Compile standardProof
echo "Compiling standardProof..."
cd standard
circom standardProof.circom --wasm --r1cs
cd ..

# Compile thresholdProof
echo "Compiling thresholdProof..."
cd threshold
circom thresholdProof.circom --wasm --r1cs
cd ..

# Compile maximumProof
echo "Compiling maximumProof..."
cd maximum
circom maximumProof.circom --wasm --r1cs
cd ..

echo "Generating proving keys..."
# Setup Powers of Tau ceremony
echo "Setting up Powers of Tau..."
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v

# Generate keys for standardProof
echo "Generating keys for standardProof..."
cd standard
cp ../pot12_0001.ptau .
snarkjs powersoftau export challenge pot12_0001.ptau challenge_0001
snarkjs powersoftau challenge contribute challenge_0001 response_0001 -e="random entropy"
snarkjs powersoftau import response pot12_0001.ptau response_0001 pot12_0002.ptau -n="Second contribution"
snarkjs powersoftau verify pot12_0002.ptau
snarkjs powersoftau beacon pot12_0002.ptau pot12_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
snarkjs powersoftau prepare phase2 pot12_beacon.ptau pot12_final.ptau -v
snarkjs groth16 setup standardProof.r1cs pot12_final.ptau standardProof.zkey
snarkjs zkey export verificationkey standardProof.zkey standardProof.vkey.json
cd ..

# Generate keys for thresholdProof
echo "Generating keys for thresholdProof..."
cd threshold
cp ../standard/pot12_final.ptau ./
snarkjs groth16 setup thresholdProof.r1cs pot12_final.ptau thresholdProof.zkey
snarkjs zkey export verificationkey thresholdProof.zkey thresholdProof.vkey.json
cd ..

# Generate keys for maximumProof
echo "Generating keys for maximumProof..."
cd maximum
cp ../standard/pot12_final.ptau ./
snarkjs groth16 setup maximumProof.r1cs pot12_final.ptau maximumProof.zkey
snarkjs zkey export verificationkey maximumProof.zkey maximumProof.vkey.json
cd ..

cd ..  # Back to project root

echo "Deploying to frontend..."
# Copy WebAssembly files
cp circuits/standard/standardProof_js/standardProof.wasm packages/frontend/public/lib/zk/circuits/
cp circuits/threshold/thresholdProof_js/thresholdProof.wasm packages/frontend/public/lib/zk/circuits/
cp circuits/maximum/maximumProof_js/maximumProof.wasm packages/frontend/public/lib/zk/circuits/

# Copy zkey files
cp circuits/standard/standardProof.zkey packages/frontend/public/lib/zk/circuits/
cp circuits/threshold/thresholdProof.zkey packages/frontend/public/lib/zk/circuits/
cp circuits/maximum/maximumProof.zkey packages/frontend/public/lib/zk/circuits/

# Copy verification key files
cp circuits/standard/standardProof.vkey.json packages/frontend/public/lib/zk/circuits/
cp circuits/threshold/thresholdProof.vkey.json packages/frontend/public/lib/zk/circuits/
cp circuits/maximum/maximumProof.vkey.json packages/frontend/public/lib/zk/circuits/

echo "===== ZK Proof Implementation Complete ====="
echo "Now run: node tests/zk-proofs/test-wasm-integrity.js"