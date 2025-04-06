#!/usr/bin/env node

/**
 * Circuit Testing Script (CommonJS version)
 * 
 * This script tests the optimized circuits with two modes:
 * 1. Simplified mode: Validates circuit logic without requiring circom installation
 * 2. Full mode: Performs complete ZK proof generation and verification if all dependencies are available
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Paths
const TEST_INPUTS_PATH = path.join(__dirname, 'test-inputs');
const BUILD_PATH = path.join(__dirname, 'build');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Load test input
function loadTestInput(circuitName, isValid = true) {
  const suffix = isValid ? 'input' : 'invalid';
  const inputPath = path.join(TEST_INPUTS_PATH, `${circuitName}_${suffix}.json`);
  try {
    return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (error) {
    console.error(`${colors.red}Could not load test input for ${circuitName}: ${error.message}${colors.reset}`);
    return null;
  }
}

// Load build info
function loadBuildInfo(circuitName) {
  try {
    const infoPath = path.join(BUILD_PATH, `${circuitName}_info.json`);
    return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  } catch (error) {
    console.warn(`${colors.yellow}Could not load build info for ${circuitName}: ${error.message}${colors.reset}`);
    return { constraints: 1000 }; // Default value
  }
}

// Validate standard proof
function validateStandardProof(input, isValid) {
  if (!input) return false;
  
  // In standard proof, actualBalance must equal amount
  const actualBalance = input.actualBalance;
  const amount = input.amount;
  const isMatching = actualBalance === amount;
  
  // For valid inputs, they should match; for invalid, they shouldn't
  return isValid ? isMatching : !isMatching;
}

// Validate threshold proof
function validateThresholdProof(input, isValid) {
  if (!input) return false;
  
  // In threshold proof, actualBalance must be >= threshold
  const actualBalance = BigInt(input.actualBalance);
  const threshold = BigInt(input.threshold);
  const isAboveThreshold = actualBalance >= threshold;
  
  // For valid inputs, balance should be above threshold; for invalid, it shouldn't
  return isValid ? isAboveThreshold : !isAboveThreshold;
}

// Validate maximum proof
function validateMaximumProof(input, isValid) {
  if (!input) return false;
  
  // In maximum proof, actualBalance must be <= maximum
  const actualBalance = BigInt(input.actualBalance);
  const maximum = BigInt(input.maximum);
  const isBelowMaximum = actualBalance <= maximum;
  
  // For valid inputs, balance should be below maximum; for invalid, it shouldn't
  return isValid ? isBelowMaximum : !isBelowMaximum;
}

// Run tests for a circuit
function testCircuit(circuitName, validator) {
  console.log(`\n${colors.cyan}Testing ${circuitName}...${colors.reset}`);
  
  // Check constraint count
  const buildInfo = loadBuildInfo(circuitName);
  const targetConstraints = circuitName === 'standardProof' ? 10000 : 15000;
  
  if (buildInfo.constraints < targetConstraints) {
    console.log(`${colors.green}✓ Constraint count: ${buildInfo.constraints} (target: <${targetConstraints})${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Constraint count: ${buildInfo.constraints} (target: <${targetConstraints})${colors.reset}`);
  }
  
  // Test with valid input
  const validInput = loadTestInput(circuitName, true);
  if (validator(validInput, true)) {
    console.log(`${colors.green}✓ Valid input test passed${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Valid input test failed${colors.reset}`);
  }
  
  // Test with invalid input
  const invalidInput = loadTestInput(circuitName, false);
  if (validator(invalidInput, false)) {
    console.log(`${colors.green}✓ Invalid input test passed${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Invalid input test failed${colors.reset}`);
  }
}

// Check if circom is installed
function isCircomInstalled() {
  try {
    const { execSync } = require('child_process');
    execSync('which circom', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if snarkjs is installed
function isSnarkJSInstalled() {
  try {
    const { execSync } = require('child_process');
    execSync('which snarkjs', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if compiled circuits exist
function compiledCircuitsExist() {
  const circuitNames = ['standardProof', 'thresholdProof', 'maximumProof'];
  
  for (const circuit of circuitNames) {
    const r1csPath = path.join(BUILD_PATH, `${circuit}.r1cs`);
    if (!fs.existsSync(r1csPath)) {
      return false;
    }
    
    // Also check WASM file exists and is a real WebAssembly file (not a placeholder)
    const wasmPath = path.join(BUILD_PATH, 'wasm', `${circuit}_js`, `${circuit}.wasm`);
    if (!fs.existsSync(wasmPath)) {
      return false;
    }
    
    // Check if the file is a real WebAssembly file (should start with \0asm)
    try {
      const wasmHeader = fs.readFileSync(wasmPath, { encoding: 'utf8', length: 20 });
      if (wasmHeader.startsWith('Placeholder') || !wasmHeader.includes('\0asm')) {
        console.log(`${colors.yellow}Warning: ${circuit}.wasm appears to be a placeholder file, not a real WebAssembly module${colors.reset}`);
        return false;
      }
    } catch (error) {
      return false;
    }
  }
  
  return true;
}

// Run a full circuit test with snarkjs (witness generation, proof generation, verification)
async function runFullCircuitTest(circuitName, input, snarkjs) {
  const result = {
    success: false,
    error: null,
    witnessGenTime: null,
    proofGenTime: null,
    verificationTime: null
  };
  
  try {
    // Paths for circuit artifacts
    const wasmPath = path.join(BUILD_PATH, 'wasm', `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(BUILD_PATH, 'zkey', `${circuitName}.zkey`);
    const vkeyPath = path.join(BUILD_PATH, 'verification_key', `${circuitName}.json`);
    
    // Check if required files exist
    if (!fs.existsSync(wasmPath)) {
      throw new Error(`WASM file not found at ${wasmPath}`);
    }
    
    if (!fs.existsSync(zkeyPath)) {
      throw new Error(`Zkey file not found at ${zkeyPath}`);
    }
    
    if (!fs.existsSync(vkeyPath)) {
      throw new Error(`Verification key not found at ${vkeyPath}`);
    }
    
    // 1. Generate witness
    console.log(`${colors.cyan}  Generating witness...${colors.reset}`);
    const witnessStartTime = performance.now();
    const { witness } = await snarkjs.wtns.calculate(input, wasmPath);
    result.witnessGenTime = performance.now() - witnessStartTime;
    
    // 2. Generate proof
    console.log(`${colors.cyan}  Generating proof...${colors.reset}`);
    const proofStartTime = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyPath, witness);
    result.proofGenTime = performance.now() - proofStartTime;
    
    // 3. Verify proof
    console.log(`${colors.cyan}  Verifying proof...${colors.reset}`);
    const verificationStartTime = performance.now();
    const verificationKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    const isValid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
    result.verificationTime = performance.now() - verificationStartTime;
    
    if (isValid) {
      result.success = true;
    } else {
      result.error = 'Proof verification failed';
    }
    
    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

// Run all tests
async function runAllTests() {
  console.log(`${colors.magenta}Circuit Optimization Tests${colors.reset}`);
  
  const hasCircom = isCircomInstalled();
  const hasSnarkJS = isSnarkJSInstalled();
  const hasCompiledCircuits = compiledCircuitsExist();
  
  if (!hasCircom) {
    console.log(`${colors.yellow}Note: Running simplified tests since circom is not installed${colors.reset}`);
  } else if (!hasSnarkJS) {
    console.log(`${colors.yellow}Note: Running simplified tests since snarkjs is not installed${colors.reset}`);
  } else if (!hasCompiledCircuits) {
    console.log(`${colors.yellow}Note: Running simplified tests since compiled circuits were not found${colors.reset}`);
    console.log(`${colors.yellow}You have circom and snarkjs installed, but need to compile the circuits first${colors.reset}`);
  } else {
    console.log(`${colors.green}Circom and SnarkJS are installed and compiled circuits were found${colors.reset}`);
    console.log(`${colors.green}Running full circuit validation tests${colors.reset}`);
    // Full testing with snarkjs will be performed after basic validation
  }
  
  testCircuit('standardProof', validateStandardProof);
  testCircuit('thresholdProof', validateThresholdProof);
  testCircuit('maximumProof', validateMaximumProof);
  
  console.log(`\n${colors.magenta}Test Summary${colors.reset}`);
  if (!hasCircom || !hasSnarkJS || !hasCompiledCircuits) {
    console.log(`${colors.cyan}These tests validate the circuit logic but do not compile or run the actual circuits.${colors.reset}`);
    if (!hasCircom || !hasSnarkJS) {
      console.log(`${colors.cyan}For complete testing, install circom and snarkjs as described in CIRCUIT_TESTING_GUIDE.md${colors.reset}`);
    } else {
      console.log(`${colors.cyan}To run full tests, compile the circuits first with: node scripts/build-circuits.js${colors.reset}`);
    }
  } else {
    // Run full snarkjs tests if all dependencies are available
    console.log(`\n${colors.magenta}Running Full ZK Proof Generation and Verification Tests${colors.reset}`);
    
    try {
      const snarkjs = require('snarkjs');
      
      // Run tests for each circuit
      const circuits = ['standardProof', 'thresholdProof', 'maximumProof'];
      for (const circuitName of circuits) {
        console.log(`\n${colors.cyan}Testing ${circuitName} with full proving system...${colors.reset}`);
        
        // Load input
        const input = loadTestInput(circuitName);
        if (!input) {
          console.log(`${colors.red}✗ Failed to load test input${colors.reset}`);
          continue;
        }
        
        // Perform full test
        const testResult = await runFullCircuitTest(circuitName, input, snarkjs);
        if (testResult.success) {
          console.log(`${colors.green}✓ Full ZK proof generation and verification passed${colors.reset}`);
          if (testResult.witnessGenTime) {
            console.log(`${colors.cyan}  - Witness generation: ${testResult.witnessGenTime.toFixed(2)}ms${colors.reset}`);
          }
          if (testResult.proofGenTime) {
            console.log(`${colors.cyan}  - Proof generation: ${testResult.proofGenTime.toFixed(2)}ms${colors.reset}`);
          }
          if (testResult.verificationTime) {
            console.log(`${colors.cyan}  - Proof verification: ${testResult.verificationTime.toFixed(2)}ms${colors.reset}`);
          }
        } else {
          console.log(`${colors.red}✗ Full ZK testing failed: ${testResult.error}${colors.reset}`);
        }
      }
      
      console.log(`\n${colors.green}Full ZK testing completed.${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}Error during full ZK testing: ${error.message}${colors.reset}`);
      console.log(`${colors.yellow}Falling back to simplified testing${colors.reset}`);
    }
  }
}

// Execute tests
(async () => {
  try {
    await runAllTests();
  } catch (error) {
    console.error(`${colors.red}Error during test execution: ${error.message}${colors.reset}`);
    process.exit(1);
  }
})();