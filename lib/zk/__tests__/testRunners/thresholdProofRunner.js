/**
 * Threshold Proof Test Runner
 * 
 * Runs all tests related to the Threshold Proof circuit and collects results.
 */

import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Import modules to test
import { createBenchmark } from '../../benchmarkSuite.js';
import { createMemoryProfiler } from '../../memoryProfiler.js';
import { THRESHOLD_PROOF_VECTORS, TEST_WALLETS } from '../testVectors.js';
import { deriveThresholdProofParameters } from '../../zkCircuitParameterDerivation.js';
import { generateZKProof, verifyZKProof } from '../../zkUtils.js';

/**
 * Run a single test case for threshold proof
 * @param {Object} testCase - Test case from vectors
 * @returns {Object} Test results
 */
async function runTestCase(testCase) {
  try {
    // Set up benchmarking
    const benchmark = createBenchmark(`threshold-proof-${testCase.description}`, {
      operationType: 'prove',
      circuitType: 'threshold'
    });
    
    const memoryProfiler = createMemoryProfiler(`threshold-proof-${testCase.description}`, {
      operationType: 'prove',
      circuitType: 'threshold'
    });
    
    // Start profiling
    benchmark.start();
    memoryProfiler.start();
    
    // Derive parameters
    const params = deriveThresholdProofParameters({
      walletAddress: testCase.walletAddress,
      amount: testCase.amount,
      actualBalance: testCase.actualBalance
    });
    
    // Generate proof
    const proof = await generateZKProof({
      walletAddress: testCase.walletAddress,
      amount: testCase.amount,
      actualBalance: testCase.actualBalance,
      proofType: 1 // THRESHOLD
    });
    
    // End generation profiling
    const generationTime = benchmark.checkpoint('verification');
    
    // Verify the proof
    const isValid = await verifyZKProof({
      proof: proof.proof,
      publicSignals: proof.publicSignals,
      proofType: 1
    });
    
    // End verification profiling
    const benchmarkResult = benchmark.end();
    const memoryResult = memoryProfiler.stop();
    
    // Check if result matches expected
    const testPassed = isValid === testCase.expectedResult;
    
    return {
      description: testCase.description,
      passed: testPassed,
      expected: testCase.expectedResult,
      actual: isValid,
      generationTime: generationTime,
      verificationTime: benchmarkResult.checkpoints.verification,
      totalTime: benchmarkResult.executionTime,
      memoryUsage: memoryResult.peakMemoryUsage
    };
  } catch (error) {
    // For invalid test cases, an error might be expected
    const isExpectedError = !testCase.expectedResult && 
      error.message.includes('balance') && 
      error.message.includes('threshold');
      
    return {
      description: testCase.description,
      passed: isExpectedError,
      expected: testCase.expectedResult,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Run all threshold proof tests
 * @returns {Object} Aggregated test results
 */
export async function runThresholdProofTests() {
  console.log('Starting Threshold Proof Tests');
  
  const testResults = [];
  let totalPassed = 0;
  let totalGenerationTime = 0;
  let totalVerificationTime = 0;
  
  // Run each test case
  for (const testCase of THRESHOLD_PROOF_VECTORS) {
    const result = await runTestCase(testCase);
    testResults.push(result);
    
    if (result.passed) {
      totalPassed++;
      totalGenerationTime += result.generationTime || 0;
      totalVerificationTime += result.verificationTime || 0;
    }
    
    // Log result
    console.log(`  ${result.passed ? '✅' : '❌'} ${result.description}`);
    if (!result.passed && result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }
  
  // Calculate average performance metrics (only from successful tests)
  const successfulTests = testResults.filter(r => r.passed && r.generationTime);
  const avgGenerationTime = successfulTests.length ? 
    successfulTests.reduce((sum, r) => sum + r.generationTime, 0) / successfulTests.length : 0;
    
  const avgVerificationTime = successfulTests.length ? 
    successfulTests.reduce((sum, r) => sum + r.verificationTime, 0) / successfulTests.length : 0;
  
  return {
    type: 'threshold',
    totalTests: THRESHOLD_PROOF_VECTORS.length,
    totalPassed,
    testResults,
    performanceMetrics: {
      generation: avgGenerationTime,
      verification: avgVerificationTime
    }
  };
}

// Run standalone if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runThresholdProofTests()
    .then(results => {
      console.log('Test Results:', JSON.stringify(results, null, 2));
      process.exit(results.totalPassed === results.totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('Test Runner Error:', error);
      process.exit(1);
    });
}