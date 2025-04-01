/**
 * Tests for the proof encryption module
 */

import {
  generateAccessKey,
  encryptProof,
  decryptProof,
  hashAccessKey,
  verifyAccessKey
} from '../proofEncryption';

describe('Proof Encryption Module', () => {
  // Test data
  const sampleProofData = {
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    proofType: 'balance',
    amount: '1000',
    createdAt: '2023-01-01T00:00:00Z',
    expiresAt: '2023-02-01T00:00:00Z',
    proofData: {
      proof: { a: [1, 2], b: [[3, 4], [5, 6]], c: [7, 8] },
      publicSignals: ['0x1234567890abcdef1234567890abcdef12345678']
    }
  };

  describe('generateAccessKey', () => {
    test('generates a key of the specified length', () => {
      const key = generateAccessKey(16);
      expect(key.length).toBe(16);
    });

    test('generates a key with default length if not specified', () => {
      const key = generateAccessKey();
      expect(key.length).toBe(12); // Default length is 12
    });

    test('generates different keys on multiple calls', () => {
      const key1 = generateAccessKey();
      const key2 = generateAccessKey();
      expect(key1).not.toEqual(key2);
    });
  });

  describe('encryptProof and decryptProof', () => {
    test('encrypts and decrypts proof data correctly', () => {
      const accessKey = generateAccessKey();
      const encrypted = encryptProof(sampleProofData, accessKey);

      // Encrypted data should be a string and not match the original
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toEqual(JSON.stringify(sampleProofData));

      // Decrypt the data
      const decrypted = decryptProof(encrypted, accessKey);

      // Decrypted data should match the original
      expect(decrypted).toEqual(sampleProofData);
    });

    test('returns null when decrypting with wrong key', () => {
      const accessKey = generateAccessKey();
      const wrongKey = generateAccessKey();
      const encrypted = encryptProof(sampleProofData, accessKey);

      // Attempt to decrypt with wrong key
      const decrypted = decryptProof(encrypted, wrongKey);

      // Should return null for invalid key
      expect(decrypted).toBeNull();
    });

    test('handles edge cases properly', () => {
      const accessKey = generateAccessKey();

      // Test with empty object
      const emptyData = {};
      const encryptedEmpty = encryptProof(emptyData, accessKey);
      const decryptedEmpty = decryptProof(encryptedEmpty, accessKey);
      expect(decryptedEmpty).toEqual(emptyData);

      // Test with null input
      expect(encryptProof(null, accessKey)).toBeNull();
      expect(decryptProof(null, accessKey)).toBeNull();

      // Test with missing access key
      expect(encryptProof(sampleProofData, null)).toBeNull();
      expect(decryptProof('encrypted data', null)).toBeNull();
    });
  });

  describe('hashAccessKey and verifyAccessKey', () => {
    test('hashes access key consistently', () => {
      const accessKey = 'testKey123';
      const hash1 = hashAccessKey(accessKey);
      const hash2 = hashAccessKey(accessKey);

      // Same key should produce same hash
      expect(hash1).toEqual(hash2);

      // Hash should be a string and not match the original
      expect(typeof hash1).toBe('string');
      expect(hash1).not.toEqual(accessKey);
    });

    test('verifies access key against hash correctly', () => {
      const accessKey = 'testKey123';
      const hashedKey = hashAccessKey(accessKey);

      // Should verify correctly
      expect(verifyAccessKey(accessKey, hashedKey)).toBe(true);

      // Should fail with wrong key
      expect(verifyAccessKey('wrongKey', hashedKey)).toBe(false);
    });
  });
});