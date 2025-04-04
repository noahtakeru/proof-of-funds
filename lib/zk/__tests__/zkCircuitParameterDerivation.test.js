/**
 * Tests for zkCircuitParameterDerivation.js module
 */

import { jest } from '@jest/globals';
import { ethers } from 'ethers';

// Import the module to test
import {
  generateProofNonce,
  generateProofId,
  normalizeAmountForCircuit,
  deriveAddressParameters,
  deriveSignatureParameters,
  canGenerateProofClientSide,
  deriveStandardProofParameters,
  deriveThresholdProofParameters,
  deriveMaximumProofParameters,
  deriveCircuitParameters,
  prepareCircuitInputs,
  validateCircuitParameters
} from '../zkCircuitParameterDerivation.js';

// Create mock for deviceCapabilities & zkCircuitRegistry
jest.mock('../deviceCapabilities.js', () => ({
  getDeviceCapabilities: jest.fn().mockReturnValue({
    supportsWebAssembly: true,
    supportsWebCrypto: true,
    supportsWebWorkers: true,
    availableMemory: 8000, // 8GB
    hasLowMemory: false,
    hasLimitedMemory: false
  })
}));

jest.mock('../zkCircuitRegistry.js', () => ({
  getCircuitMemoryRequirements: jest.fn().mockReturnValue({
    proving: 500,
    verifying: 100
  })
}));

