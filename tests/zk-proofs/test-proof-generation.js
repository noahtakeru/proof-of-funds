/**
 * ZK Proof Generation Test
 * Tests generating and verifying ZK proofs with real circuits
 * 
 * This file is part of the ZK Proof Execution Plan implementation.
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

// Path to circuits
const CIRCUIT_DIR = path.resolve(__dirname, '../../packages/frontend/public/lib/zk/circuits');

/**
 * Test standard proof generation and verification
 */
async function testStandardProof() {
  console.log('Testing Standard Proof Generation...');
  
  const input = {
    balance: 1000,
    threshold: 1000,  // Standard proof needs exact match
    userAddress: "0x1234567890123456789012345678901234567890"
  };
  
  try {
    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      path.join(CIRCUIT_DIR, 'standardProof.wasm'),
      path.join(CIRCUIT_DIR, 'standardProof.zkey')
    );
    
    // Verify proof
    const vkey = JSON.parse(fs.readFileSync(path.join(CIRCUIT_DIR, 'standardProof.vkey.json')));
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    console.log(`Standard proof verified: ${verified} (balance == threshold)`);
    return { success: verified, proof, publicSignals };
  } catch (error) {
    console.error('Error testing standard proof:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test threshold proof generation and verification
 */
async function testThresholdProof() {
  console.log('Testing Threshold Proof Generation...');
  
  const input = {
    totalBalance: 5000,
    threshold: 1000,
    userAddress: "0x1234567890123456789012345678901234567890",
    networkId: 1
  };
  
  try {
    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      path.join(CIRCUIT_DIR, 'thresholdProof.wasm'),
      path.join(CIRCUIT_DIR, 'thresholdProof.zkey')
    );
    
    // Verify proof
    const vkey = JSON.parse(fs.readFileSync(path.join(CIRCUIT_DIR, 'thresholdProof.vkey.json')));
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    console.log(`Threshold proof verified: ${verified} (totalBalance >= threshold)`);
    return { success: verified, proof, publicSignals };
  } catch (error) {
    console.error('Error testing threshold proof:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test maximum proof generation and verification
 */
async function testMaximumProof() {
  console.log('Testing Maximum Proof Generation...');
  
  const input = {
    maxBalance: 1000,
    threshold: 2000,  // Maximum proof needs balance < threshold
    userAddress: "0x1234567890123456789012345678901234567890",
    networks: [1, 2, 3, 4]
  };
  
  try {
    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      path.join(CIRCUIT_DIR, 'maximumProof.wasm'),
      path.join(CIRCUIT_DIR, 'maximumProof.zkey')
    );
    
    // Verify proof
    const vkey = JSON.parse(fs.readFileSync(path.join(CIRCUIT_DIR, 'maximumProof.vkey.json')));
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    console.log(`Maximum proof verified: ${verified} (maxBalance < threshold)`);
    return { success: verified, proof, publicSignals };
  } catch (error) {
    console.error('Error testing maximum proof:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('===== ZK PROOF GENERATION TESTS =====\n');
  
  const standardResult = await testStandardProof();
  console.log(`\nStandard Proof: ${standardResult.success ? 'SUCCESS' : 'FAILED'}`);
  if (!standardResult.success) {
    console.log(`Error: ${standardResult.error}`);
  }
  
  const thresholdResult = await testThresholdProof();
  console.log(`\nThreshold Proof: ${thresholdResult.success ? 'SUCCESS' : 'FAILED'}`);
  if (!thresholdResult.success) {
    console.log(`Error: ${thresholdResult.error}`);
  }
  
  const maximumResult = await testMaximumProof();
  console.log(`\nMaximum Proof: ${maximumResult.success ? 'SUCCESS' : 'FAILED'}`);
  if (!maximumResult.success) {
    console.log(`Error: ${maximumResult.error}`);
  }
  
  console.log('\n===== SUMMARY =====');
  console.log(`Standard Proof: ${standardResult.success ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Threshold Proof: ${thresholdResult.success ? 'PASS ✅' : 'FAIL ❌'}`);  
  console.log(`Maximum Proof: ${maximumResult.success ? 'PASS ✅' : 'FAIL ❌'}`);
  
  const allSuccess = standardResult.success && thresholdResult.success && maximumResult.success;
  console.log(`\nOverall: ${allSuccess ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
  
  return {
    standardProof: standardResult,
    thresholdProof: thresholdResult,
    maximumProof: maximumResult,
    success: allSuccess
  };
}

// Allow both direct execution and import
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test execution error:', error);
    process.exit(1);
  });
} else {
  module.exports = {
    testStandardProof,
    testThresholdProof,
    testMaximumProof,
    runAllTests
  };
}