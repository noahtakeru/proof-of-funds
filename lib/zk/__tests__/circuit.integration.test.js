/**
 * Circuit Integration Tests
 * 
 * These tests verify that the compiled Circom circuits work correctly with the ZK proof system.
 * They use actual compiled circuits and test real wallet addresses with realistic balances.
 * 
 * Requirements:
 * - The circuits must be compiled before running these tests
 * - Run 'node circuits/compile.js' first to generate required circuit files
 */

import fs from 'fs';
import path from 'path';
import * as snarkjs from 'snarkjs';
import { ethers } from 'ethers';
import { generateZKProof, verifyProofLocally } from '../zkProofGenerator';
import { encryptProof, decryptProof } from '../proofEncryption';

// Path to compiled circuit files
const CIRCUIT_DIR = path.join(process.cwd(), 'circuits/compiled/balance_verification');
const WASM_PATH = path.join(CIRCUIT_DIR, 'balance_verification_js/balance_verification.wasm');
const ZKEY_PATH = path.join(CIRCUIT_DIR, 'balance_verification_final.zkey');
const VKEY_PATH = path.join(CIRCUIT_DIR, 'verification_key.json');

// Test wallet data (using test wallet addresses and realistic balances)
const TEST_WALLETS = [
  {
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', // Test wallet 1
    balance: ethers.utils.parseEther('10.0'), // 10 ETH
    network: 'ethereum'
  },
  {
    address: '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', // Test wallet 2
    balance: ethers.utils.parseEther('5.5'), // 5.5 ETH
    network: 'ethereum'
  },
  {
    address: '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec', // Test wallet 3
    balance: ethers.utils.parseEther('0.25'), // 0.25 ETH
    network: 'ethereum'
  }
];

// Skip tests if circuit files don't exist
const circuitFilesExist = 
  fs.existsSync(WASM_PATH) && 
  fs.existsSync(ZKEY_PATH) && 
  fs.existsSync(VKEY_PATH);

