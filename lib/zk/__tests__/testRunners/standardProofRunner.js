/**
 * Standard Proof Test Runner
 * 
 * Runs all tests related to the Standard Proof circuit and collects results.
 */

import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Import modules to test
import { createBenchmark } from '../../benchmarkSuite.js';
import { createMemoryProfiler } from '../../memoryProfiler.js';
import { STANDARD_PROOF_VECTORS, TEST_WALLETS } from '../testVectors.js';
import { deriveStandardProofParameters } from '../../zkCircuitParameterDerivation.js';
import { generateZKProof, verifyZKProof } from '../../zkUtils.js';

/**
 * Run a single test case for standard proof
 * @param {Object} testCase - Test case from vectors
 * @returns {Object} Test results
 */
async function runTestCase(testCase) {
  try {
    // Set up benchmarking
    const benchmark = createBenchmark(`standard-proof-${testCase.description}`, {
      operationType: 'prove',
      circuitType: 'standard'
    });
    
    const memoryProfiler = createMemoryProfiler(`standard-proof-${testCase.description}`, {
      operationType: 'prove',
      circuitType: 'standard'
    });
    
    // Start profiling
    benchmark.start();
    memoryProfiler.start();
    
    // Derive parameters
    const params = deriveStandardProofParameters({
      walletAddress: testCase.walletAddress,
      amount: testCase.amount
    });
    
    // Generate proof
    const proof = await generateZKProof({
      walletAddress: testCase.walletAddress,
      amount: testCase.amount,
      proofType: 0 // STANDARD
    });
    
    // End generation profiling
    const generationTime = benchmark.checkpoint('verification');
    
    // Verify the proof
    const isValid = await verifyZKProof({
      proof: proof.proof,
      publicSignals: proof.publicSignals,
      proofType: 0
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
    return {
      description: testCase.description,
      passed: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Run all standard proof tests
 * @returns {Object} Aggregated test results
 */
export async function runStandardProofTests() {
  console.log('Starting Standard Proof Tests');
  
  const testResults = [];
  let totalPassed = 0;
  let totalGenerationTime = 0;
  let totalVerificationTime = 0;
  
  // Run each test case
  for (const testCase of STANDARD_PROOF_VECTORS) {
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
  
  // Calculate average performance metrics
  const avgGenerationTime = totalGenerationTime / totalPassed;
  const avgVerificationTime = totalVerificationTime / totalPassed;
  
  return {
    type: 'standard',
    totalTests: STANDARD_PROOF_VECTORS.length,
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
  runStandardProofTests()
    .then(results => {
      console.log('Test Results:', JSON.stringify(results, null, 2));
      process.exit(results.totalPassed === results.totalTests ? 0 : 1);
    })
    .catch(error => {
      console.error('Test Runner Error:', error);
      process.exit(1);
    });
}