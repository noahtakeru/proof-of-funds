/**
 * ZK Utility Tests
 * 
 * This file contains tests for the zkUtils module, which provides 
 * core functionality for ZK proof generation and verification.
 */

// First, let's create the test directory if it doesn't exist
const fs = require('fs');
const path = require('path');

// Ensure the __tests__ directory exists
const testDir = path.join(__dirname);
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Import modules for testing
const { ZK_PROOF_TYPES } = require('../../../config/constants');
const { 
  generateZKProof, 
  verifyZKProof, 
  serializeZKProof, 
  deserializeZKProof 
} = require('../zkUtils');

// Test data
const TEST_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
const TEST_AMOUNT = '1000000000000000000'; // 1 ETH in wei

describe('ZK Utility Functions', () => {
  // Test proof generation
  describe('generateZKProof', () => {
    test('should generate a standard proof', async () => {
      const proof = await generateZKProof({
        walletAddress: TEST_WALLET_ADDRESS,
        amount: TEST_AMOUNT,
        proofType: ZK_PROOF_TYPES.STANDARD
      });
      
      // Verify the structure of the returned proof
      expect(proof).toBeDefined();
      expect(proof.walletAddress).toBe(TEST_WALLET_ADDRESS);
      expect(proof.proofType).toBe(ZK_PROOF_TYPES.STANDARD);
      expect(proof.amount).toBe(TEST_AMOUNT);
      expect(proof.timestamp).toBeDefined();
      expect(proof.proof).toBeDefined();
      expect(proof.publicSignals).toBeDefined();
    });
    
    test('should generate a threshold proof', async () => {
      const proof = await generateZKProof({
        walletAddress: TEST_WALLET_ADDRESS,
        amount: TEST_AMOUNT,
        proofType: ZK_PROOF_TYPES.THRESHOLD
      });
      
      expect(proof).toBeDefined();
      expect(proof.proofType).toBe(ZK_PROOF_TYPES.THRESHOLD);
    });
    
    test('should generate a maximum proof', async () => {
      const proof = await generateZKProof({
        walletAddress: TEST_WALLET_ADDRESS,
        amount: TEST_AMOUNT,
        proofType: ZK_PROOF_TYPES.MAXIMUM
      });
      
      expect(proof).toBeDefined();
      expect(proof.proofType).toBe(ZK_PROOF_TYPES.MAXIMUM);
    });
    
    test('should throw error with invalid inputs', async () => {
      await expect(generateZKProof({
        walletAddress: '', // Empty address
        amount: TEST_AMOUNT,
        proofType: ZK_PROOF_TYPES.STANDARD
      })).rejects.toThrow('Wallet address is required');
      
      await expect(generateZKProof({
        walletAddress: TEST_WALLET_ADDRESS,
        amount: '', // Empty amount
        proofType: ZK_PROOF_TYPES.STANDARD
      })).rejects.toThrow('Amount is required');
      
      await expect(generateZKProof({
        walletAddress: TEST_WALLET_ADDRESS,
        amount: TEST_AMOUNT,
        proofType: 999 // Invalid proof type
      })).rejects.toThrow('Proof generation not yet implemented');
    });
  });
  
  // Test proof verification
  describe('verifyZKProof', () => {
    let standardProof;
    
    // Generate a proof before tests
    beforeAll(async () => {
      standardProof = await generateZKProof({
        walletAddress: TEST_WALLET_ADDRESS,
        amount: TEST_AMOUNT,
        proofType: ZK_PROOF_TYPES.STANDARD
      });
    });
    
    test('should verify a valid proof', async () => {
      const isValid = await verifyZKProof({
        proof: standardProof.proof,
        publicSignals: standardProof.publicSignals,
        proofType: ZK_PROOF_TYPES.STANDARD
      });
      
      expect(isValid).toBe(true);
    });
    
    test('should handle invalid proof data', async () => {
      // Test with missing proof
      await expect(verifyZKProof({
        proof: null,
        publicSignals: standardProof.publicSignals,
        proofType: ZK_PROOF_TYPES.STANDARD
      })).rejects.toThrow('Proof is required');
      
      // Test with missing public signals
      await expect(verifyZKProof({
        proof: standardProof.proof,
        publicSignals: null,
        proofType: ZK_PROOF_TYPES.STANDARD
      })).rejects.toThrow('Public signals are required');
      
      // Test with invalid proof type
      await expect(verifyZKProof({
        proof: standardProof.proof,
        publicSignals: standardProof.publicSignals,
        proofType: 999
      })).rejects.toThrow('Production ZK proof verification not yet implemented');
    });
  });
  
  // Test serialization/deserialization
  describe('Proof serialization', () => {
    const mockProof = {
      pi_a: ['1', '2', '3'],
      pi_b: [['4', '5'], ['6', '7'], ['8', '9']],
      pi_c: ['10', '11', '12']
    };
    
    const mockPublicSignals = ['13', '14', '15'];
    
    test('should correctly serialize and deserialize a proof', () => {
      // Serialize
      const serialized = serializeZKProof(mockProof, mockPublicSignals);
      expect(serialized.proof).toBeDefined();
      expect(serialized.publicSignals).toBeDefined();
      
      // Deserialize
      const deserialized = deserializeZKProof(serialized.proof, serialized.publicSignals);
      expect(deserialized.proof).toEqual(mockProof);
      expect(deserialized.publicSignals).toEqual(mockPublicSignals);
    });
  });
});