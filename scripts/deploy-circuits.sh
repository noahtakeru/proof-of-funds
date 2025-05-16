#!/bin/bash
set -e

# This script deploys compiled circuits to the frontend
# It should be run from the project root directory

echo "===== ZK Circuit Deployment Script ====="

# Create deployment directory
echo "Creating deployment directory..."
mkdir -p packages/frontend/public/lib/zk/circuits

# Copy WebAssembly files
echo "Copying WebAssembly files..."
cp -v circuits/standard/standardProof_js/standardProof.wasm packages/frontend/public/lib/zk/circuits/standardProof.wasm
cp -v circuits/threshold/thresholdProof_js/thresholdProof.wasm packages/frontend/public/lib/zk/circuits/thresholdProof.wasm
cp -v circuits/maximum/maximumProof_js/maximumProof.wasm packages/frontend/public/lib/zk/circuits/maximumProof.wasm

# Copy zkey files
echo "Copying zkey files..."
cp -v circuits/standard/standardProof.zkey packages/frontend/public/lib/zk/circuits/standardProof.zkey
cp -v circuits/threshold/thresholdProof.zkey packages/frontend/public/lib/zk/circuits/thresholdProof.zkey
cp -v circuits/maximum/maximumProof.zkey packages/frontend/public/lib/zk/circuits/maximumProof.zkey

# Copy verification key files
echo "Copying verification key files..."
cp -v circuits/standard/standardProof.vkey.json packages/frontend/public/lib/zk/circuits/standardProof.vkey.json
cp -v circuits/threshold/thresholdProof.vkey.json packages/frontend/public/lib/zk/circuits/thresholdProof.vkey.json
cp -v circuits/maximum/maximumProof.vkey.json packages/frontend/public/lib/zk/circuits/maximumProof.vkey.json

# Copy helper circuits for reference
echo "Copying helper circuits..."
cp -v circuits/bitify.circom packages/frontend/public/lib/zk/circuits/bitify.circom
cp -v circuits/comparators.circom packages/frontend/public/lib/zk/circuits/comparators.circom
cp -v circuits/standard/standardProof.circom packages/frontend/public/lib/zk/circuits/standardProof.circom
cp -v circuits/threshold/thresholdProof.circom packages/frontend/public/lib/zk/circuits/thresholdProof.circom
cp -v circuits/maximum/maximumProof.circom packages/frontend/public/lib/zk/circuits/maximumProof.circom

echo "===== ZK Circuit Deployment Complete ====="