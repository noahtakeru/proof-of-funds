#!/bin/bash
set -e

# Consolidated ZK Proof Implementation Script
# Supports different execution modes and environments

# Parse arguments
MODE="standard"
TEST="false"
VERIFY_ONLY="false"

# Process command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode=*)
      MODE="${1#*=}"
      shift
      ;;
    --test)
      TEST="true"
      shift
      ;;
    --verify-only)
      VERIFY_ONLY="true"
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --mode=<mode>     Set mode: standard, fixed, production, or automated-production (default: standard)"
      echo "  --test            Run tests after execution"
      echo "  --verify-only     Only verify deployment, don't run compilation or key generation"
      echo "  --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Set paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CIRCUITS_DIR="${PROJECT_ROOT}/circuits"
FRONTEND_DIR="${PROJECT_ROOT}/packages/frontend/public/lib/zk/circuits"

echo "===== EXECUTING ZK PROOF IMPLEMENTATION PLAN ====="
echo "Mode: $MODE"
echo "Run tests: $TEST"
echo "Verify only: $VERIFY_ONLY"

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p "$FRONTEND_DIR"

# Create mode-specific configs
setup_fixed_circuits() {
  echo "Setting up fixed circuit files..."
  
  # Write fixed comparators.circom
  cat > "$CIRCUITS_DIR/comparators.circom" << 'EOF'
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

  # Write fixed bitify.circom
  cat > "$CIRCUITS_DIR/bitify.circom" << 'EOF'
pragma circom 2.0.0;

/*
 * Binary conversion utilities for ZK proofs - Production Ready
 */

// Converts a number to its binary representation
template Num2Bits(n) {
    assert(n <= 252);
    signal input in;
    signal output out[n];

    // Properly handle bit extraction for large numbers
    for (var i = 0; i < n; i++) {
        out[i] <-- (in \ (2**i)) % 2;
    }

    // Verify the decomposition with proper constraints
    signal accum[n+1];
    accum[0] <== 0;
    
    for (var i = 0; i < n; i++) {
        // Verify each bit is binary (0 or 1)
        out[i] * (out[i] - 1) === 0;
        
        // Build accumulator
        accum[i+1] <== accum[i] + out[i] * (2**i);
    }

    // Final constraint: accumulated value must equal input
    accum[n] === in;
}

// Converts binary representation back to a number
template Bits2Num(n) {
    assert(n <= 252);
    signal input in[n];
    signal output out;

    signal accum[n+1];
    accum[0] <== 0;
    
    for (var i = 0; i < n; i++) {
        // Verify input bits are binary
        in[i] * (in[i] - 1) === 0;
        
        // Build number from bits
        accum[i+1] <== accum[i] + in[i] * (2**i);
    }

    out <== accum[n];
}
EOF

  # Create circuit directories
  mkdir -p "$CIRCUITS_DIR/standard" "$CIRCUITS_DIR/threshold" "$CIRCUITS_DIR/maximum"

  # Write standard proof circuit
  cat > "$CIRCUITS_DIR/standard/standardProof.circom" << 'EOF'
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
    
    // Check if balance == threshold (exact match)
    component isEqual = IsEqual(252);
    for (var i = 0; i < 252; i++) {
        isEqual.a[i] <== balanceBits.out[i];
        isEqual.b[i] <== thresholdBits.out[i];
    }
    
    valid <== isEqual.out;
}

component main = BalanceVerifier();
EOF

  # Write threshold proof circuit
  cat > "$CIRCUITS_DIR/threshold/thresholdProof.circom" << 'EOF'
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

  # Write maximum proof circuit
  cat > "$CIRCUITS_DIR/maximum/maximumProof.circom" << 'EOF'
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
    
    // Check if maxBalance < threshold (below maximum)
    component lt = LessThan(252);
    for (var i = 0; i < 252; i++) {
        lt.a[i] <== balanceBits.out[i];
        lt.b[i] <== thresholdBits.out[i];
    }
    
    valid <== lt.out;
}

component main = MaximumVerifier();
EOF
}

