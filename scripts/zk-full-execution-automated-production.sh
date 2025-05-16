#!/bin/bash
set -e

echo "===== EXECUTING ZK PROOF IMPLEMENTATION PLAN (AUTOMATED PRODUCTION) ====="
echo "🔐 This is the PRODUCTION version with automated secure entropy"
echo "🔐 No manual input required - using cryptographically secure sources"

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p packages/frontend/public/lib/zk/circuits

# Set up Docker environment
echo "Setting up Docker environment..."
cd docker/zk-compiler

# Build Docker container
echo "Building Docker container..."
docker compose build

# Return to project root
cd ../..

# Compile circuits
echo "Compiling circuits..."
./scripts/compile-circuits.sh

# Generate keys with automated secure entropy
echo "Generating proving keys with secure entropy..."
chmod +x scripts/generate-secure-entropy.sh
chmod +x scripts/generate-keys-automated-secure.sh
./scripts/generate-keys-automated-secure.sh

# Deploy to frontend
echo "Deploying to frontend..."
./scripts/deploy-circuits.sh

# Verify deployment
echo "Verifying deployment..."
echo "Checking for required files..."

# Check if all required files exist
REQUIRED_FILES=(
    "packages/frontend/public/lib/zk/circuits/standardProof.wasm"
    "packages/frontend/public/lib/zk/circuits/standardProof.zkey"
    "packages/frontend/public/lib/zk/circuits/standardProof.vkey.json"
    "packages/frontend/public/lib/zk/circuits/thresholdProof.wasm"
    "packages/frontend/public/lib/zk/circuits/thresholdProof.zkey"
    "packages/frontend/public/lib/zk/circuits/thresholdProof.vkey.json"
    "packages/frontend/public/lib/zk/circuits/maximumProof.wasm"
    "packages/frontend/public/lib/zk/circuits/maximumProof.zkey"
    "packages/frontend/public/lib/zk/circuits/maximumProof.vkey.json"
)

ALL_FILES_EXIST=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing: $file"
        ALL_FILES_EXIST=false
    else
        echo "✅ Found: $file"
    fi
done

if [ "$ALL_FILES_EXIST" = true ]; then
    echo "✅ All required files are in place"
    echo "===== ZK Proof Implementation Complete (AUTOMATED PRODUCTION) ====="
    echo "🔐 System is ready for production use"
    echo "🔐 Keys generated with secure automated entropy"
    echo "📝 See SECURE-ENTROPY-GENERATION.md for entropy details"
else
    echo "❌ Some files are missing. Please check the build process."
    exit 1
fi