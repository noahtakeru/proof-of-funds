/**
 * Threshold Proof Mock Validation Tests
 * 
 * These tests validate that our mock implementations of threshold proof 
 * generation functions behave consistently with their real implementations.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as snarkjs from 'snarkjs';

// Import real and mock implementations
import { generateZKProof as mockGenerateZKProof } from '../../../zkUtils.js';
import { getTestWallets, getThresholdProofVectors } from '../utils/testVectors.js';
import { isCircuitAvailable } from '../utils/testCircuits.js';

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildDir = path.join(__dirname, '../../../build');

/**
 * Helper function to generate a threshold proof using real cryptography
 * @param {Object} input - The input parameters
 * @returns {Object} The generated proof
 */
async function realGenerateThresholdProof(input) {
  // Load circuit artifacts
  const circuitWasm = path.join(buildDir, 'threshold/thresholdProof.wasm');
  const circuitZkey = path.join(buildDir, 'threshold/thresholdProof.zkey');
  
  // Format input for the circuit
  const circuitInput = {
    walletAddress: input.walletAddress,
    amount: input.amount,
    actualBalance: input.actualBalance,
    nonce: input.nonce || '123456789'
  };
  
  // Generate proof using real snarkjs
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput, 
    circuitWasm, 
    circuitZkey
  );
  
  return { proof, publicSignals };
}

/**
 * Helper function to verify a threshold proof
 * @param {Object} proof - The proof to verify
 * @param {Array} publicSignals - The public signals
 * @returns {boolean} Whether the proof is valid
 */
async function verifyThresholdProof(proof, publicSignals) {
  // Load verification key
  const vkeyPath = path.join(buildDir, 'threshold/verification_key.json');
  const vkeyJson = readFileSync(vkeyPath, 'utf-8');
  const vkey = JSON.parse(vkeyJson);
  
  // Verify using snarkjs
  return await snarkjs.groth16.verify(vkey, publicSignals, proof);
}

/**
 * Compares mock and real threshold proof generation behavior
 * @param {Object} input - The input parameters
 * @returns {Object} Comparison results
 */
async function compareThresholdProofGeneration(input) {
  // Skip if real circuit isn't available
  if (!isCircuitAvailable('threshold')) {
    console.warn('Skipping test: Threshold circuit artifacts not available');
    return { skipped: true };
  }
  
  // Generate proofs using both implementations
  input.proofType = 1; // Threshold proof
  const mockResult = await mockGenerateZKProof(input, 1); // 1 = Threshold proof
  const realResult = await realGenerateThresholdProof(input);
  
  // Compare structure
  const structureMatch = (
    mockResult.proof && 
    mockResult.publicSignals && 
    Array.isArray(mockResult.publicSignals)
  );
  
  // Compare behavior (valid/invalid)
  const mockValid = await verifyThresholdProof(mockResult.proof, mockResult.publicSignals);
  const realValid = await verifyThresholdProof(realResult.proof, realResult.publicSignals);
  const behaviorMatch = mockValid === realValid;
  
  return {
    structureMatch,
    behaviorMatch,
    mockValid,
    realValid
  };
}

describe('Threshold Proof Mock Validation Tests', () => {
  // Test vectors
  const testVectors = getThresholdProofVectors();
  
  test('Threshold proof mock should have similar structure and behavior to real implementation for valid case', async () => {
    // Wallet has more than threshold
    const testVector = testVectors[0];
    const input = {
      walletAddress: testVector.addressBytes,
      amount: testVector.amount,
      actualBalance: testVector.actualBalance
    };
    
    const comparison = await compareThresholdProofGeneration(input);
    
    // Skip if circuit isn't available
    if (comparison.skipped) {
      return;
    }
    
    expect(comparison.structureMatch).toBe(true);
    expect(comparison.behaviorMatch).toBe(true);
    expect(comparison.mockValid).toBe(true);
    expect(comparison.realValid).toBe(true);
  });
  
  test('Threshold proof mock should match real behavior for invalid inputs', async () => {
    // Wallet has less than threshold
    const testVector = testVectors[2];
    const input = {
      walletAddress: testVector.addressBytes,
      amount: testVector.amount,
      actualBalance: testVector.actualBalance
    };
    
    const comparison = await compareThresholdProofGeneration(input);
    
    // Skip if circuit isn't available
    if (comparison.skipped) {
      return;
    }
    
    expect(comparison.behaviorMatch).toBe(true);
    expect(comparison.mockValid).toBe(false);
    expect(comparison.realValid).toBe(false);
  });
});