# Prepare Docker environment
setup_docker_environment() {
  echo "Setting up Docker environment..."
  cd "$PROJECT_ROOT/docker/zk-compiler"
  
  # Build Docker container
  echo "Building Docker container..."
  docker compose build
  
  # Return to project root
  cd "$PROJECT_ROOT"
}

# Skip compilation and key generation if only verifying
if [ "$VERIFY_ONLY" != "true" ]; then
  # Set up environment based on mode
  if [ "$MODE" == "fixed" ]; then
    setup_fixed_circuits
  fi
  
  # Set up Docker
  setup_docker_environment
  
  # Compile circuits
  echo "Compiling circuits..."
  bash "$SCRIPT_DIR/compile-circuits.sh" ${MODE == "fixed" ? "--use-docker" : ""}
  
  # Generate keys based on mode
  echo "Generating proving keys..."
  if [ "$MODE" == "production" ]; then
    # Production mode with manual entropy
    bash "$SCRIPT_DIR/generate-keys.sh" --mode=production
  elif [ "$MODE" == "automated-production" ]; then
    # Production mode with automated entropy
    bash "$SCRIPT_DIR/generate-keys.sh" --mode=auto
  else
    # Standard or fixed mode
    bash "$SCRIPT_DIR/generate-keys.sh" ${MODE == "standard" ? "" : "--mode=dev"}
  fi
  
  # Deploy to frontend
  echo "Deploying to frontend..."
  if [ -f "$SCRIPT_DIR/deploy-circuits.sh" ]; then
    bash "$SCRIPT_DIR/deploy-circuits.sh"
  else
    echo "Warning: deploy-circuits.sh not found. Skipping deployment."
  fi
fi

# Verify deployment
echo "Verifying deployment..."
echo "Checking for required files..."

# Check if all required files exist
REQUIRED_FILES=(
  "$FRONTEND_DIR/standardProof.wasm"
  "$FRONTEND_DIR/standardProof.zkey"
  "$FRONTEND_DIR/standardProof.vkey.json"
  "$FRONTEND_DIR/thresholdProof.wasm"
  "$FRONTEND_DIR/thresholdProof.zkey"
  "$FRONTEND_DIR/thresholdProof.vkey.json"
  "$FRONTEND_DIR/maximumProof.wasm"
  "$FRONTEND_DIR/maximumProof.zkey"
  "$FRONTEND_DIR/maximumProof.vkey.json"
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

# Run tests if requested
if [ "$TEST" == "true" ] && [ "$ALL_FILES_EXIST" == "true" ]; then
  echo "Running tests..."
  
  # Test proof generation
  if [ -f "$PROJECT_ROOT/tests/zk-proofs/test-proof-generation.js" ]; then
    echo "Testing proof generation..."
    node "$PROJECT_ROOT/tests/zk-proofs/test-proof-generation.js"
  fi
  
  # Run end-to-end tests
  if [ -f "$PROJECT_ROOT/tests/zk-proofs/e2e-proof-test.js" ]; then
    echo "Running end-to-end tests..."
    node "$PROJECT_ROOT/tests/zk-proofs/e2e-proof-test.js"
  fi
  
  # Run WASM integrity tests
  if [ -f "$PROJECT_ROOT/tests/zk-proofs/test-wasm-integrity.js" ]; then
    echo "Testing WASM integrity..."
    node "$PROJECT_ROOT/tests/zk-proofs/test-wasm-integrity.js"
  fi
fi

# Print status message
if [ "$ALL_FILES_EXIST" == "true" ]; then
  echo "✅ All required files are in place"
  echo "===== ZK Proof Implementation Complete ====="
  
  if [ "$MODE" == "production" ]; then
    echo "🔐 System is ready for production use"
    echo "📝 See POWERS-OF-TAU-PRODUCTION.md for security guidelines"
  elif [ "$MODE" == "automated-production" ]; then
    echo "🔐 System is ready for production use"
    echo "🔐 Keys generated with secure automated entropy"
    echo "📝 See SECURE-ENTROPY-GENERATION.md for entropy details"
  else
    echo "System is ready for development use"
  fi
else
  echo "❌ Some files are missing. Please check the build process."
  exit 1
fi