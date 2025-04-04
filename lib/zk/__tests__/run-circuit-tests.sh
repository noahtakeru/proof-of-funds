#!/bin/bash
# Circuit-specific Tests Runner
# This script runs just the circuit-specific tests

# Clear terminal
clear

# Set the directory to this script's location
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Running ZK Circuit Tests ==="
echo ""

# Run tests with environment setup for ES modules
export NODE_OPTIONS=--experimental-vm-modules

# Run the individual tests directly with Node.js
echo "Testing Standard Proof Circuit..."
node --experimental-vm-modules --experimental-specifier-resolution=node $(which jest) circuits/standardProof.test.js --testEnvironment=node

echo ""
echo "Testing Threshold Proof Circuit..."
node --experimental-vm-modules --experimental-specifier-resolution=node $(which jest) circuits/thresholdProof.test.js --testEnvironment=node

echo ""
echo "Testing Maximum Proof Circuit..."
node --experimental-vm-modules --experimental-specifier-resolution=node $(which jest) circuits/maximumProof.test.js --testEnvironment=node

echo ""
echo "All circuit tests completed."