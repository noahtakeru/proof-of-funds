/**
 * Consolidated ZK Proof Basic Tests
 * 
 * This file consolidates several test files that were previously separate:
 * - generate-verify-proof.js: Basic proof generation demo
 * - test-simple-proof.js: Tests with small values
 * - test-fixed-circuit.js: Tests proper field arithmetic
 * - test-production-proof.js: Tests with realistic values
 */

const fs = require('fs');
const path = require('path');

// Circuit directory
const CIRCUIT_DIR = path.resolve(__dirname, '../../packages/frontend/public/lib/zk/circuits');

// Import snarkjs dynamically (since it's an ES module)
async function importSnarkjs() {
  try {
    return await import('snarkjs');
  } catch (error) {
    console.error('Failed to import snarkjs:', error);
    throw new Error(`Failed to import snarkjs: ${error.message}`);
  }
}

// Utility function to check file existence
function checkFiles(circuitName) {
  const wasmPath = path.join(CIRCUIT_DIR, `${circuitName}.wasm`);
  const zkeyPath = path.join(CIRCUIT_DIR, `${circuitName}.zkey`);
  const vkeyPath = path.join(CIRCUIT_DIR, `${circuitName}.vkey.json`);
  
  console.log('Checking files:');
  const wasmExists = fs.existsSync(wasmPath);
  const zkeyExists = fs.existsSync(zkeyPath);
  const vkeyExists = fs.existsSync(vkeyPath);
  
  console.log(`  WASM exists: ${wasmExists}`);
  console.log(`  ZKEY exists: ${zkeyExists}`);
  console.log(`  VKEY exists: ${vkeyExists}`);
  
  if (!wasmExists || !zkeyExists || !vkeyExists) {
    throw new Error(`Missing required files for ${circuitName}`);
  }
  
  return { wasmPath, zkeyPath, vkeyPath };
}

// Generate and verify a proof with the given input and circuit name
async function generateAndVerifyProof(input, circuitName = 'standardProof') {
  const snarkjs = await importSnarkjs();
  const { wasmPath, zkeyPath, vkeyPath } = checkFiles(circuitName);
  
  console.log(`\nGenerating ${circuitName} with input:`, input);
  
  try {
    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );
    
    console.log('✅ Proof generated successfully!');
    console.log('Public signals:', publicSignals);
    
    // Verify proof
    const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    
    console.log(`\nVerification result: ${verified ? 'VALID ✅' : 'INVALID ❌'}`);
    
    return { success: verified, proof, publicSignals };
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // More detailed error analysis
    if (error.message.includes('Num2Bits')) {
      console.log('\n🔍 Analysis: The Num2Bits circuit is failing.');
      console.log('This happens when:');
      console.log('1. Input numbers are too large for the field');
      console.log('2. Bit extraction logic has issues');
      console.log('3. Circuit constraints are over-constrained');
    }
    
    return { success: false, error: error.message };
  }
}

// Test 1: Simple Demo (Previously generate-verify-proof.js)
async function testSimpleDemo() {
  console.log('=== Test 1: Simple ZK Proof Demo ===');
  
  const input = {
    balance: 1000,
    threshold: 500,
    userAddress: "0x1234567890123456789012345678901234567890"
  };
  
  return await generateAndVerifyProof(input);
}

// Test 2: Simple Values (Previously test-simple-proof.js)
async function testSimpleValues() {
  console.log('\n=== Test 2: Testing with Simple Values ===');
  
  const testCases = [
    { balance: "100", threshold: "50", userAddress: "123" },
    { balance: "1000", threshold: "500", userAddress: "456" },
    { balance: "10000", threshold: "5000", userAddress: "789" }
  ];
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    console.log(`\nTest Case: balance=${testCase.balance}, threshold=${testCase.threshold}`);
    const result = await generateAndVerifyProof(testCase);
    if (!result.success) {
      allPassed = false;
    }
  }
  
  return { success: allPassed };
}

// Test 3: Field Elements (Previously test-fixed-circuit.js)
async function testFieldElements() {
  console.log('\n=== Test 3: Testing with Proper Field Elements ===');
  
  // Use field elements (numbers that fit in the ZK-SNARK field)
  const input = {
    balance: "1000",  // These are already field elements
    threshold: "500",
    userAddress: "1234567890123456789012345678901234567890"
  };
  
  return await generateAndVerifyProof(input);
}

// Test 4: Production Values (Previously test-production-proof.js)
async function testProductionValues() {
  console.log('\n=== Test 4: Testing with Production Values ===');
  
  // Use realistic values that fit within circuit constraints
  const input = {
    balance: "1000000000000000000", // 1 ETH in wei (fits in field)
    threshold: "500000000000000000", // 0.5 ETH in wei
    userAddress: "123456789012345678901234567890123456789012" // 42 chars (Ethereum address without 0x)
  };
  
  return await generateAndVerifyProof(input);
}

// Main function to run all tests
async function runAllTests() {
  try {
    const testFunctions = {
      demo: testSimpleDemo,
      simple: testSimpleValues,
      field: testFieldElements,
      production: testProductionValues,
    };
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const testsToRun = args.length > 0 ? args : Object.keys(testFunctions);
    
    console.log(`Running tests: ${testsToRun.join(', ')}\n`);
    
    const results = {};
    let allPassed = true;
    
    for (const test of testsToRun) {
      if (testFunctions[test]) {
        results[test] = await testFunctions[test]();
        if (!results[test].success) {
          allPassed = false;
        }
      } else {
        console.log(`Unknown test: ${test}`);
        console.log(`Available tests: ${Object.keys(testFunctions).join(', ')}`);
        allPassed = false;
      }
    }
    
    console.log('\n=== Test Summary ===');
    for (const [test, result] of Object.entries(results)) {
      console.log(`${test}: ${result.success ? 'PASSED ✅' : 'FAILED ❌'}`);
    }
    
    console.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run all tests when executed directly
if (require.main === module) {
  runAllTests();
}

// Export for use in other test files
module.exports = {
  generateAndVerifyProof,
  testSimpleDemo,
  testSimpleValues,
  testFieldElements,
  testProductionValues,
  runAllTests,
};