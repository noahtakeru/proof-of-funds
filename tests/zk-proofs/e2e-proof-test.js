/**
 * End-to-End ZK Proof Test
 * 
 * This script tests the complete proof pipeline using the API endpoints.
 * Part of the ZK Proof Execution Plan implementation.
 */

const fetch = require('node-fetch');
const { execSync } = require('child_process');
const path = require('path');

// Server config
const SERVER_PORT = 3001;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// Start server in test mode (background)
function startServer() {
  console.log('Starting server in test mode...');
  try {
    execSync(`npm run dev -- --port ${SERVER_PORT} &`, { stdio: 'inherit' });
    console.log(`Server started on port ${SERVER_PORT}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

// Stop server
function stopServer() {
  console.log('Stopping server...');
  try {
    execSync(`pkill -f "npm run dev -- --port ${SERVER_PORT}"`, { stdio: 'ignore' });
    console.log('Server stopped');
  } catch (error) {
    console.error('Failed to stop server:', error);
  }
}

// Generate and verify a proof
async function testProofGeneration(proofType, input) {
  console.log(`\nTesting ${proofType} proof generation and verification...`);
  
  try {
    // Generate proof
    console.log('Generating proof...');
    const genResponse = await fetch(`${SERVER_URL}/api/zk/generateProof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proofType, input })
    });
    
    const genResult = await genResponse.json();
    
    if (!genResponse.ok) {
      console.error('Proof generation failed:', genResult);
      return { success: false, error: genResult.error, details: genResult };
    }
    
    console.log('Proof generated successfully');
    
    // Verify proof
    console.log('Verifying proof...');
    const verifyResponse = await fetch(`${SERVER_URL}/api/zk/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proofType,
        proof: genResult.proof,
        publicSignals: genResult.publicSignals
      })
    });
    
    const verifyResult = await verifyResponse.json();
    
    if (!verifyResponse.ok) {
      console.error('Proof verification failed:', verifyResult);
      return { success: false, error: verifyResult.error, details: verifyResult };
    }
    
    console.log(`Proof verification result: ${verifyResult.verified}`);
    
    return {
      success: verifyResult.verified,
      proof: genResult.proof,
      publicSignals: genResult.publicSignals,
      verified: verifyResult.verified
    };
  } catch (error) {
    console.error('Error testing proof:', error);
    return { success: false, error: error.message };
  }
}

// Run all tests
async function runE2ETests() {
  // Start server
  startServer();
  
  // Wait for server to start
  console.log('Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  try {
    console.log('===== E2E ZK PROOF TESTS =====\n');
    
    // Test standard proof
    const standardResult = await testProofGeneration('standard', {
      balance: 1000,
      threshold: 500,
      userAddress: "0x1234567890123456789012345678901234567890"
    });
    
    // Test threshold proof
    const thresholdResult = await testProofGeneration('threshold', {
      totalBalance: 5000,
      threshold: 1000,
      userAddress: "0x1234567890123456789012345678901234567890",
      networkId: 1
    });
    
    // Test maximum proof
    const maximumResult = await testProofGeneration('maximum', {
      maxBalance: 10000,
      threshold: 5000,
      userAddress: "0x1234567890123456789012345678901234567890",
      networks: [1, 2, 3, 4]
    });
    
    // Print summary
    console.log('\n===== E2E TEST SUMMARY =====');
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
  } catch (error) {
    console.error('Error running E2E tests:', error);
    return { success: false, error: error.message };
  } finally {
    // Stop server
    stopServer();
  }
}

// Allow both direct execution and import
if (require.main === module) {
  runE2ETests().catch(error => {
    console.error('E2E test execution error:', error);
    stopServer();
    process.exit(1);
  });
} else {
  module.exports = {
    testProofGeneration,
    runE2ETests
  };
}