/**
 * Threshold Proof Integration Test
 * 
 * This file contains integration tests for the Threshold Proof circuit using
 * real cryptographic operations.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as snarkjs from 'snarkjs';

// Custom utilities for integration testing
import { loadCircuit, getCircuitPath, isCircuitAvailable } from '../utils/testCircuits.js';
import { getTestWallets, getThresholdProofVectors } from '../utils/testVectors.js';
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
async function generateThresholdProof(input) {
  // Load circuit artifacts
  const circuitWasm = path.join(buildDir, 'threshold/thresholdProof.wasm');
  const circuitZkey = path.join(buildDir, 'threshold/thresholdProof.zkey');
  
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
async function verifyThresholdProof(proof, publicSignals) {
  // Load verification key
  const vkeyPath = path.join(buildDir, 'threshold/verification_key.json');
  const vkeyJson = readFileSync(vkeyPath, 'utf-8');
  const vkey = JSON.parse(vkeyJson);
  
  // Verify proof using real snarkjs
  return await snarkjs.groth16.verify(vkey, publicSignals, proof);
}

describe('Threshold Proof Circuit Integration Tests', () => {
  // Test vectors with real wallet data
  const testVectors = getThresholdProofVectors();
  
  // Test case: Wallet has more than threshold
  test('Valid threshold proof with wallet having more than threshold', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('threshold')) {
      console.warn('Skipping test: Threshold circuit artifacts not available');
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
    const { proof, publicSignals } = await generateThresholdProof(input);
    
    // Verify proof
    const isValid = await verifyThresholdProof(proof, publicSignals);
    
    // Assert that proof is valid
    expect(isValid).toBe(true);
  });
  
  // Test case: Wallet has exactly threshold
  test('Valid threshold proof with wallet having exactly threshold', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('threshold')) {
      console.warn('Skipping test: Threshold circuit artifacts not available');
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
    const { proof, publicSignals } = await generateThresholdProof(input);
    
    // Verify proof
    const isValid = await verifyThresholdProof(proof, publicSignals);
    
    // Assert that proof is valid
    expect(isValid).toBe(true);
  });
  
  // Test case: Wallet has less than threshold
  test('Invalid threshold proof with wallet having less than threshold', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('threshold')) {
      console.warn('Skipping test: Threshold circuit artifacts not available');
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
    const { proof, publicSignals } = await generateThresholdProof(input);
    
    // Verify proof - should fail verification
    const isValid = await verifyThresholdProof(proof, publicSignals);
    
    // Assert that proof is invalid
    expect(isValid).toBe(false);
  });
});