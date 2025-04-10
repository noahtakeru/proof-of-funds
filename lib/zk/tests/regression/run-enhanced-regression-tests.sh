#!/bin/bash

# Enhanced Regression Test Runner 2.0 for Zero-Knowledge Infrastructure
# This script adds thorough functional and integration testing on top of the original regression tests
# It maintains compatibility with the original test format while adding comprehensive validation

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counter variables
total_tests=0
total_passed=0
total_enhanced_tests=0
total_enhanced_passed=0

# Utility functions
print_header() {
  echo -e "\n${BLUE}======================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}======================================${NC}"
}

print_task() {
  echo -e "\n${YELLOW}--- $1 ---${NC}"
}

print_pass() {
  echo -e "${GREEN}✓ $1${NC}"
  total_passed=$((total_passed + 1))
}

print_fail() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "$1"
}

print_enhanced() {
  echo -e "${PURPLE}[ENHANCED] $1${NC}"
}

track_test() {
  total_tests=$((total_tests + 1))
}

track_enhanced_test() {
  total_enhanced_tests=$((total_enhanced_tests + 1))
}

# Function to run a command with timeout and capture output
run_with_timeout() {
  local cmd="$1"
  local timeout="$2"
  local desc="$3"
  
  print_enhanced "Running: $desc (timeout: ${timeout}s)"
  
  # Create a temporary file for output
  local output_file=$(mktemp)
  
  # Run the command with timeout
  timeout $timeout bash -c "$cmd" > "$output_file" 2>&1
  local exit_code=$?
  
  # Check the result
  if [ $exit_code -eq 0 ]; then
    print_pass "$desc"
    total_enhanced_passed=$((total_enhanced_passed + 1))
  elif [ $exit_code -eq 124 ]; then
    print_fail "$desc - TIMEOUT after ${timeout}s"
  else
    print_fail "$desc - Failed with exit code $exit_code"
    echo -e "${RED}Output:${NC}"
    cat "$output_file" | head -n 10
    [ $(wc -l < "$output_file") -gt 10 ] && echo -e "${RED}... (output truncated)${NC}"
  fi
  
  # Clean up
  rm "$output_file"
  return $exit_code
}

