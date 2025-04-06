/**
 * Maximum Proof Mock Validation Tests
 * 
 * These tests validate that our mock implementations of maximum proof 
 * generation functions behave consistently with their real implementations.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as snarkjs from 'snarkjs';

// Import real and mock implementations
import { generateZKProof as mockGenerateZKProof } from '../../../zkUtils.js';
import { getTestWallets, getMaximumProofVectors } from '../utils/testVectors.js';
import { isCircuitAvailable } from '../utils/testCircuits.js';

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildDir = path.join(__dirname, '../../../build');

/**
 * Helper function to generate a maximum proof using real cryptography
 * @param {Object} input - The input parameters
 * @returns {Object} The generated proof
 */
async function realGenerateMaximumProof(input) {
  // Load circuit artifacts
  const circuitWasm = path.join(buildDir, 'maximum/maximumProof.wasm');
  const circuitZkey = path.join(buildDir, 'maximum/maximumProof.zkey');
  
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
 * Helper function to verify a maximum proof
 * @param {Object} proof - The proof to verify
 * @param {Array} publicSignals - The public signals
 * @returns {boolean} Whether the proof is valid
 */
async function verifyMaximumProof(proof, publicSignals) {
  // Load verification key
  const vkeyPath = path.join(buildDir, 'maximum/verification_key.json');
  const vkeyJson = readFileSync(vkeyPath, 'utf-8');
  const vkey = JSON.parse(vkeyJson);
  
  // Verify using snarkjs
  return await snarkjs.groth16.verify(vkey, publicSignals, proof);
}

/**
 * Compares mock and real maximum proof generation behavior
 * @param {Object} input - The input parameters
 * @returns {Object} Comparison results
 */
async function compareMaximumProofGeneration(input) {
  // Skip if real circuit isn't available
  if (!isCircuitAvailable('maximum')) {
    console.warn('Skipping test: Maximum circuit artifacts not available');
    return { skipped: true };
  }
  
  // Generate proofs using both implementations
  input.proofType = 2; // Maximum proof
  const mockResult = await mockGenerateZKProof(input, 2); // 2 = Maximum proof
  const realResult = await realGenerateMaximumProof(input);
  
  // Compare structure
  const structureMatch = (
    mockResult.proof && 
    mockResult.publicSignals && 
    Array.isArray(mockResult.publicSignals)
  );
  
  // Compare behavior (valid/invalid)
  const mockValid = await verifyMaximumProof(mockResult.proof, mockResult.publicSignals);
  const realValid = await verifyMaximumProof(realResult.proof, realResult.publicSignals);
  const behaviorMatch = mockValid === realValid;
  
  return {
    structureMatch,
    behaviorMatch,
    mockValid,
    realValid
  };
}

describe('Maximum Proof Mock Validation Tests', () => {
  // Test vectors
  const testVectors = getMaximumProofVectors();
  
  test('Maximum proof mock should have similar structure and behavior to real implementation for valid case', async () => {
    // Wallet has less than maximum
    const testVector = testVectors[0];
    const input = {
      walletAddress: testVector.addressBytes,
      amount: testVector.amount,
      actualBalance: testVector.actualBalance
    };
    
    const comparison = await compareMaximumProofGeneration(input);
    
    // Skip if circuit isn't available
    if (comparison.skipped) {
      return;
    }
    
    expect(comparison.structureMatch).toBe(true);
    expect(comparison.behaviorMatch).toBe(true);
    expect(comparison.mockValid).toBe(true);
    expect(comparison.realValid).toBe(true);
  });
  
  test('Maximum proof mock should match real behavior for invalid inputs', async () => {
    // Wallet has more than maximum
    const testVector = testVectors[2];
    const input = {
      walletAddress: testVector.addressBytes,
      amount: testVector.amount,
      actualBalance: testVector.actualBalance
    };
    
    const comparison = await compareMaximumProofGeneration(input);
    
    // Skip if circuit isn't available
    if (comparison.skipped) {
      return;
    }
    
    expect(comparison.behaviorMatch).toBe(true);
    expect(comparison.mockValid).toBe(false);
    expect(comparison.realValid).toBe(false);
  });
});