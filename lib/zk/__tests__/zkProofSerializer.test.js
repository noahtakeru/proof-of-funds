/**
 * Tests for zkProofSerializer.js module
 */

// Import module to test
import zkProofSerializer from '../zkProofSerializer.js';
import { Buffer } from 'buffer';

// Mock window and Buffer for Base64 encoding/decoding
global.window = {
  btoa: (str) => Buffer.from(str).toString('base64'),
  atob: (b64) => Buffer.from(b64, 'base64').toString('utf8')
};

describe('ZK Proof Serialization', () => {
  // Sample proof data for tests
  const sampleProof = {
    pi_a: ["1234", "5678", "1"],
    pi_b: [["91011", "121314"], ["151617", "181920"], ["1", "0"]],
    pi_c: ["212223", "242526", "1"],
    protocol: "groth16"
  };
  
  const samplePublicSignals = ["303132", "333435"];
  
  const sampleOptions = {
    type: 'standard',
    version: 'v1.0.0',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    amount: '1000000000000000000'
  };
  
  describe('serializeProof', () => {
    it('should serialize a proof correctly', () => {
      const serialized = zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, sampleOptions);
      
      // Check that serialized is a non-empty string
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(0);
      
      // Should be Base64 encoded
      expect(() => {
        window.atob(serialized);
      }).not.toThrow();
    });
    
    it('should throw error for missing proof data', () => {
      expect(() => {
        zkProofSerializer.serializeProof(null, samplePublicSignals, sampleOptions);
      }).toThrow('Invalid proof data');
      
      expect(() => {
        zkProofSerializer.serializeProof(sampleProof, null, sampleOptions);
      }).toThrow('Invalid proof data');
    });
    
    it('should throw error for missing options', () => {
      expect(() => {
        zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, null);
      }).toThrow('Invalid options');
      
      expect(() => {
        zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, {});
      }).toThrow('Invalid options');
      
      expect(() => {
        zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, { type: 'standard' });
      }).toThrow('Invalid options');
    });
  });
  
  describe('deserializeProof', () => {
    it('should deserialize a proof correctly', () => {
      const serialized = zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, sampleOptions);
      const deserialized = zkProofSerializer.deserializeProof(serialized);
      
      // Check that deserialized is an object
      expect(typeof deserialized).toBe('object');
      
      // Check that it has the expected format
      expect(deserialized).toHaveProperty('format');
      expect(deserialized).toHaveProperty('circuit');
      expect(deserialized).toHaveProperty('proof');
      expect(deserialized).toHaveProperty('metadata');
      
      // Check that the format is correct
      expect(deserialized.format.version).toBe(zkProofSerializer.PROOF_FORMAT_VERSION);
      expect(deserialized.format.type).toBe('zk-proof-of-funds');
      
      // Check that the circuit is correct
      expect(deserialized.circuit.type).toBe(sampleOptions.type);
      expect(deserialized.circuit.version).toBe(sampleOptions.version);
      
      // Check that the proof data is correct
      expect(deserialized.proof.data).toEqual(sampleProof);
      expect(deserialized.proof.publicSignals).toEqual(samplePublicSignals);
      
      // Check that the metadata is correct
      expect(deserialized.metadata.walletAddress).toBe(sampleOptions.walletAddress);
      expect(deserialized.metadata.amount).toBe(sampleOptions.amount);
    });
    
    it('should throw error for invalid input', () => {
      expect(() => {
        zkProofSerializer.deserializeProof(null);
      }).toThrow('Invalid serialized proof');
      
      expect(() => {
        zkProofSerializer.deserializeProof('');
      }).toThrow('Invalid serialized proof');
      
      expect(() => {
        zkProofSerializer.deserializeProof('not-base64');
      }).toThrow('Failed to deserialize proof');
    });
  });
  
  describe('extractProofForVerification', () => {
    it('should extract proof data correctly', () => {
      const serialized = zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, sampleOptions);
      const extracted = zkProofSerializer.extractProofForVerification(serialized);
      
      // Check that extracted is an object
      expect(typeof extracted).toBe('object');
      
      // Check that it has the expected properties
      expect(extracted).toHaveProperty('proof');
      expect(extracted).toHaveProperty('publicSignals');
      expect(extracted).toHaveProperty('circuitType');
      expect(extracted).toHaveProperty('circuitVersion');
      
      // Check that the data is correct
      expect(extracted.proof).toEqual(sampleProof);
      expect(extracted.publicSignals).toEqual(samplePublicSignals);
      expect(extracted.circuitType).toBe(sampleOptions.type);
      expect(extracted.circuitVersion).toBe(sampleOptions.version);
    });
    
    it('should work with deserialized proof container', () => {
      const serialized = zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, sampleOptions);
      const deserialized = zkProofSerializer.deserializeProof(serialized);
      const extracted = zkProofSerializer.extractProofForVerification(deserialized);
      
      // Check that the data is correct
      expect(extracted.proof).toEqual(sampleProof);
      expect(extracted.publicSignals).toEqual(samplePublicSignals);
    });
    
    it('should throw error for invalid input', () => {
      expect(() => {
        zkProofSerializer.extractProofForVerification(null);
      }).toThrow('Invalid proof container');
      
      expect(() => {
        zkProofSerializer.extractProofForVerification({});
      }).toThrow('Invalid proof container');
      
      expect(() => {
        zkProofSerializer.extractProofForVerification({ proof: {} });
      }).toThrow('Invalid proof container');
    });
  });
  
  describe('isValidProof', () => {
    it('should return true for valid proof', () => {
      const serialized = zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, sampleOptions);
      expect(zkProofSerializer.isValidProof(serialized)).toBe(true);
      
      const deserialized = zkProofSerializer.deserializeProof(serialized);
      expect(zkProofSerializer.isValidProof(deserialized)).toBe(true);
    });
    
    it('should return false for invalid proof', () => {
      expect(zkProofSerializer.isValidProof(null)).toBe(false);
      expect(zkProofSerializer.isValidProof({})).toBe(false);
      expect(zkProofSerializer.isValidProof('invalid-base64')).toBe(false);
      expect(zkProofSerializer.isValidProof({ proof: {} })).toBe(false);
    });
  });
  
  describe('getProofMetadata', () => {
    it('should extract metadata correctly', () => {
      const serialized = zkProofSerializer.serializeProof(sampleProof, samplePublicSignals, sampleOptions);
      const metadata = zkProofSerializer.getProofMetadata(serialized);
      
      // Check that metadata is an object
      expect(typeof metadata).toBe('object');
      
      // Check that it has the expected properties
      expect(metadata).toHaveProperty('createdAt');
      expect(metadata).toHaveProperty('libraryVersion');
      expect(metadata).toHaveProperty('walletAddress');
      expect(metadata).toHaveProperty('amount');
      expect(metadata).toHaveProperty('environment');
      expect(metadata).toHaveProperty('circuitType');
      expect(metadata).toHaveProperty('circuitVersion');
      expect(metadata).toHaveProperty('formatVersion');
      
      // Check that the data is correct
      expect(metadata.walletAddress).toBe(sampleOptions.walletAddress);
      expect(metadata.amount).toBe(sampleOptions.amount);
      expect(metadata.circuitType).toBe(sampleOptions.type);
      expect(metadata.circuitVersion).toBe(sampleOptions.version);
      expect(metadata.formatVersion).toBe(zkProofSerializer.PROOF_FORMAT_VERSION);
    });
    
    it('should throw error for invalid input', () => {
      expect(() => {
        zkProofSerializer.getProofMetadata(null);
      }).toThrow('Invalid proof container');
      
      expect(() => {
        zkProofSerializer.getProofMetadata({});
      }).toThrow('Invalid proof container');
    });
  });
});