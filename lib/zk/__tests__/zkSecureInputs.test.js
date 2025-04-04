/**
 * Tests for zkSecureInputs
 * 
 * Tests the secure input generation and handling for ZK circuits.
 */

import { 
  generateSecureInputs, 
  getSecureInputs, 
  validateSecureInputs, 
  cleanupSecureInputs,
  SECURITY_LEVELS
} from '../zkSecureInputs';
import secureKeyManager from '../SecureKeyManager';
import secureStorage from '../secureStorage';
import { ZK_PROOF_TYPES } from '../../../config/constants';

// Mock dependencies
jest.mock('../SecureKeyManager', () => ({
  __esModule: true,
  default: {
    generateSecurePassword: jest.fn().mockReturnValue('generated-password'),
    encrypt: jest.fn().mockResolvedValue({ encrypted: true }),
    decrypt: jest.fn().mockResolvedValue({ decrypted: true }),
    encryptPrivateKey: jest.fn().mockResolvedValue({ encrypted: true }),
    decryptPrivateKey: jest.fn().mockResolvedValue('decrypted-private-key'),
    secureWipe: jest.fn()
  }
}));

jest.mock('../secureStorage', () => ({
  __esModule: true,
  default: {
    storeCircuitInput: jest.fn().mockResolvedValue('mock-input-id'),
    getCircuitInput: jest.fn().mockResolvedValue({
      privateAmount: '1000000000000000000',
      publicAmount: '1000000000000000000',
      privateAddress: Array(20).fill(1),
      publicAddressHash: '0xhash123'
    }),
    removeItem: jest.fn()
  }
}));

// Mock ethers.js
jest.mock('ethers', () => ({
  BigNumber: {
    from: jest.fn(val => ({
      toString: () => val,
      lt: jest.fn(other => Number(val) < Number(other)),
      gt: jest.fn(other => Number(val) > Number(other))
    })),
  },
  utils: {
    keccak256: jest.fn(val => `0xhash${val.replace(/0x/, '')}`),
    defaultAbiCoder: {
      encode: jest.fn(() => '0xencodedData')
    }
  }
}));

