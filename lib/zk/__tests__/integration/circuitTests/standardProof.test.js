/**
 * Standard Proof Integration Test
 * 
 * This file contains integration tests for the Standard Proof circuit using
 * real cryptographic operations.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as snarkjs from 'snarkjs';

// Custom utilities for integration testing
import { loadCircuit, getCircuitPath } from '../utils/testCircuits.js';
import { getTestWallets } from '../utils/testVectors.js';

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
async function generateStandardProof(input) {
  // Load circuit artifacts
  const circuitWasm = path.join(buildDir, 'standard/standardProof.wasm');
  const circuitZkey = path.join(buildDir, 'standard/standardProof.zkey');
  
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
async function verifyStandardProof(proof, publicSignals) {
  // Load verification key
  const vkeyPath = path.join(buildDir, 'standard/verification_key.json');
  const vkeyJson = readFileSync(vkeyPath, 'utf-8');
  const vkey = JSON.parse(vkeyJson);
  
  // Verify proof using real snarkjs
  return await snarkjs.groth16.verify(vkey, publicSignals, proof);
}

describe('Standard Proof Circuit Integration Tests', () => {
  // Test vectors with real wallet data
  const testWallets = getTestWallets();
  
  // Test case: Valid proof with exact amount match
  test('Valid standard proof with exact amount match', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('standard')) {
      console.warn('Skipping test: Standard circuit artifacts not available');
      return;
    }
    
    // Prepare input for the circuit
    const input = {
      walletAddress: testWallets[0].addressBytes, // Convert address to bytes
      amount: testWallets[0].balance,
      nonce: '123456789' // Some deterministic nonce for testing
    };
    
    // Generate proof
    const { proof, publicSignals } = await generateStandardProof(input);
    
    // Verify proof
    const isValid = await verifyStandardProof(proof, publicSignals);
    
    // Assert that proof is valid
    expect(isValid).toBe(true);
  });
  
  // Test case: Invalid proof with mismatched amount
  test('Invalid standard proof with mismatched amount', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('standard')) {
      console.warn('Skipping test: Standard circuit artifacts not available');
      return;
    }
    
    // Prepare input with incorrect amount
    const mismatchedAmount = '1500000000000000000'; // 1.5 ETH
    const input = {
      walletAddress: testWallets[0].addressBytes,
      amount: mismatchedAmount, // Doesn't match actual balance
      nonce: '123456789'
    };
    
    // Generate proof
    const { proof, publicSignals } = await generateStandardProof(input);
    
    // Verify proof - should fail verification
    const isValid = await verifyStandardProof(proof, publicSignals);
    
    // Assert that proof is invalid
    expect(isValid).toBe(false);
  });
  
  // Test case: Invalid proof with insufficient balance
  test('Invalid standard proof with insufficient balance', async () => {
    // Skip test if circuit artifacts aren't available
    if (!isCircuitAvailable('standard')) {
      console.warn('Skipping test: Standard circuit artifacts not available');
      return;
    }
    
    // Prepare input with wallet that has insufficient balance
    const input = {
      walletAddress: testWallets[1].addressBytes, // Wallet with 0.5 ETH
      amount: '1000000000000000000',  // Trying to prove 1 ETH
      nonce: '123456789'
    };
    
    // Generate proof
    const { proof, publicSignals } = await generateStandardProof(input);
    
    // Verify proof - should fail verification
    const isValid = await verifyStandardProof(proof, publicSignals);
    
    // Assert that proof is invalid
    expect(isValid).toBe(false);
  });
  
  // Helper function to check if circuit artifacts are available
  function isCircuitAvailable(circuitType) {
    try {
      const wasmPath = path.join(buildDir, `${circuitType}/${circuitType}Proof.wasm`);
      const zkeyPath = path.join(buildDir, `${circuitType}/${circuitType}Proof.zkey`);
      const vkeyPath = path.join(buildDir, `${circuitType}/verification_key.json`);
      
      return (
        fs.existsSync(wasmPath) &&
        fs.existsSync(zkeyPath) &&
        fs.existsSync(vkeyPath)
      );
    } catch (error) {
      return false;
    }
  }
});