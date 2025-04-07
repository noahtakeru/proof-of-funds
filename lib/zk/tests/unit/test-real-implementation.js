/**
 * Test Real Implementation
 * 
 * This script tests the real implementation of ZK components without falling back to mock implementations.
 * It will fail if the real implementations aren't working properly.
 */

const fs = require('fs');
const path = require('path');
const zkUtils = require('./zkUtils.js');
const zkConfig = require('./real-zk-config.js');

// Set environment variable to force real implementation
process.env.USING_REAL_IMPLEMENTATION = 'true';

/**
 * Verify that WebAssembly files exist and are not placeholders
 */
function checkWasmFiles() {
  console.log('Checking WebAssembly files...');
  
  const circuits = ['standardProof', 'thresholdProof', 'maximumProof'];
  const results = {
    passed: [],
    failed: []
  };
  
  circuits.forEach(circuit => {
    const wasmPath = path.resolve(process.cwd(), zkConfig.circuitPaths.wasmPath(circuit));
    const zkeyPath = path.resolve(process.cwd(), zkConfig.circuitPaths.zkeyPath(circuit));
    
    if (!fs.existsSync(wasmPath)) {
      results.failed.push(`${circuit}: WASM file not found at ${wasmPath}`);
      return;
    }
    
    if (!fs.existsSync(zkeyPath)) {
      results.failed.push(`${circuit}: ZKEY file not found at ${zkeyPath}`);
      return;
    }
    
    // Quick check if WASM is a placeholder (checking file size)
    const wasmStats = fs.statSync(wasmPath);
    if (wasmStats.size < 1000) {
      // File is suspiciously small
      results.failed.push(`${circuit}: WASM file appears to be a placeholder (only ${wasmStats.size} bytes)`);
      return;
    }
    
    results.passed.push(`${circuit}: WebAssembly files verified`);
  });
  
  return results;
}

/**
 * Test ZK proof generation with real implementation
 */
async function testProofGeneration() {
  console.log('Testing ZK proof generation...');
  
  const results = {
    passed: [],
    failed: []
  };
  
  // Test inputs for standard proof
  const input = {
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    amount: '1000000000000000000',  // 1 ETH
    nonce: '123456789',
    actualBalance: '1000000000000000000',
    signature: ['123456789', '987654321'],
    walletSecret: '987654321'
  };
  
  // Test standard proof generation
  try {
    console.log('Generating standard proof...');
    const { proof, publicSignals } = await zkUtils.generateZKProof(input, 'standardProof');
    
    if (!proof || !proof.pi_a || !proof.pi_b || !proof.pi_c) {
      results.failed.push('Standard proof structure is invalid');
    } else {
      results.passed.push('Standard proof generation successful');
      
      // Test verification
      try {
        console.log('Verifying standard proof...');
        const isValid = await zkUtils.verifyZKProof({
          proof,
          publicSignals,
          proofType: 0,
          circuitName: 'standardProof'
        });
        
        if (isValid) {
          results.passed.push('Standard proof verification successful');
        } else {
          results.failed.push('Standard proof verification failed');
        }
      } catch (error) {
        results.failed.push(`Standard proof verification error: ${error.message}`);
      }
    }
  } catch (error) {
    results.failed.push(`Standard proof generation error: ${error.message}`);
  }
  
  return results;
}

/**
 * Run all real implementation tests
 */
async function runTests() {
  console.log('======================================');
  console.log('Testing Real ZK Implementation');
  console.log('======================================');
  
  // 1. Check WebAssembly files
  const wasmResults = checkWasmFiles();
  
  // 2. Test proof generation and verification
  const proofResults = await testProofGeneration();
  
  // Print summary
  console.log('\n======================================');
  console.log('Test Results');
  console.log('======================================');
  
  console.log('\nWebAssembly Files:');
  wasmResults.passed.forEach(msg => console.log(`✅ ${msg}`));
  wasmResults.failed.forEach(msg => console.log(`❌ ${msg}`));
  
  console.log('\nProof Generation & Verification:');
  proofResults.passed.forEach(msg => console.log(`✅ ${msg}`));
  proofResults.failed.forEach(msg => console.log(`❌ ${msg}`));
  
  console.log('\n======================================');
  
  // Overall result
  const allPassed = wasmResults.failed.length === 0 && proofResults.failed.length === 0;
  console.log(`Overall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});