describe('zkSecureInputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('generateSecureInputs', () => {
    it('should generate secure standard proof inputs', async () => {
      const params = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000',
        proofType: ZK_PROOF_TYPES.STANDARD,
        securityOptions: {
          level: SECURITY_LEVELS.STANDARD,
          encryptInputs: true
        }
      };
      
      const result = await generateSecureInputs(params);
      
      // Check result structure
      expect(result).toHaveProperty('inputId', 'mock-input-id');
      expect(result).toHaveProperty('publicInputs');
      expect(result).toHaveProperty('sessionPassword', 'generated-password');
      
      // Verify input was stored
      expect(secureStorage.storeCircuitInput).toHaveBeenCalled();
    });
    
    it('should generate secure threshold proof inputs', async () => {
      const params = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000',
        proofType: ZK_PROOF_TYPES.THRESHOLD,
        securityOptions: {
          level: SECURITY_LEVELS.ENHANCED,
          encryptInputs: true
        }
      };
      
      const result = await generateSecureInputs(params);
      
      // Verify result
      expect(result).toHaveProperty('inputId');
      expect(result).toHaveProperty('publicInputs');
      expect(result.publicInputs).toHaveProperty('thresholdAmount');
      expect(result.publicInputs).toHaveProperty('publicAddressHash');
    });
    
    it('should generate secure maximum proof inputs', async () => {
      const params = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000',
        proofType: ZK_PROOF_TYPES.MAXIMUM,
        securityOptions: {
          level: SECURITY_LEVELS.MAXIMUM,
          encryptInputs: true
        },
        walletData: {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          privateKey: '0xprivatekey123'
        }
      };
      
      const result = await generateSecureInputs(params);
      
      // Verify result
      expect(result).toHaveProperty('inputId');
      expect(result).toHaveProperty('publicInputs');
      expect(result.publicInputs).toHaveProperty('maximumAmount');
      expect(result.publicInputs).toHaveProperty('publicAddressHash');
    });
    
    it('should return full inputs when encryption is disabled', async () => {
      const params = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000',
        proofType: ZK_PROOF_TYPES.STANDARD,
        securityOptions: {
          level: SECURITY_LEVELS.STANDARD,
          encryptInputs: false
        }
      };
      
      const result = await generateSecureInputs(params);
      
      // Verify full inputs are returned
      expect(result).toHaveProperty('inputs');
      expect(result).toHaveProperty('publicInputs');
      expect(result.inputs).toHaveProperty('privateAmount');
      expect(result.inputs).toHaveProperty('privateAddress');
      
      // Verify storage wasn't used
      expect(secureStorage.storeCircuitInput).not.toHaveBeenCalled();
    });
    
    it('should validate required parameters', async () => {
      // Missing address
      await expect(generateSecureInputs({
        amount: '1000000000000000000',
        proofType: ZK_PROOF_TYPES.STANDARD
      })).rejects.toThrow('Wallet address is required');
      
      // Missing amount
      await expect(generateSecureInputs({
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        proofType: ZK_PROOF_TYPES.STANDARD
      })).rejects.toThrow('Amount is required');
      
      // Missing proof type
      await expect(generateSecureInputs({
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000'
      })).rejects.toThrow('Proof type is required');
    });
    
    it('should handle invalid proof types', async () => {
      await expect(generateSecureInputs({
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000',
        proofType: 999
      })).rejects.toThrow('Invalid proof type');
    });
  });
  
  describe('getSecureInputs', () => {
    it('should retrieve and decrypt stored inputs', async () => {
      const inputId = 'test-input-id';
      const password = 'test-password';
      
      const result = await getSecureInputs(inputId, password);
      
      // Verify storage was called
      expect(secureStorage.getCircuitInput).toHaveBeenCalledWith(inputId, password);
      
      // Verify result structure
      expect(result).toHaveProperty('privateAmount');
      expect(result).toHaveProperty('publicAmount');
      expect(result).toHaveProperty('privateAddress');
      expect(result).toHaveProperty('publicAddressHash');
    });
    
    it('should handle retrieval errors', async () => {
      secureStorage.getCircuitInput.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(getSecureInputs('test-id', 'password'))
        .rejects.toThrow('Failed to retrieve secure inputs');
    });
  });
  
  describe('validateSecureInputs', () => {
    it('should validate standard proof inputs', () => {
      const inputs = {
        privateAmount: '1000000000000000000',
        publicAmount: '1000000000000000000',
        privateAddress: Array(20).fill(1),
        publicAddressHash: '0xhash123'
      };
      
      const isValid = validateSecureInputs(inputs, ZK_PROOF_TYPES.STANDARD);
      
      expect(isValid).toBe(true);
    });
    
    it('should validate threshold proof inputs', () => {
      const inputs = {
        privateAmount: '2000000000000000000', // More than threshold
        thresholdAmount: '1000000000000000000',
        privateAddress: Array(20).fill(1),
        publicAddressHash: '0xhash123'
      };
      
      const isValid = validateSecureInputs(inputs, ZK_PROOF_TYPES.THRESHOLD);
      
      expect(isValid).toBe(true);
    });
    
    it('should validate maximum proof inputs', () => {
      const inputs = {
        privateAmount: '1000000000000000000', // Less than maximum
        maximumAmount: '2000000000000000000',
        privateAddress: Array(20).fill(1),
        publicAddressHash: '0xhash123'
      };
      
      const isValid = validateSecureInputs(inputs, ZK_PROOF_TYPES.MAXIMUM);
      
      expect(isValid).toBe(true);
    });
    
    it('should reject invalid standard proof inputs', () => {
      // Missing public amount
      const inputs = {
        privateAmount: '1000000000000000000',
        privateAddress: Array(20).fill(1),
        publicAddressHash: '0xhash123'
      };
      
      const isValid = validateSecureInputs(inputs, ZK_PROOF_TYPES.STANDARD);
      
      expect(isValid).toBe(false);
    });
    
    it('should reject threshold proof with insufficient funds', () => {
      // Private amount less than threshold
      const inputs = {
        privateAmount: '500000000000000000',
        thresholdAmount: '1000000000000000000',
        privateAddress: Array(20).fill(1),
        publicAddressHash: '0xhash123'
      };
      
      const isValid = validateSecureInputs(inputs, ZK_PROOF_TYPES.THRESHOLD);
      
      expect(isValid).toBe(false);
    });
    
    it('should reject maximum proof with excessive funds', () => {
      // Private amount more than maximum
      const inputs = {
        privateAmount: '3000000000000000000',
        maximumAmount: '2000000000000000000',
        privateAddress: Array(20).fill(1),
        publicAddressHash: '0xhash123'
      };
      
      const isValid = validateSecureInputs(inputs, ZK_PROOF_TYPES.MAXIMUM);
      
      expect(isValid).toBe(false);
    });
    
    it('should validate address byte length', () => {
      // Incorrect address byte length
      const inputs = {
        privateAmount: '1000000000000000000',
        publicAmount: '1000000000000000000',
        privateAddress: [1, 2, 3], // Too short
        publicAddressHash: '0xhash123'
      };
      
      const isValid = validateSecureInputs(inputs, ZK_PROOF_TYPES.STANDARD);
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('cleanupSecureInputs', () => {
    it('should clean up stored inputs', async () => {
      const inputId = 'test-input-id';
      
      const result = await cleanupSecureInputs(inputId);
      
      // Verify storage removal was called
      expect(secureStorage.removeItem).toHaveBeenCalledWith(`zk-input-${inputId}`);
      expect(result).toBe(true);
    });
    
    it('should handle missing input ID', async () => {
      const result = await cleanupSecureInputs(null);
      
      // Should succeed but not call storage
      expect(result).toBe(true);
      expect(secureStorage.removeItem).not.toHaveBeenCalled();
    });
    
    it('should handle cleanup errors', async () => {
      secureStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      
      const result = await cleanupSecureInputs('test-input-id');
      
      // Should fail gracefully
      expect(result).toBe(false);
    });
  });
});