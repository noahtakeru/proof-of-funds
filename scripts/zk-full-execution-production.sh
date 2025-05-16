#!/bin/bash
set -e

echo "===== EXECUTING ZK PROOF IMPLEMENTATION PLAN (PRODUCTION) ====="
echo "⚠️  This is the PRODUCTION version - no mock or placeholder code"
echo "⚠️  You will need to provide manual entropy for key generation"

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

# Generate keys with production-ready process
echo "Generating proving keys (PRODUCTION)..."
echo "⚠️  You will be prompted for entropy - use truly random inputs!"
chmod +x scripts/generate-keys-production.sh
./scripts/generate-keys-production.sh

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
    echo "===== ZK Proof Implementation Complete (PRODUCTION) ====="
    echo "🔐 System is ready for production use"
    echo "📝 See POWERS-OF-TAU-PRODUCTION.md for security guidelines"
else
    echo "❌ Some files are missing. Please check the build process."
    exit 1
fi