describe('ZK Circuit Parameter Derivation', () => {
  // Test wallet and data for reuse
  const wallet = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890123');
  const testWalletAddress = wallet.address;
  const testAmount = '1000000000000000000'; // 1 ETH
  const testMessage = `I confirm ownership of wallet ${testWalletAddress}`;
  const testSignature = wallet.signMessage(testMessage);
  
  describe('generateProofNonce', () => {
    it('should generate a deterministic nonce from inputs', () => {
      const nonce1 = generateProofNonce(testWalletAddress, testAmount, 123456);
      const nonce2 = generateProofNonce(testWalletAddress, testAmount, 123456);
      
      // Same inputs should produce same nonce
      expect(nonce1).toEqual(nonce2);
      
      // Different timestamp should produce different nonce
      const nonce3 = generateProofNonce(testWalletAddress, testAmount, 654321);
      expect(nonce1).not.toEqual(nonce3);
      
      // Nonce should be in correct format (keccak256 hash)
      expect(nonce1).toMatch(/^0x[a-f0-9]{64}$/i);
    });
  });
  
  describe('generateProofId', () => {
    it('should generate a unique ID for a proof', () => {
      const id1 = generateProofId(testWalletAddress, 'standard', testAmount);
      const id2 = generateProofId(testWalletAddress, 'threshold', testAmount);
      
      // Different proof types should have different IDs
      expect(id1).not.toEqual(id2);
      
      // ID should have correct format: pof-[16 hex chars]
      expect(id1).toMatch(/^pof-[a-f0-9]{16}$/i);
      
      // Case insensitive for wallet address
      const id3 = generateProofId(testWalletAddress.toUpperCase(), 'standard', testAmount);
      expect(id1).toEqual(id3);
    });
  });
  
  describe('normalizeAmountForCircuit', () => {
    it('should convert decimal amounts to circuit format', () => {
      // 1.5 ETH with 18 decimals should be 1.5 * 10^18
      const result = normalizeAmountForCircuit('1.5', 18);
      expect(result).toBe('1500000000000000000');
    });
    
    it('should handle amounts already in wei format', () => {
      const weiAmount = '1000000000000000000'; // 1 ETH in wei
      const result = normalizeAmountForCircuit(weiAmount);
      expect(result).toBe(weiAmount);
    });
    
    it('should throw error for invalid amount format', () => {
      expect(() => normalizeAmountForCircuit('invalid')).toThrow();
    });
  });
  
  describe('deriveAddressParameters', () => {
    it('should derive address parameters correctly', () => {
      const result = deriveAddressParameters(testWalletAddress);
      
      // Should return original address
      expect(result.original).toBe(testWalletAddress);
      
      // Should return checksummed address
      expect(result.checksum).toBe(ethers.utils.getAddress(testWalletAddress));
      
      // Should convert to bytes
      expect(Array.isArray(result.bytes)).toBeTruthy();
      expect(result.bytes.length).toBe(20); // ETH address is 20 bytes
      
      // Should include hash
      expect(result.hash).toMatch(/^0x[a-f0-9]{64}$/i);
    });
    
    it('should throw error for invalid address', () => {
      expect(() => deriveAddressParameters('invalid')).toThrow();
    });
  });
  
  describe('deriveSignatureParameters', () => {
    it('should derive signature parameters correctly', async () => {
      const signature = await wallet.signMessage('Test message');
      const result = deriveSignatureParameters(testWalletAddress, signature);
      
      // Should have r, s, v components
      expect(result.r).toBeDefined();
      expect(result.s).toBeDefined();
      expect(result.v).toBeDefined();
      
      // Should have signature components array for circuit
      expect(Array.isArray(result.signatureComponents)).toBeTruthy();
      expect(result.signatureComponents.length).toBe(2); // r and s
      
      // Should have message hash and public key
      expect(result.messageHash).toMatch(/^0x[a-f0-9]{64}$/i);
      expect(result.publicKey).toBeDefined();
    });
    
    it('should throw error for missing signature', () => {
      expect(() => deriveSignatureParameters(testWalletAddress, null)).toThrow();
    });
  });
  
  describe('canGenerateProofClientSide', () => {
    it('should return true for capable devices', () => {
      const result = canGenerateProofClientSide('standard');
      expect(result).toBeTruthy();
    });
    
    it('should respect user preference for server-side processing', () => {
      const result = canGenerateProofClientSide('standard', { preferServerSide: true });
      expect(result).toBeFalsy();
    });
  });
  
  describe('deriveStandardProofParameters', () => {
    it('should derive standard proof parameters correctly', () => {
      const result = deriveStandardProofParameters({
        walletAddress: testWalletAddress,
        amount: testAmount
      });
      
      // Should have public and private inputs
      expect(result.publicInputs).toBeDefined();
      expect(result.privateInputs).toBeDefined();
      
      // Public inputs should have address and amount
      expect(result.publicInputs.address).toBeDefined();
      expect(result.publicInputs.amount).toBe(testAmount);
      
      // Private inputs should have address bytes and nonce
      expect(Array.isArray(result.privateInputs.addressBytes)).toBeTruthy();
      expect(result.privateInputs.nonce).toBeDefined();
      
      // Metadata should include proof type
      expect(result.metadata.proofType).toBe('standard');
      expect(result.metadata.walletAddress).toBe(testWalletAddress);
    });
    
    it('should include signature if provided', async () => {
      const result = deriveStandardProofParameters({
        walletAddress: testWalletAddress,
        amount: testAmount,
        signature: await wallet.signMessage('Test message')
      });
      
      // Private inputs should include signature
      expect(Array.isArray(result.privateInputs.signature)).toBeTruthy();
    });
  });
  
  describe('deriveThresholdProofParameters', () => {
    it('should derive threshold proof parameters correctly', () => {
      const result = deriveThresholdProofParameters({
        walletAddress: testWalletAddress,
        amount: '1.0', // 1 ETH threshold
        actualBalance: '2.0' // 2 ETH actual balance
      });
      
      // Should have public and private inputs
      expect(result.publicInputs).toBeDefined();
      expect(result.privateInputs).toBeDefined();
      
      // Public inputs should have address and threshold
      expect(result.publicInputs.address).toBeDefined();
      expect(result.publicInputs.threshold).toBeDefined();
      
      // Private inputs should have actual balance
      expect(result.privateInputs.actualBalance).toBeDefined();
      
      // Metadata should include proof type
      expect(result.metadata.proofType).toBe('threshold');
    });
    
    it('should throw error if actual balance is below threshold', () => {
      expect(() => deriveThresholdProofParameters({
        walletAddress: testWalletAddress,
        amount: '2.0', // 2 ETH threshold
        actualBalance: '1.0' // 1 ETH actual balance
      })).toThrow();
    });
    
    it('should throw error if actual balance is missing', () => {
      expect(() => deriveThresholdProofParameters({
        walletAddress: testWalletAddress,
        amount: '1.0'
      })).toThrow();
    });
  });
  
  describe('deriveMaximumProofParameters', () => {
    it('should derive maximum proof parameters correctly', () => {
      const result = deriveMaximumProofParameters({
        walletAddress: testWalletAddress,
        amount: '2.0', // 2 ETH maximum
        actualBalance: '1.0' // 1 ETH actual balance
      });
      
      // Should have public and private inputs
      expect(result.publicInputs).toBeDefined();
      expect(result.privateInputs).toBeDefined();
      
      // Public inputs should have address and maximum
      expect(result.publicInputs.address).toBeDefined();
      expect(result.publicInputs.maximum).toBeDefined();
      
      // Private inputs should have actual balance
      expect(result.privateInputs.actualBalance).toBeDefined();
      
      // Metadata should include proof type
      expect(result.metadata.proofType).toBe('maximum');
    });
    
    it('should throw error if actual balance is above maximum', () => {
      expect(() => deriveMaximumProofParameters({
        walletAddress: testWalletAddress,
        amount: '1.0', // 1 ETH maximum
        actualBalance: '2.0' // 2 ETH actual balance
      })).toThrow();
    });
    
    it('should throw error if actual balance is missing', () => {
      expect(() => deriveMaximumProofParameters({
        walletAddress: testWalletAddress,
        amount: '2.0'
      })).toThrow();
    });
  });
  
  describe('deriveCircuitParameters', () => {
    it('should call the correct derivation function based on proof type', () => {
      // Standard proof
      const standardResult = deriveCircuitParameters({
        walletAddress: testWalletAddress,
        amount: testAmount,
        proofType: 'standard'
      });
      
      expect(standardResult.metadata.proofType).toBe('standard');
      
      // Threshold proof
      const thresholdResult = deriveCircuitParameters({
        walletAddress: testWalletAddress,
        amount: '1.0', // 1 ETH threshold
        actualBalance: '2.0', // 2 ETH actual balance
        proofType: 'threshold'
      });
      
      expect(thresholdResult.metadata.proofType).toBe('threshold');
      
      // Maximum proof
      const maximumResult = deriveCircuitParameters({
        walletAddress: testWalletAddress,
        amount: '2.0', // 2 ETH maximum
        actualBalance: '1.0', // 1 ETH actual balance
        proofType: 'maximum'
      });
      
      expect(maximumResult.metadata.proofType).toBe('maximum');
    });
    
    it('should throw error for unsupported proof type', () => {
      expect(() => deriveCircuitParameters({
        walletAddress: testWalletAddress,
        amount: testAmount,
        proofType: 'unsupported'
      })).toThrow();
    });
    
    it('should throw error for missing required parameters', () => {
      // Missing wallet address
      expect(() => deriveCircuitParameters({
        amount: testAmount,
        proofType: 'standard'
      })).toThrow();
      
      // Missing amount
      expect(() => deriveCircuitParameters({
        walletAddress: testWalletAddress,
        proofType: 'standard'
      })).toThrow();
      
      // Missing proof type
      expect(() => deriveCircuitParameters({
        walletAddress: testWalletAddress,
        amount: testAmount
      })).toThrow();
    });
  });
  
  describe('prepareCircuitInputs', () => {
    it('should format circuit inputs correctly for standard proof', () => {
      const parameters = deriveStandardProofParameters({
        walletAddress: testWalletAddress,
        amount: testAmount
      });
      
      const result = prepareCircuitInputs(parameters);
      
      // Should have circuit inputs and metadata
      expect(result.circuitInputs).toBeDefined();
      expect(result.metadata).toBeDefined();
      
      // Circuit inputs should have the correct format
      expect(result.circuitInputs.address).toBeDefined();
      expect(result.circuitInputs.amount).toBeDefined();
      expect(result.circuitInputs.nonce).toBeDefined();
      expect(Array.isArray(result.circuitInputs.addressBytes)).toBeTruthy();
    });
    
    it('should format circuit inputs correctly for threshold proof', () => {
      const parameters = deriveThresholdProofParameters({
        walletAddress: testWalletAddress,
        amount: '1.0',
        actualBalance: '2.0'
      });
      
      const result = prepareCircuitInputs(parameters);
      
      // Circuit inputs should have threshold format
      expect(result.circuitInputs.threshold).toBeDefined();
      expect(result.circuitInputs.actualBalance).toBeDefined();
    });
    
    it('should format circuit inputs correctly for maximum proof', () => {
      const parameters = deriveMaximumProofParameters({
        walletAddress: testWalletAddress,
        amount: '2.0',
        actualBalance: '1.0'
      });
      
      const result = prepareCircuitInputs(parameters);
      
      // Circuit inputs should have maximum format
      expect(result.circuitInputs.maximum).toBeDefined();
      expect(result.circuitInputs.actualBalance).toBeDefined();
    });
  });
  
  describe('validateCircuitParameters', () => {
    it('should validate correct parameters', () => {
      const parameters = deriveStandardProofParameters({
        walletAddress: testWalletAddress,
        amount: testAmount
      });
      
      const result = validateCircuitParameters(parameters);
      
      expect(result.valid).toBeTruthy();
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect missing required parameters', () => {
      // Create incomplete parameters
      const parameters = {
        publicInputs: {},
        privateInputs: {},
        metadata: { proofType: 'standard' }
      };
      
      const result = validateCircuitParameters(parameters);
      
      expect(result.valid).toBeFalsy();
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should validate threshold proof balance constraint', () => {
      // Create threshold parameters with invalid balance
      const parameters = {
        publicInputs: {
          address: '0x1234',
          threshold: '2000000000000000000' // 2 ETH
        },
        privateInputs: {
          addressBytes: Array(20).fill(0),
          nonce: '0x1234',
          actualBalance: '1000000000000000000' // 1 ETH (less than threshold)
        },
        metadata: { proofType: 'threshold' }
      };
      
      const result = validateCircuitParameters(parameters);
      
      expect(result.valid).toBeFalsy();
      expect(result.errors.some(e => e.includes('Actual balance'))).toBeTruthy();
    });
    
    it('should validate maximum proof balance constraint', () => {
      // Create maximum parameters with invalid balance
      const parameters = {
        publicInputs: {
          address: '0x1234',
          maximum: '1000000000000000000' // 1 ETH
        },
        privateInputs: {
          addressBytes: Array(20).fill(0),
          nonce: '0x1234',
          actualBalance: '2000000000000000000' // 2 ETH (more than maximum)
        },
        metadata: { proofType: 'maximum' }
      };
      
      const result = validateCircuitParameters(parameters);
      
      expect(result.valid).toBeFalsy();
      expect(result.errors.some(e => e.includes('Actual balance'))).toBeTruthy();
    });
  });
});