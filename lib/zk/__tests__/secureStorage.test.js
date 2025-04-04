/**
 * Tests for secureStorage
 * 
 * Tests the secure storage functionality including storage, retrieval,
 * expiration handling, and cleanup of sensitive data.
 */

import secureStorage from '../secureStorage';
import secureKeyManager from '../SecureKeyManager';

// Mock sessionStorage
const mockSessionStorage = (() => {
  let storage = {};
  return {
    setItem: jest.fn((key, value) => {
      storage[key] = value;
    }),
    getItem: jest.fn(key => storage[key] || null),
    removeItem: jest.fn(key => {
      delete storage[key];
    }),
    clear: jest.fn(() => {
      storage = {};
    }),
    key: jest.fn(index => {
      return Object.keys(storage)[index] || null;
    }),
    get length() {
      return Object.keys(storage).length;
    }
  };
})();

// Mock for Web Crypto API
const mockCrypto = {
  subtle: {
    importKey: jest.fn().mockImplementation(() => Promise.resolve('mock-key-material')),
    deriveKey: jest.fn().mockImplementation(() => Promise.resolve('mock-derived-key')),
    encrypt: jest.fn().mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    decrypt: jest.fn().mockImplementation(() => {
      const encoder = new TextEncoder();
      const mockData = {
        id: 'test-wallet-id',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        privateKey: '0xprivatekey123',
      };
      return Promise.resolve(encoder.encode(JSON.stringify(mockData)));
    })
  },
  getRandomValues: jest.fn().mockImplementation((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

// Setup mocks
beforeAll(() => {
  // Mock window object if not available (Node.js environment)
  if (typeof window === 'undefined') {
    global.window = {
      sessionStorage: mockSessionStorage,
      crypto: mockCrypto,
      addEventListener: jest.fn()
    };
  } else {
    // If in browser, temporarily override sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });
  }
  
  // Mock secure key manager methods
  secureKeyManager.encrypt = jest.fn().mockImplementation(() => {
    return Promise.resolve({
      version: '1.0',
      algorithm: 'AES-GCM',
      ciphertext: [1, 2, 3, 4],
      iv: [5, 6, 7, 8],
      salt: [9, 10, 11, 12],
      metadata: { type: 'test-data' }
    });
  });
  
  secureKeyManager.decrypt = jest.fn().mockImplementation(() => {
    return Promise.resolve({
      id: 'test-data-id',
      value: 'decrypted-value'
    });
  });
  
  secureKeyManager.encryptPrivateKey = jest.fn().mockImplementation(() => {
    return Promise.resolve({
      version: '1.0',
      algorithm: 'AES-GCM',
      ciphertext: [1, 2, 3, 4],
      iv: [5, 6, 7, 8],
      salt: [9, 10, 11, 12],
      metadata: { type: 'encrypted-private-key' }
    });
  });
  
  secureKeyManager.decryptPrivateKey = jest.fn().mockImplementation(() => {
    return Promise.resolve('0xdecrypted-private-key');
  });
  
  // Re-init storage to use mocks
  secureStorage.storage = mockSessionStorage;
  secureStorage.secureKeyManager = secureKeyManager;
});

// Clear mocks between tests
beforeEach(() => {
  mockSessionStorage.clear();
  jest.clearAllMocks();
});

describe('secureStorage', () => {
  describe('wallet storage', () => {
    it('should store wallet data securely', async () => {
      const walletData = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        privateKey: '0xprivatekey123'
      };
      const password = 'testPassword';
      
      const walletId = await secureStorage.storeWallet(walletData, password);
      
      // Verify a wallet ID was returned
      expect(walletId).toBeTruthy();
      
      // Verify secureKeyManager was called to encrypt private key
      expect(secureKeyManager.encryptPrivateKey).toHaveBeenCalledWith(
        walletData.privateKey,
        password
      );
      
      // Verify sessionStorage was called
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      expect(mockSessionStorage.setItem.mock.calls[0][0]).toContain('temp-wallet-');
    });
    
    it('should retrieve stored wallet data', async () => {
      // Setup: Store wallet data
      const walletData = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        privateKey: '0xprivatekey123'
      };
      const password = 'testPassword';
      
      // Store wallet
      const walletId = await secureStorage.storeWallet(walletData, password);
      
      // Mock the stored data retrieval
      mockSessionStorage.getItem.mockImplementationOnce(() => {
        return JSON.stringify({
          id: walletId,
          address: walletData.address,
          encryptedPrivateKey: { metadata: { type: 'encrypted-private-key' } },
          expiresAt: Date.now() + 3600000,
          created: Date.now(),
          type: 'wallet'
        });
      });
      
      // Test: Retrieve wallet
      const retrievedWallet = await secureStorage.getWallet(walletId, password);
      
      // Verify wallet data was retrieved and decrypted
      expect(retrievedWallet).toBeTruthy();
      expect(retrievedWallet.address).toBe(walletData.address);
      expect(retrievedWallet.privateKey).toBe('0xdecrypted-private-key');
      expect(secureKeyManager.decryptPrivateKey).toHaveBeenCalled();
    });
    
    it('should handle wallet expiration', async () => {
      // Mock an expired wallet retrieval
      mockSessionStorage.getItem.mockImplementationOnce(() => {
        return JSON.stringify({
          id: 'expired-wallet',
          address: '0x1234',
          encryptedPrivateKey: {},
          expiresAt: Date.now() - 1000, // Expired
          created: Date.now() - 3600000,
          type: 'wallet'
        });
      });
      
      // Test: Retrieve expired wallet should fail
      await expect(secureStorage.getWallet('expired-wallet', 'password'))
        .rejects.toThrow('Wallet has expired');
      
      // Verify the expired item was removed
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
    });
  });
  
  describe('circuit input storage', () => {
    it('should store and retrieve circuit input data', async () => {
      const inputData = {
        privateAmount: '1000000000000000000',
        publicAmount: '1000000000000000000',
        privateAddress: [1, 2, 3, 4, 5],
        publicAddressHash: '0xhash123'
      };
      const password = 'inputPassword';
      
      // Store input data
      const inputId = await secureStorage.storeCircuitInput(inputData, password);
      
      // Verify a input ID was returned
      expect(inputId).toBeTruthy();
      
      // Verify secureKeyManager was called to encrypt data
      expect(secureKeyManager.encrypt).toHaveBeenCalledWith(inputData, password);
      
      // Mock the stored data retrieval
      mockSessionStorage.getItem.mockImplementationOnce(() => {
        return JSON.stringify({
          id: inputId,
          encryptedData: {},
          expiresAt: Date.now() + 3600000,
          created: Date.now(),
          type: 'circuit-input'
        });
      });
      
      // Retrieve input data
      const retrievedData = await secureStorage.getCircuitInput(inputId, password);
      
      // Verify data was retrieved and decrypted
      expect(retrievedData).toBeTruthy();
      expect(secureKeyManager.decrypt).toHaveBeenCalled();
    });
  });
  
  describe('session data storage', () => {
    it('should store and retrieve session data', async () => {
      const sessionKey = 'test-session';
      const sessionData = { setting1: true, setting2: 'value' };
      const password = 'sessionPassword';
      
      // Store session data
      await secureStorage.storeSessionData(sessionKey, sessionData, password);
      
      // Verify secureKeyManager was called to encrypt data
      expect(secureKeyManager.encrypt).toHaveBeenCalledWith(sessionData, password);
      
      // Mock the stored data retrieval
      mockSessionStorage.getItem.mockImplementationOnce(() => {
        return JSON.stringify({
          key: sessionKey,
          encryptedData: {},
          expiresAt: Date.now() + 3600000,
          created: Date.now(),
          type: 'session-data'
        });
      });
      
      // Retrieve session data
      const retrievedData = await secureStorage.getSessionData(sessionKey, password);
      
      // Verify data was retrieved and decrypted
      expect(retrievedData).toBeTruthy();
      expect(secureKeyManager.decrypt).toHaveBeenCalled();
    });
  });
  
  describe('cleanup and expiration', () => {
    it('should clean up expired items', () => {
      // Setup some expired and non-expired items
      const now = Date.now();
      
      // Mock storage with keys
      Object.defineProperty(mockSessionStorage, 'length', { value: 3 });
      mockSessionStorage.key.mockImplementation((index) => {
        const keys = [
          'temp-wallet-valid',
          'temp-wallet-expired',
          'zk-input-expired'
        ];
        return keys[index];
      });
      
      // Mock retrieving items
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'temp-wallet-valid') {
          return JSON.stringify({
            id: 'valid',
            expiresAt: now + 3600000
          });
        } else {
          return JSON.stringify({
            id: 'expired',
            expiresAt: now - 1000
          });
        }
      });
      
      // Run cleanup
      secureStorage.cleanupExpiredItems();
      
      // Should remove the two expired items
      expect(mockSessionStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('temp-wallet-expired');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('zk-input-expired');
    });
    
    it('should clean up all sensitive data', () => {
      // Mock storage with sensitive keys
      Object.defineProperty(mockSessionStorage, 'length', { value: 4 });
      mockSessionStorage.key.mockImplementation((index) => {
        const keys = [
          'temp-wallet-1',
          'zk-input-1',
          'zk-proof-1',
          'other-data'
        ];
        return keys[index];
      });
      
      // Run full cleanup
      secureStorage.cleanupAllSensitiveData();
      
      // Should remove the three sensitive items but not other-data
      expect(mockSessionStorage.removeItem).toHaveBeenCalledTimes(3);
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('temp-wallet-1');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('zk-input-1');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('zk-proof-1');
      expect(mockSessionStorage.removeItem).not.toHaveBeenCalledWith('other-data');
    });
  });
});