// Conditional test suite
(circuitFilesExist ? describe : describe.skip)('Circuit Integration Tests', () => {
  
  beforeAll(() => {
    // Make a note about required circuit files if they don't exist
    if (!circuitFilesExist) {
      console.warn(
        'Circuit files not found. Skipping integration tests.\n' +
        'Run "node circuits/compile.js" to generate required circuit files.'
      );
    }
  });

  test('generates proof using actual circuit - STANDARD (equal) proof type', async () => {
    const wallet = TEST_WALLETS[0];
    const threshold = wallet.balance;
    const proofType = 0; // STANDARD - equal to threshold
    
    const proof = await generateZKProof(
      wallet.address,
      wallet.balance.toString(),
      threshold.toString(),
      proofType,
      wallet.network
    );
    
    // Make sure we got a proof with the expected structure
    expect(proof).toHaveProperty('proof');
    expect(proof).toHaveProperty('publicSignals');
    expect(proof).toHaveProperty('solidity');
    expect(proof).toHaveProperty('originalInput');
    
    // For real circuit runs, we should NOT have the _simulated property
    expect(proof).not.toHaveProperty('_simulated');
    
    // Verify that the public signals are as expected (4 outputs)
    expect(Array.isArray(proof.publicSignals)).toBe(true);
    expect(proof.publicSignals.length).toBe(4);
    
    // The last public signal should be 1 (true) for this proof
    expect(proof.publicSignals[3]).toBe('1');
  }, 10000); // Allow extra time for circuit operations

  test('generates proof using actual circuit - THRESHOLD (greater or equal) proof type', async () => {
    const wallet = TEST_WALLETS[0];
    const threshold = ethers.utils.parseEther('5.0'); // 5 ETH (less than wallet balance)
    const proofType = 1; // THRESHOLD - greater than or equal to threshold
    
    const proof = await generateZKProof(
      wallet.address,
      wallet.balance.toString(),
      threshold.toString(),
      proofType,
      wallet.network
    );
    
    // Verify the proof structure
    expect(proof).toHaveProperty('proof');
    expect(proof).toHaveProperty('publicSignals');
    
    // The proof should be true (wallet balance >= threshold)
    expect(proof.publicSignals[3]).toBe('1');
  }, 10000);

  test('generates proof using actual circuit - MAXIMUM (less or equal) proof type', async () => {
    const wallet = TEST_WALLETS[2]; // Use the wallet with the smallest balance
    const threshold = ethers.utils.parseEther('1.0'); // 1 ETH (more than wallet balance)
    const proofType = 2; // MAXIMUM - less than or equal to threshold
    
    const proof = await generateZKProof(
      wallet.address,
      wallet.balance.toString(),
      threshold.toString(),
      proofType,
      wallet.network
    );
    
    // Verify the proof structure
    expect(proof).toHaveProperty('proof');
    expect(proof).toHaveProperty('publicSignals');
    
    // The proof should be true (wallet balance <= threshold)
    expect(proof.publicSignals[3]).toBe('1');
  }, 10000);

  test('generates false result when condition is not met', async () => {
    const wallet = TEST_WALLETS[0]; // 10 ETH
    const threshold = ethers.utils.parseEther('20.0'); // 20 ETH (more than wallet balance)
    const proofType = 1; // THRESHOLD - greater than or equal to threshold
    
    const proof = await generateZKProof(
      wallet.address,
      wallet.balance.toString(),
      threshold.toString(),
      proofType,
      wallet.network
    );
    
    // The proof should be false (wallet balance < threshold)
    expect(proof.publicSignals[3]).toBe('0');
  }, 10000);

  test('verifies proofs using the verification key', async () => {
    const wallet = TEST_WALLETS[0];
    const threshold = wallet.balance;
    const proofType = 0; // STANDARD
    
    // Generate the proof
    const proof = await generateZKProof(
      wallet.address,
      wallet.balance.toString(),
      threshold.toString(),
      proofType,
      wallet.network
    );
    
    // Verify using the verification key
    const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
    const isValid = await snarkjs.groth16.verify(
      vkey,
      proof.publicSignals,
      proof.proof
    );
    
    expect(isValid).toBe(true);
  }, 10000);

  test('encrypts and decrypts proof with proper access key', async () => {
    const wallet = TEST_WALLETS[1];
    const threshold = ethers.utils.parseEther('5.0');
    const proofType = 1; // THRESHOLD
    
    // Generate the proof
    const proof = await generateZKProof(
      wallet.address,
      wallet.balance.toString(),
      threshold.toString(),
      proofType,
      wallet.network
    );
    
    // Generate a access key
    const accessKey = 'TestAccessKey123!';
    
    // Encrypt the proof
    const encryptedData = encryptProof(proof, accessKey);
    expect(encryptedData).toBeTruthy();
    
    // Decrypt the proof with the correct key
    const decryptedProof = decryptProof(encryptedData, accessKey);
    expect(decryptedProof).toEqual(proof);
    
    // Attempt to decrypt with incorrect key should fail
    const wrongKey = 'WrongKey456!';
    const failedDecrypt = decryptProof(encryptedData, wrongKey);
    expect(failedDecrypt).toBeNull();
  });

  test('generates and verifies proof locally', async () => {
    const wallet = TEST_WALLETS[2];
    const threshold = ethers.utils.parseEther('0.2'); // 0.2 ETH (less than wallet balance)
    const proofType = 1; // THRESHOLD
    
    // Generate the proof
    const proof = await generateZKProof(
      wallet.address,
      wallet.balance.toString(),
      threshold.toString(),
      proofType,
      wallet.network
    );
    
    // Verify the proof locally
    const isValid = await verifyProofLocally(proof, wallet.address, proofType);
    expect(isValid).toBe(true);
    
    // A proof with incorrect parameters should fail verification
    const incorrectWallet = TEST_WALLETS[0];
    const isInvalid = await verifyProofLocally(proof, incorrectWallet.address, proofType);
    expect(isInvalid).toBe(false);
  });

  test('generates proof that can be verified with Solidity verifier', async () => {
    // This test would typically require deploying the Solidity verifier contract
    // For now, we'll just check that the solidity-formatted proof is correctly structured
    
    const wallet = TEST_WALLETS[0];
    const threshold = wallet.balance;
    const proofType = 0; // STANDARD
    
    const proof = await generateZKProof(
      wallet.address,
      wallet.balance.toString(),
      threshold.toString(),
      proofType,
      wallet.network
    );
    
    // Check that the solidity property exists and has the correct format
    expect(proof).toHaveProperty('solidity');
    expect(proof.solidity).toHaveProperty('a');
    expect(proof.solidity).toHaveProperty('b');
    expect(proof.solidity).toHaveProperty('c');
    expect(proof.solidity).toHaveProperty('input');
    
    // Check array structures
    expect(Array.isArray(proof.solidity.a)).toBe(true);
    expect(Array.isArray(proof.solidity.b)).toBe(true);
    expect(Array.isArray(proof.solidity.c)).toBe(true);
    expect(Array.isArray(proof.solidity.input)).toBe(true);
    
    // Check that inputs match public signals
    expect(proof.solidity.input).toEqual(proof.publicSignals);
  });
});