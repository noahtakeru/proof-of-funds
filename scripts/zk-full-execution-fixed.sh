#!/bin/bash
set -e

echo "===== EXECUTING ZK PROOF IMPLEMENTATION PLAN ====="

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p packages/frontend/public/lib/zk/circuits

# First, fix the circuit files
echo "Fixing circuit files..."
cat > circuits/comparators.circom << 'EOF'
pragma circom 2.0.0;

/*
 * Comparator circuits for ZK proofs
 * Fixed version with proper scoping
 */

// Basic equality check for single bits
template EqualBit() {
    signal input a;
    signal input b;
    signal output out;
    
    out <== 1 - (a - b) * (a - b);
}

// Checks if a is less than b
template LessThan(n) {
    assert(n <= 252);
    signal input a[n];
    signal input b[n];
    signal output out;

    signal isLess[n+1];
    isLess[0] <== 0;

    component equalBit[n];
    signal equalSoFar[n+1];
    equalSoFar[0] <== 1;
    
    signal notA[n];
    signal diffBit[n];
    signal temp[n];
    
    for (var i = 0; i < n; i++) {
        equalBit[i] = EqualBit();
        equalBit[i].a <== a[n-1-i];
        equalBit[i].b <== b[n-1-i];
        
        equalSoFar[i+1] <== equalSoFar[i] * equalBit[i].out;
        
        // Break non-quadratic constraint into quadratic ones
        notA[i] <== 1 - a[n-1-i];
        diffBit[i] <== notA[i] * b[n-1-i];
        temp[i] <== equalSoFar[i] * diffBit[i];
        isLess[i+1] <== temp[i] + isLess[i];
    }

    out <== isLess[n];
}

// Checks if a is greater than or equal to b
template GreaterEqThan(n) {
    signal input a[n];
    signal input b[n];
    signal output out;

    component lt = LessThan(n);
    for (var i = 0; i < n; i++) {
        lt.a[i] <== b[i];
        lt.b[i] <== a[i];
    }

    component isEqual = IsEqual(n);
    for (var i = 0; i < n; i++) {
        isEqual.a[i] <== a[i];
        isEqual.b[i] <== b[i];
    }

    out <== lt.out + isEqual.out;
}

// Checks if a equals b
template IsEqual(n) {
    signal input a[n];
    signal input b[n];
    signal output out;

    signal equal[n];
    for (var i = 0; i < n; i++) {
        equal[i] <== 1 - (a[i] - b[i]) * (a[i] - b[i]);
    }

    signal product[n+1];
    product[0] <== 1;
    for (var i = 0; i < n; i++) {
        product[i+1] <== product[i] * equal[i];
    }

    out <== product[n];
}
EOF

cat > circuits/bitify.circom << 'EOF'
pragma circom 2.0.0;

/*
 * Binary conversion utilities for ZK proofs
 */

// Converts a number to its binary representation
template Num2Bits(n) {
    assert(n <= 252);
    signal input in;
    signal output out[n];

    var value = in;
    for (var i = 0; i < n; i++) {
        out[i] <-- (value >> i) & 1;
        value = value >> 1;
    }

    // Verify the decomposition
    signal accum[n+1];
    accum[0] <== 0;
    signal powerOf2[n];
    
    for (var i = 0; i < n; i++) {
        // Verify each bit is binary
        out[i] * (out[i] - 1) === 0;
        
        // Calculate power of 2
        if (i == 0) {
            powerOf2[i] <== 1;
        } else {
            powerOf2[i] <== powerOf2[i-1] * 2;
        }
        
        accum[i+1] <== accum[i] + out[i] * powerOf2[i];
    }

    accum[n] === in;
}

// Converts binary representation back to a number
template Bits2Num(n) {
    assert(n <= 252);
    signal input in[n];
    signal output out;

    signal powerOf2[n];
    signal accum[n+1];
    accum[0] <== 0;
    
    for (var i = 0; i < n; i++) {
        if (i == 0) {
            powerOf2[i] <== 1;
        } else {
            powerOf2[i] <== powerOf2[i-1] * 2;
        }
        
        accum[i+1] <== accum[i] + in[i] * powerOf2[i];
    }

    out <== accum[n];
}
EOF

# Fix main circuit files for proper constraint handling
cat > circuits/standard/standardProof.circom << 'EOF'
pragma circom 2.0.0;

include "../comparators.circom";
include "../bitify.circom";

template BalanceVerifier() {
    signal input balance;
    signal input threshold;
    signal input userAddress;
    
    signal output valid;
    
    // Convert to bits for comparison
    component balanceBits = Num2Bits(252);
    balanceBits.in <== balance;
    
    component thresholdBits = Num2Bits(252);
    thresholdBits.in <== threshold;
    
    // Check if balance >= threshold
    component gte = GreaterEqThan(252);
    for (var i = 0; i < 252; i++) {
        gte.a[i] <== balanceBits.out[i];
        gte.b[i] <== thresholdBits.out[i];
    }
    
    valid <== gte.out;
}

component main = BalanceVerifier();
EOF

cat > circuits/threshold/thresholdProof.circom << 'EOF'
pragma circom 2.0.0;

include "../comparators.circom";
include "../bitify.circom";

template ThresholdVerifier() {
    signal input totalBalance;
    signal input threshold;
    signal input userAddress;
    signal input networkId;
    
    signal output valid;
    
    // Convert to bits for comparison
    component balanceBits = Num2Bits(252);
    balanceBits.in <== totalBalance;
    
    component thresholdBits = Num2Bits(252);
    thresholdBits.in <== threshold;
    
    // Check if totalBalance >= threshold
    component gte = GreaterEqThan(252);
    for (var i = 0; i < 252; i++) {
        gte.a[i] <== balanceBits.out[i];
        gte.b[i] <== thresholdBits.out[i];
    }
    
    valid <== gte.out;
}

component main = ThresholdVerifier();
EOF

cat > circuits/maximum/maximumProof.circom << 'EOF'
pragma circom 2.0.0;

include "../comparators.circom";
include "../bitify.circom";

template MaximumVerifier() {
    signal input maxBalance;
    signal input threshold;
    signal input userAddress;
    signal input networks[4];
    
    signal output valid;
    
    // Convert to bits for comparison
    component balanceBits = Num2Bits(252);
    balanceBits.in <== maxBalance;
    
    component thresholdBits = Num2Bits(252);
    thresholdBits.in <== threshold;
    
    // Check if maxBalance >= threshold
    component gte = GreaterEqThan(252);
    for (var i = 0; i < 252; i++) {
        gte.a[i] <== balanceBits.out[i];
        gte.b[i] <== thresholdBits.out[i];
    }
    
    valid <== gte.out;
}

component main = MaximumVerifier();
EOF

# Set up Docker environment
echo "Setting up Docker environment..."
cd docker/zk-compiler

# Build Docker container
docker compose build

# Compile circuits
echo "Compiling circuits..."
docker compose run --rm zk-compiler bash -c '
cd /circuits

echo "===== Compiling ZK Circuits ====="

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

echo "===== Circuit Compilation Complete ====="
'

# Generate keys with automation
echo "Generating proving keys..."
./scripts/generate-keys-auto.sh

# Deploy to frontend
echo "Deploying to frontend..."
./scripts/deploy-circuits.sh

# Run basic tests
echo "Running basic tests..."
if [ -f tests/zk-proofs/test-wasm-integrity.js ]; then
    node tests/zk-proofs/test-wasm-integrity.js
fi

echo "===== ZK Proof Implementation Complete ====="
echo "Run 'node tests/zk-proofs/generate-verify-proof.js' to test proof generation"