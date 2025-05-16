#!/bin/bash

# Setup script for ZK dependencies
# Installs the necessary dependencies for ZK proof generation

echo "Setting up ZK dependencies..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is required but not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is required but not installed. Please install npm first."
    exit 1
fi

echo "Installing required global packages..."

# Install circom compiler
echo "Installing circom..."
npm install -g circom

# Install snarkjs
echo "Installing snarkjs..."
npm install -g snarkjs

echo "Installing project dependencies..."
npm install snarkjs@0.7.0 --save

echo "ZK dependencies setup complete!"
echo "You can now run 'node scripts/compile-circuits.js' to compile the ZK circuits."