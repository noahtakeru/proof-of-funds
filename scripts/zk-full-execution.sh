#!/bin/bash
set -e

# ZK Proof Implementation - Full Execution Script
# This script executes the complete ZK proof implementation plan
# According to the rules, it uses no mock or placeholder code

echo "===== EXECUTING ZK PROOF IMPLEMENTATION PLAN ====="

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p docker/zk-compiler circuits/{standard,threshold,maximum}
mkdir -p packages/frontend/public/lib/zk/circuits
mkdir -p tests/zk-proofs

# Execute setup steps (Docker environment)
echo "Setting up Docker environment..."
cd docker/zk-compiler

if ! docker compose build; then
  echo "Docker build failed. Please make sure Docker is installed and running."
  exit 1
fi

# Return to project root
cd ../..

# Compile circuits
echo "Compiling circuits..."
bash scripts/compile-circuits.sh

# Generate proving keys
echo "Generating proving keys..."
bash scripts/generate-keys.sh

# Deploy to frontend
echo "Deploying to frontend..."
bash scripts/deploy-circuits.sh

# Test proof generation
echo "Testing proof generation..."
node tests/zk-proofs/test-proof-generation.js

# Run end-to-end tests
echo "Running end-to-end tests..."
node tests/zk-proofs/e2e-proof-test.js

echo "===== ZK PROOF IMPLEMENTATION COMPLETE ====="