/**
 * Tests for SecureKeyManager
 * 
 * Tests the secure key management functionality including encryption,
 * decryption, and secure password generation.
 */

import secureKeyManager from '../SecureKeyManager';

// Mock for Web Crypto API if running in Node.js environment
if (typeof window === 'undefined') {
  global.crypto = {
    subtle: {
      importKey: jest.fn().mockImplementation(() => Promise.resolve('mock-key-material')),
      deriveKey: jest.fn().mockImplementation(() => Promise.resolve('mock-derived-key')),
      encrypt: jest.fn().mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
      decrypt: jest.fn().mockImplementation(() => {
        const encoder = new TextEncoder();
        return Promise.resolve(encoder.encode('{"test":"decrypted"}'));
      })
    },
    getRandomValues: jest.fn().mockImplementation((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  };
  
  // Mock TextEncoder/TextDecoder
  global.TextEncoder = class TextEncoder {
    encode(text) {
      return new Uint8Array(text.split('').map(c => c.charCodeAt(0)));
    }
  };
  
  global.TextDecoder = class TextDecoder {
    decode(buffer) {
      return String.fromCharCode.apply(null, new Uint8Array(buffer));
    }
  };
}

describe('SecureKeyManager', () => {
  describe('encryption and decryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      // Skip test in Node environment where Web Crypto API is mocked
      if (typeof window === 'undefined') {
        console.log('Skipping actual crypto test in Node environment');
        return;
      }
      
      const testData = { secretValue: 'test123', otherValue: 42 };
      const password = 'testPassword123';
      
      // Encrypt the data
      const encryptedData = await secureKeyManager.encrypt(testData, password);
      
      // Verify encryption structure
      expect(encryptedData).toHaveProperty('version');
      expect(encryptedData).toHaveProperty('algorithm');
      expect(encryptedData).toHaveProperty('ciphertext');
      expect(encryptedData).toHaveProperty('iv');
      expect(encryptedData).toHaveProperty('salt');
      
      // Decrypt the data
      const decryptedData = await secureKeyManager.decrypt(encryptedData, password);
      
      // Verify the decrypted data matches original
      expect(decryptedData).toEqual(testData);
    });
    
    it('should fail decryption with incorrect password', async () => {
      // Skip test in Node environment where Web Crypto API is mocked
      if (typeof window === 'undefined') {
        console.log('Skipping actual crypto test in Node environment');
        return;
      }
      
      const testData = 'sensitive information';
      const password = 'correctPassword';
      const wrongPassword = 'wrongPassword';
      
      // Encrypt with correct password
      const encryptedData = await secureKeyManager.encrypt(testData, password);
      
      // Attempt to decrypt with wrong password
      await expect(secureKeyManager.decrypt(encryptedData, wrongPassword))
        .rejects.toThrow();
    });
  });
  
  describe('private key encryption', () => {
    it('should encrypt and decrypt private keys with special handling', async () => {
      // Skip test in Node environment where Web Crypto API is mocked
      if (typeof window === 'undefined') {
        console.log('Skipping actual crypto test in Node environment');
        return;
      }
      
      const privateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const password = 'securePassword456';
      
      // Encrypt private key
      const encryptedKey = await secureKeyManager.encryptPrivateKey(privateKey, password);
      
      // Verify encryption has special metadata
      expect(encryptedKey.metadata).toHaveProperty('type', 'encrypted-private-key');
      
      // Decrypt private key
      const decryptedKey = await secureKeyManager.decryptPrivateKey(encryptedKey, password);
      
      // Verify decrypted key matches original
      expect(decryptedKey).toEqual(privateKey);
    });
  });
  
  describe('secure password generation', () => {
    it('should generate secure random passwords of specified length', () => {
      const length = 32;
      const password = secureKeyManager.generateSecurePassword(length);
      
      // Verify password length and character set
      expect(password.length).toBe(length);
      
      // Verify password has mixed character types
      expect(password).toMatch(/[A-Z]/); // Uppercase
      expect(password).toMatch(/[a-z]/); // Lowercase
      expect(password).toMatch(/[0-9]/); // Numbers
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/); // Special chars
    });
    
    it('should generate different passwords on each call', () => {
      const password1 = secureKeyManager.generateSecurePassword();
      const password2 = secureKeyManager.generateSecurePassword();
      
      // Verify passwords are different
      expect(password1).not.toEqual(password2);
    });
  });
  
  describe('secure wiping', () => {
    it('should securely wipe arrays', () => {
      const sensitiveArray = [1, 2, 3, 4, 5];
      
      secureKeyManager.secureWipe(sensitiveArray);
      
      // Verify array is emptied
      expect(sensitiveArray.length).toBe(0);
    });
    
    it('should securely wipe typed arrays', () => {
      const sensitiveData = new Uint8Array([1, 2, 3, 4, 5]);
      
      secureKeyManager.secureWipe(sensitiveData);
      
      // Verify all bytes are zeroed
      for (let i = 0; i < sensitiveData.length; i++) {
        expect(sensitiveData[i]).toBe(0);
      }
    });
    
    it('should securely wipe objects', () => {
      const sensitiveObject = {
        key1: 'sensitive',
        key2: 42,
        nested: {
          secretValue: 'secret'
        }
      };
      
      secureKeyManager.secureWipe(sensitiveObject);
      
      // Verify object properties are nullified
      expect(sensitiveObject.key1).toBeNull();
      expect(sensitiveObject.key2).toBeNull();
      expect(sensitiveObject.nested).toBeNull();
    });
  });
});