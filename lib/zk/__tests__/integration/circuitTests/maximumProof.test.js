/**
 * Maximum Proof Integration Test
 * 
 * This file contains integration tests for the Maximum Proof circuit using
 * real cryptographic operations.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as snarkjs from 'snarkjs';

// Custom utilities for integration testing
import { loadCircuit, getCircuitPath, isCircuitAvailable } from '../utils/testCircuits.js';
import { getTestWallets, getMaximumProofVectors } from '../utils/testVectors.js';
import fs from 'fs';

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const circuitDir = path.join(__dirname, '../../../circuits');
const buildDir = path.join(__dirname, '../../../build');

/**
 * Helper function to generate a proof using the real circuit
 * @param {Object} input - The circuit input
 * @returns {Object} The generated proof
 */
async function generateMaximumProof(input) {
  // Load circuit artifacts
  const circuitWasm = path.join(buildDir, 'maximum/maximumProof.wasm');
  const circuitZkey = path.join(buildDir, 'maximum/maximumProof.zkey');
  
  // Generate proof using real snarkjs
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input, 
    circuitWasm, 
    circuitZkey
  );
  
  return { proof, publicSignals };
}

/**
 * Helper function to verify a proof using the real verification key
 * @param {Object} proof - The proof to verify
 * @param {Array} publicSignals - The public signals from the proof
 * @returns {boolean} Whether the proof is valid
 */
async function verifyMaximumProof(proof, publicSignals) {
  // Load verification key
  const vkeyPath = path.join(buildDir, 'maximum/verification_key.json');
  const vkeyJson = readFileSync(vkeyPath, 'utf-8');
  const vkey = JSON.parse(vkeyJson);
  
  // Verify proof using real snarkjs
  return await snarkjs.groth16.verify(vkey, publicSignals, proof);
}

describe('Maximum Proof Circuit Integration Tests', () => {
  // Test vectors with real wallet data
  const testVectors = getMaximumProofVectors();
  
  // Test case: Wallet has less than maximum
  test('Valid maximum proof with wallet having less than maximum', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('maximum')) {
      console.warn('Skipping test: Maximum circuit artifacts not available');
      return;
    }
    
    // Use test vector
    const testVector = testVectors[0];
    
    // Prepare input for the circuit
    const input = {
      walletAddress: testVector.addressBytes,
      amount: testVector.amount,
      actualBalance: testVector.actualBalance,
      nonce: '123456789' // Deterministic nonce for testing
    };
    
    // Generate proof
    const { proof, publicSignals } = await generateMaximumProof(input);
    
    // Verify proof
    const isValid = await verifyMaximumProof(proof, publicSignals);
    
    // Assert that proof is valid
    expect(isValid).toBe(true);
  });
  
  // Test case: Wallet has exactly maximum
  test('Valid maximum proof with wallet having exactly maximum', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('maximum')) {
      console.warn('Skipping test: Maximum circuit artifacts not available');
      return;
    }
    
    // Use test vector
    const testVector = testVectors[1];
    
    // Prepare input for the circuit
    const input = {
      walletAddress: testVector.addressBytes,
      amount: testVector.amount,
      actualBalance: testVector.actualBalance,
      nonce: '123456789'
    };
    
    // Generate proof
    const { proof, publicSignals } = await generateMaximumProof(input);
    
    // Verify proof
    const isValid = await verifyMaximumProof(proof, publicSignals);
    
    // Assert that proof is valid
    expect(isValid).toBe(true);
  });
  
  // Test case: Wallet has more than maximum
  test('Invalid maximum proof with wallet having more than maximum', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('maximum')) {
      console.warn('Skipping test: Maximum circuit artifacts not available');
      return;
    }
    
    // Use test vector
    const testVector = testVectors[2];
    
    // Prepare input for the circuit
    const input = {
      walletAddress: testVector.addressBytes,
      amount: testVector.amount,
      actualBalance: testVector.actualBalance,
      nonce: '123456789'
    };
    
    // Generate proof
    const { proof, publicSignals } = await generateMaximumProof(input);
    
    // Verify proof - should fail verification
    const isValid = await verifyMaximumProof(proof, publicSignals);
    
    // Assert that proof is invalid
    expect(isValid).toBe(false);
  });
});