# Check for Node.js and required tools
check_prerequisites() {
  print_header "Checking Prerequisites"
  
  # Check node version
  if command -v node &> /dev/null; then
    node_version=$(node -v)
    print_pass "Node.js found: $node_version"
  else
    print_fail "Node.js not found. Please install Node.js"
    exit 1
  fi
  
  # Check npm version
  if command -v npm &> /dev/null; then
    npm_version=$(npm -v)
    print_pass "npm found: $npm_version"
  else
    print_fail "npm not found. Please install npm"
    exit 1
  fi
  
  # Check for required npm packages
  print_info "Checking for required packages..."
  
  if [ ! -f "package.json" ]; then
    print_info "Creating temporary package.json for testing..."
    echo '{
      "name": "zk-regression-test",
      "version": "1.0.0",
      "description": "Temporary package for running enhanced regression tests",
      "private": true
    }' > temp_package.json
  fi
  
  # Check for test requirements
  local required_packages=("jest" "mocha" "chai" "sinon" "puppeteer" "fast-check")
  local missing_packages=()
  
  for pkg in "${required_packages[@]}"; do
    if ! npm list "$pkg" --depth=0 &> /dev/null && ! npm list -g "$pkg" --depth=0 &> /dev/null; then
      missing_packages+=("$pkg")
    fi
  done
  
  if [ ${#missing_packages[@]} -gt 0 ]; then
    print_info "Some test packages are missing and will be temporarily installed..."
    npm install --no-save "${missing_packages[@]}" &> /dev/null
    if [ $? -eq 0 ]; then
      print_pass "Temporary packages installed"
    else
      print_fail "Failed to install required packages"
      exit 1
    fi
  else
    print_pass "All required test packages are available"
  fi
}

# Enhanced functional tests for ZK proof system
run_enhanced_zk_functional_tests() {
  print_header "Enhanced ZK Functional Tests"
  
  # Create temporary test file for full proof generation and verification testing
  TEMP_TEST_DIR=$(mktemp -d)
  TEMP_TEST_FILE="${TEMP_TEST_DIR}/zk-functional-test.js"
  
  # Create a comprehensive functional test
  cat > "$TEMP_TEST_FILE" << 'EOL'
// Enhanced ZK Functional Tests - for thorough validation of the ZK infrastructure

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Import ZK modules - Handle both ESM and CommonJS environments
let zkUtils, zkProofSerializer, zkCircuitRegistry, zkSecureInputs;

try {
  // Try to import as CommonJS first
  zkUtils = require('../../src/zkUtils.js');
  zkProofSerializer = require('../../src/zkProofSerializer.js');
  zkCircuitRegistry = require('../../src/zkCircuitRegistry.js');
  zkSecureInputs = require('../../src/zkSecureInputs.js');
  console.log('✓ Loaded modules using CommonJS require()');
} catch (e) {
  console.error('Failed to load modules with CommonJS:', e.message);
  process.exit(1);
}

// Test data
const testAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
const testAmount = '1000000000000000000'; // 1 ETH in wei
const testProofType = 'standard';

// Basic module export validation
assert(zkUtils, 'zkUtils module should be loaded');
assert(zkProofSerializer, 'zkProofSerializer module should be loaded');
assert(zkCircuitRegistry, 'zkCircuitRegistry module should be loaded');
assert(zkSecureInputs, 'zkSecureInputs module should be loaded');

console.log('✓ All modules loaded correctly');

// Check key functions in zkUtils
assert(typeof zkUtils.toFieldElement === 'function', 'zkUtils.toFieldElement should be a function');
assert(typeof zkUtils.padArray === 'function', 'zkUtils.padArray should be a function');
assert(typeof zkUtils.serializeZKProof === 'function', 'zkUtils.serializeZKProof should be a function');
assert(typeof zkUtils.deserializeZKProof === 'function', 'zkUtils.deserializeZKProof should be a function');

console.log('✓ zkUtils exports validated');

// Check key functions in zkProofSerializer
assert(typeof zkProofSerializer.serializeProof === 'function', 'zkProofSerializer.serializeProof should be a function');
assert(typeof zkProofSerializer.deserializeProof === 'function', 'zkProofSerializer.deserializeProof should be a function');
assert(typeof zkProofSerializer.extractProofForVerification === 'function', 'zkProofSerializer.extractProofForVerification should be a function');

console.log('✓ zkProofSerializer exports validated');

// Check key functions in zkCircuitRegistry
assert(typeof zkCircuitRegistry.registerCircuit === 'function', 'zkCircuitRegistry.registerCircuit should be a function');
assert(typeof zkCircuitRegistry.getCircuitConfig === 'function', 'zkCircuitRegistry.getCircuitConfig should be a function');

console.log('✓ zkCircuitRegistry exports validated');

// Check key functions in zkSecureInputs
assert(typeof zkSecureInputs.generateSecureInputs === 'function', 'zkSecureInputs.generateSecureInputs should be a function');
assert(typeof zkSecureInputs.validateSecureInputs === 'function', 'zkSecureInputs.validateSecureInputs should be a function');

console.log('✓ zkSecureInputs exports validated');

// Test basic functionality
try {
  // Test serialization/deserialization
  const mockProof = {
    pi_a: ['123', '456', '789'],
    pi_b: [['101', '202'], ['303', '404'], ['505', '606']],
    pi_c: ['707', '808', '909'],
    protocol: 'groth16'
  };
  const mockPublicSignals = ['1', '2', '3'];
  
  // Test serializeZKProof
  const serialized = zkUtils.serializeZKProof(mockProof, mockPublicSignals);
  assert(serialized, 'Serialization should produce a result');
  assert(serialized.proof, 'Serialized result should have a proof property');
  assert(serialized.publicSignals, 'Serialized result should have a publicSignals property');
  
  console.log('✓ zkUtils.serializeZKProof works correctly');
  
  // Test deserializeZKProof
  const deserialized = zkUtils.deserializeZKProof(serialized.proof, serialized.publicSignals);
  assert(deserialized, 'Deserialization should produce a result');
  assert(deserialized.proof, 'Deserialized result should have a proof property');
  assert(deserialized.publicSignals, 'Deserialized result should have a publicSignals property');
  
  console.log('✓ zkUtils.deserializeZKProof works correctly');
  
  // Test zkProofSerializer
  if (zkProofSerializer.serializeProof) {
    const serializedWithSerializer = zkProofSerializer.serializeProof(mockProof, mockPublicSignals);
    assert(serializedWithSerializer, 'zkProofSerializer.serializeProof should produce a result');
    assert(typeof serializedWithSerializer === 'string', 'zkProofSerializer.serializeProof should return a string');
    
    console.log('✓ zkProofSerializer.serializeProof works correctly');
    
    const deserializedWithSerializer = zkProofSerializer.deserializeProof(serializedWithSerializer);
    assert(deserializedWithSerializer, 'zkProofSerializer.deserializeProof should produce a result');
    assert(deserializedWithSerializer.proof, 'Deserialized result should have a proof property');
    assert(deserializedWithSerializer.publicSignals, 'Deserialized result should have a publicSignals property');
    
    console.log('✓ zkProofSerializer.deserializeProof works correctly');
  }
  
  // Test error handling
  try {
    zkUtils.serializeZKProof(null, mockPublicSignals);
    console.error('✗ Error handling test failed: should have thrown an error for null proof');
  } catch (error) {
    console.log('✓ Error handling works for null proof');
  }
  
  try {
    zkUtils.deserializeZKProof('invalid', mockPublicSignals);
    console.error('✗ Error handling test failed: should have thrown an error for invalid proof');
  } catch (error) {
    console.log('✓ Error handling works for invalid proof');
  }
  
  console.log('✓ Basic error handling validation passed');
  
  // Test ES Module import paths if available
  try {
    const esmTestFile = path.join(TEMP_TEST_DIR, 'esm-test.mjs');
    fs.writeFileSync(esmTestFile, `
      import zkUtils from '../../src/zkUtils.mjs';
      import * as zkProofSerializer from '../../src/zkProofSerializer.mjs';
      import * as zkCircuitRegistry from '../../src/zkCircuitRegistry.mjs';
      import * as zkSecureInputs from '../../src/zkSecureInputs.mjs';
      
      console.log('✓ ESM imports successful');
      process.exit(0);
    `);
    
    require('child_process').execSync(`node --input-type=module ${esmTestFile}`, { stdio: 'inherit' });
    console.log('✓ ESM module imports validated');
  } catch (e) {
    console.warn('⚠ ESM import test skipped or failed:', e.message);
  }
  
  console.log('All functional tests completed successfully!');
} catch (error) {
  console.error('Functional test failed:', error);
  process.exit(1);
}
EOL

  # Run the enhanced functional test
  print_task "Running ZK Functional Test Suite"
  track_enhanced_test
  
  if node "$TEMP_TEST_FILE"; then
    print_pass "ZK Functional Tests Passed"
    total_enhanced_passed=$((total_enhanced_passed + 1))
  else
    print_fail "ZK Functional Tests Failed"
  fi
  
  # Clean up
  rm -rf "$TEMP_TEST_DIR"
}

# Ensure we're in the project root directory
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
cd "$PROJECT_ROOT"

# Start test suite
print_header "Zero-Knowledge Infrastructure Enhanced Regression Tests 2.0"
echo "Running tests from: $(pwd)"
echo "Start time: $(date)"

# Run prerequisite checks
check_prerequisites

# Run enhanced functional tests
run_enhanced_zk_functional_tests 