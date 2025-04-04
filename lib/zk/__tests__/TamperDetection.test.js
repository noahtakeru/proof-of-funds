/**
 * Tests for Tamper Detection
 * 
 * Tests the integrity protection, tampering detection, and canary values.
 */

import TamperDetection from '../TamperDetection';

// Mock Web Crypto API for testing
const mockSubtle = {
  importKey: jest.fn().mockResolvedValue('mock-crypto-key'),
  sign: jest.fn().mockImplementation(() => {
    const signature = new Uint8Array(32);
    // Fill with deterministic pattern for testing
    for (let i = 0; i < signature.length; i++) {
      signature[i] = i % 256;
    }
    return Promise.resolve(signature.buffer);
  })
};

// Mock TextEncoder
global.TextEncoder = class TextEncoder {
  encode(text) {
    const buffer = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      buffer[i] = text.charCodeAt(i);
    }
    return buffer;
  }
};

// Mock window
global.window = {
  sessionStorage: {}
};

// Mock crypto
global.crypto = {
  subtle: mockSubtle,
  getRandomValues: jest.fn(arr => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = i % 256;
    }
    return arr;
  })
};

describe('TamperDetection', () => {
  let tamperDetection;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh instance for each test
    tamperDetection = new TamperDetection({
      enabled: true,
      canaryCount: 2 // Use smaller count for testing
    });
  });
  
  describe('basic functionality', () => {
    it('should initialize with default settings', () => {
      const defaultDetection = new TamperDetection();
      
      expect(defaultDetection.enabled).toBe(true);
      expect(defaultDetection.canaryCount).toBe(3);
      expect(defaultDetection.crypto).toBe(crypto);
      expect(defaultDetection.subtle).toBe(crypto.subtle);
    });
    
    it('should respect disabled flag', async () => {
      const disabledDetection = new TamperDetection({ enabled: false });
      
      // Original data should be returned unchanged
      const testData = { foo: 'bar' };
      const protected1 = await disabledDetection.protect(testData, 'secret-key');
      
      expect(protected1).toEqual(testData);
      
      // Verification should always return true when disabled
      const verified = await disabledDetection.verify(testData, 'secret-key');
      
      expect(verified).toBe(true);
    });
  });
  
  describe('data protection and verification', () => {
    it('should protect data with integrity features', async () => {
      const testData = {
        id: 'test-123',
        value: 'sensitive-data',
        timestamp: Date.now()
      };
      
      const protectedData = await tamperDetection.protect(testData, 'secret-key');
      
      // Should add integrity fields
      expect(protectedData).toHaveProperty('meta');
      expect(protectedData).toHaveProperty('signature');
      expect(protectedData).toHaveProperty('canaries');
      
      // Original data should be preserved
      expect(protectedData.id).toBe(testData.id);
      expect(protectedData.value).toBe(testData.value);
      expect(protectedData.timestamp).toBe(testData.timestamp);
      
      // Check canaries
      expect(protectedData.canaries).toBeInstanceOf(Array);
      expect(protectedData.canaries.length).toBe(tamperDetection.canaryCount);
      
      // Each canary should have the expected structure
      protectedData.canaries.forEach((canary, index) => {
        expect(canary).toHaveProperty('random');
        expect(canary).toHaveProperty('timestamp');
        expect(canary).toHaveProperty('derived');
        expect(canary).toHaveProperty('index', index);
      });
    });
    
    it('should verify untampered data successfully', async () => {
      const testData = {
        id: 'test-123',
        value: 'sensitive-data'
      };
      
      // Protect the data
      const protectedData = await tamperDetection.protect(testData, 'secret-key');
      
      // Verify the protected data
      const isValid = await tamperDetection.verify(protectedData, 'secret-key');
      
      expect(isValid).toBe(true);
    });
    
    it('should detect tampered data', async () => {
      // Create protected data
      const testData = { id: 'test-123', value: 'original-value' };
      const protectedData = await tamperDetection.protect(testData, 'secret-key');
      
      // Tamper with the data
      const tamperedData = { ...protectedData, value: 'tampered-value' };
      
      // Verify the tampered data
      const isValid = await tamperDetection.verify(tamperedData, 'secret-key');
      
      expect(isValid).toBe(false);
    });
    
    it('should detect tampered signature', async () => {
      // Create protected data
      const testData = { id: 'test-123', value: 'original-value' };
      const protectedData = await tamperDetection.protect(testData, 'secret-key');
      
      // Tamper with the signature
      const tamperedData = { 
        ...protectedData, 
        signature: 'tampered-signature'
      };
      
      // Verify the tampered data
      const isValid = await tamperDetection.verify(tamperedData, 'secret-key');
      
      expect(isValid).toBe(false);
    });
    
    it('should detect tampered canaries', async () => {
      // Create protected data
      const testData = { id: 'test-123', value: 'original-value' };
      const protectedData = await tamperDetection.protect(testData, 'secret-key');
      
      // Tamper with a canary
      const tamperedData = { 
        ...protectedData, 
        canaries: [
          ...protectedData.canaries.slice(0, -1),
          { ...protectedData.canaries[protectedData.canaries.length - 1], derived: 'tampered' }
        ]
      };
      
      // Verify the tampered data
      const isValid = await tamperDetection.verify(tamperedData, 'secret-key');
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('signature generation and verification', () => {
    it('should calculate signatures using Web Crypto when available', async () => {
      const testData = { id: 'test-123' };
      
      // Calculate signature
      const signature = await tamperDetection.calculateSignature(testData, 'secret-key');
      
      // Should have called Web Crypto
      expect(mockSubtle.importKey).toHaveBeenCalled();
      expect(mockSubtle.sign).toHaveBeenCalled();
      
      // Should return a hex string
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(32);
    });
    
    it('should fallback to simple signature when Web Crypto fails', async () => {
      // Mock an error in Web Crypto
      mockSubtle.importKey.mockRejectedValueOnce(new Error('Web Crypto failed'));
      
      // Spy on the simple signature method
      const spy = jest.spyOn(tamperDetection, 'calculateSimpleSignature');
      
      const testData = { id: 'test-123' };
      
      // Calculate signature
      const signature = await tamperDetection.calculateSignature(testData, 'secret-key');
      
      // Should have called the simple signature method
      expect(spy).toHaveBeenCalled();
      
      // Should still return a string
      expect(typeof signature).toBe('string');
    });
    
    it('should compare signatures in constant time', () => {
      // Same signatures
      const result1 = tamperDetection.compareSignatures(
        '1234567890abcdef1234567890abcdef', 
        '1234567890abcdef1234567890abcdef'
      );
      expect(result1).toBe(true);
      
      // Different signatures
      const result2 = tamperDetection.compareSignatures(
        '1234567890abcdef1234567890abcdef', 
        '0234567890abcdef1234567890abcdef' // First char different
      );
      expect(result2).toBe(false);
      
      // Signatures with different lengths
      const result3 = tamperDetection.compareSignatures(
        '1234567890abcdef1234567890abcdef', 
        '1234567890abcdef1234567890abcdef00' // Longer
      );
      expect(result3).toBe(true); // Should still match as we truncate to shorter length
    });
  });
  
  describe('canary values', () => {
    it('should generate the expected number of canaries', async () => {
      const canaries = await tamperDetection.generateCanaries('test-key');
      
      expect(canaries.length).toBe(tamperDetection.canaryCount);
      
      // Each canary should have the expected structure
      canaries.forEach((canary, index) => {
        expect(canary).toHaveProperty('random');
        expect(canary).toHaveProperty('timestamp');
        expect(canary).toHaveProperty('derived');
        expect(canary).toHaveProperty('index', index);
      });
    });
    
    it('should verify valid canaries', async () => {
      const canaries = await tamperDetection.generateCanaries('test-key');
      
      // Verify the canaries
      const isValid = await tamperDetection.verifyCanaries(canaries, 'test-key');
      
      expect(isValid).toBe(true);
    });
    
    it('should detect modified canaries', async () => {
      const canaries = await tamperDetection.generateCanaries('test-key');
      
      // Modify a canary
      const modifiedCanaries = [...canaries];
      modifiedCanaries[0] = {
        ...modifiedCanaries[0],
        derived: 'tampered-value'
      };
      
      // Verify the modified canaries
      const isValid = await tamperDetection.verifyCanaries(modifiedCanaries, 'test-key');
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('remote signing and verification', () => {
    it('should sign data for remote verification', async () => {
      const testData = {
        id: 'test-123',
        action: 'test-action'
      };
      
      // Sign for remote
      const signedData = await tamperDetection.signForRemote(testData, 'secret-key');
      
      // Should add signature fields
      expect(signedData).toHaveProperty('_signature');
      expect(signedData).toHaveProperty('_timestamp');
      expect(signedData).toHaveProperty('_nonce');
      
      // Original data should be preserved
      expect(signedData.id).toBe(testData.id);
      expect(signedData.action).toBe(testData.action);
    });
    
    it('should verify remotely signed data', async () => {
      const testData = {
        id: 'test-123',
        action: 'test-action'
      };
      
      // Sign for remote
      const signedData = await tamperDetection.signForRemote(testData, 'secret-key');
      
      // Verify the signed data
      const isValid = await tamperDetection.verifyRemoteSignature(signedData, 'secret-key');
      
      expect(isValid).toBe(true);
    });
    
    it('should detect tampered remote data', async () => {
      const testData = {
        id: 'test-123',
        action: 'test-action'
      };
      
      // Sign for remote
      const signedData = await tamperDetection.signForRemote(testData, 'secret-key');
      
      // Tamper with the data
      const tamperedData = { ...signedData, action: 'tampered-action' };
      
      // Verify the tampered data
      const isValid = await tamperDetection.verifyRemoteSignature(tamperedData, 'secret-key');
      
      expect(isValid).toBe(false);
    });
  });
});