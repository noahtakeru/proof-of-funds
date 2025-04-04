/**
 * Tests for Session Security Manager
 * 
 * Tests the session management, key rotation, and security features.
 */

import sessionSecurityManager from '../SessionSecurityManager';
import secureKeyManager from '../SecureKeyManager';
import secureStorage from '../secureStorage';

// Mock dependencies
jest.mock('../SecureKeyManager', () => ({
  __esModule: true,
  default: {
    generateSecurePassword: jest.fn().mockReturnValue('generated-password'),
    secureWipe: jest.fn()
  }
}));

jest.mock('../secureStorage', () => ({
  __esModule: true,
  default: {
    storeWallet: jest.fn().mockResolvedValue('stored-wallet-id'),
    getWallet: jest.fn().mockResolvedValue({
      address: '0x123',
      privateKey: '0xprivatekey'
    }),
    storeCircuitInput: jest.fn().mockResolvedValue('stored-input-id'),
    getCircuitInput: jest.fn().mockResolvedValue({
      data: 'test-input-data'
    }),
    removeItem: jest.fn()
  }
}));

jest.mock('../SecurityAuditLogger', () => {
  return jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    logError: jest.fn(),
    logWarning: jest.fn(),
    logSecurity: jest.fn()
  }));
});

jest.mock('../TamperDetection', () => {
  return jest.fn().mockImplementation(() => ({
    protect: jest.fn().mockImplementation(async (data) => ({
      ...data,
      integrity: 'protected'
    })),
    verify: jest.fn().mockReturnValue(true),
    detectStorageTampering: jest.fn().mockResolvedValue({
      checked: 0, tampered: 0, items: []
    })
  }));
});

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

// Mock window
global.window = {
  sessionStorage: mockSessionStorage,
  addEventListener: jest.fn(),
  crypto: {
    getRandomValues: jest.fn(arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = i % 256;
      }
      return arr;
    })
  }
};

// Mock document
global.document = {
  addEventListener: jest.fn(),
  visibilityState: 'visible'
};

// Mock crypto
global.crypto = global.window.crypto;

describe('SessionSecurityManager', () => {
  let originalDateNow;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.clear();
    
    // Mock Date.now() to return a fixed timestamp
    originalDateNow = Date.now;
    Date.now = jest.fn().mockReturnValue(1600000000000);
    
    // Reset session state
    sessionSecurityManager.sessionId = null;
    sessionSecurityManager.sessionStart = null;
    sessionSecurityManager.sessionExpiry = null;
    sessionSecurityManager.lastActivity = null;
    sessionSecurityManager.sessionPassword = null;
    sessionSecurityManager.sessionExtensionCount = 0;
    sessionSecurityManager.sessionKeys = new Map();
  });
  
  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
  });
  
  describe('session management', () => {
    it('should initialize a new session', async () => {
      const session = await sessionSecurityManager.initializeSession();
      
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('expires');
      expect(session).toHaveProperty('created');
      
      expect(sessionSecurityManager.sessionId).toBe(session.sessionId);
      expect(sessionSecurityManager.sessionPassword).toBe('generated-password');
      expect(sessionSecurityManager.sessionStart).toBe(1600000000000);
      
      // Should have called secureKeyManager.generateSecurePassword
      expect(secureKeyManager.generateSecurePassword).toHaveBeenCalled();
    });
    
    it('should extend a session', async () => {
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Set a fake session expiry
      sessionSecurityManager.sessionExpiry = Date.now() + 1000000;
      
      // Extend the session
      const extended = sessionSecurityManager.extendSession();
      
      expect(extended).toBe(true);
      expect(sessionSecurityManager.sessionExtensionCount).toBe(1);
      expect(sessionSecurityManager.sessionExpiry).toBe(Date.now() + sessionSecurityManager.settings.sessionDuration);
    });
    
    it('should terminate a session', async () => {
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Register a fake key
      sessionSecurityManager.sessionKeys.set('test-key', {
        dataId: 'test-data',
        password: 'test-password',
        type: 'wallet'
      });
      
      // Terminate the session
      const terminated = sessionSecurityManager.terminateSession('test');
      
      expect(terminated).toBe(true);
      expect(sessionSecurityManager.sessionId).toBeNull();
      expect(sessionSecurityManager.sessionPassword).toBeNull();
      
      // Should have cleared the keys
      expect(sessionSecurityManager.sessionKeys.size).toBe(0);
      
      // Should have called secureKeyManager.secureWipe
      expect(secureKeyManager.secureWipe).toHaveBeenCalled();
    });
    
    it('should check if a session is active', async () => {
      // Initially no active session
      expect(sessionSecurityManager.isSessionActive()).toBe(false);
      
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Should be active
      expect(sessionSecurityManager.isSessionActive()).toBe(true);
      
      // Set expired session
      sessionSecurityManager.sessionExpiry = Date.now() - 1000;
      
      // Should be inactive
      expect(sessionSecurityManager.isSessionActive()).toBe(false);
    });
    
    it('should get session info', async () => {
      // Initially no session
      expect(sessionSecurityManager.getSessionInfo()).toEqual({ active: false });
      
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Should have session info
      const info = sessionSecurityManager.getSessionInfo();
      expect(info.active).toBe(true);
      expect(info.sessionId).toBe(sessionSecurityManager.sessionId);
      expect(info.created).toBe(sessionSecurityManager.sessionStart);
      expect(info.expires).toBe(sessionSecurityManager.sessionExpiry);
    });
  });
  
  describe('key management', () => {
    it('should register a key', async () => {
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Register a key
      const keyId = sessionSecurityManager.registerKey('data-id', 'password', 'wallet');
      
      expect(keyId).toBeDefined();
      expect(sessionSecurityManager.sessionKeys.has(keyId)).toBe(true);
      
      const key = sessionSecurityManager.sessionKeys.get(keyId);
      expect(key.dataId).toBe('data-id');
      expect(key.password).toBe('password');
      expect(key.type).toBe('wallet');
    });
    
    it('should get a key', async () => {
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Register a key
      const keyId = sessionSecurityManager.registerKey('data-id', 'password', 'wallet');
      
      // Get the key
      const key = sessionSecurityManager.getKey(keyId);
      
      expect(key.dataId).toBe('data-id');
      expect(key.password).toBe('password');
      expect(key.type).toBe('wallet');
    });
    
    it('should unregister a key', async () => {
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Register a key
      const keyId = sessionSecurityManager.registerKey('data-id', 'password', 'wallet');
      
      // Unregister the key
      const unregistered = sessionSecurityManager.unregisterKey(keyId, true);
      
      expect(unregistered).toBe(true);
      expect(sessionSecurityManager.sessionKeys.has(keyId)).toBe(false);
      
      // Should have called removeItem
      expect(secureStorage.removeItem).toHaveBeenCalled();
    });
    
    it('should store and retrieve data securely', async () => {
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Store data
      const result = await sessionSecurityManager.storeData({ test: 'data' }, {
        type: 'input'
      });
      
      expect(result).toHaveProperty('keyId');
      expect(result).toHaveProperty('dataId');
      
      // Should have called storeCircuitInput
      expect(secureStorage.storeCircuitInput).toHaveBeenCalled();
      
      // Retrieve the data
      const retrieved = await sessionSecurityManager.retrieveData(result.keyId);
      
      expect(retrieved).toHaveProperty('data');
      
      // Should have called getCircuitInput
      expect(secureStorage.getCircuitInput).toHaveBeenCalled();
    });
  });
  
  describe('security features', () => {
    it('should handle window unload events', () => {
      // Initialize session with forceDestructOnTabClose enabled
      sessionSecurityManager.settings.forceDestructOnTabClose = true;
      sessionSecurityManager.sessionId = 'test-session';
      
      // Simulate window unload
      const event = {};
      sessionSecurityManager.handleWindowUnload(event);
      
      // Session should be terminated
      expect(sessionSecurityManager.sessionId).toBeNull();
    });
    
    it('should update last activity', async () => {
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Reset lastActivity to a known value
      sessionSecurityManager.lastActivity = 1600000000000 - 1000;
      
      // Update activity
      sessionSecurityManager.updateLastActivity();
      
      // lastActivity should be updated
      expect(sessionSecurityManager.lastActivity).toBe(1600000000000);
    });
    
    it('should detect tampering in session data', async () => {
      // Mock tamper detection to return false
      sessionSecurityManager.tamperDetection.verify = jest.fn().mockResolvedValue(false);
      
      // Initialize session
      await sessionSecurityManager.initializeSession();
      
      // Check for tampering
      await sessionSecurityManager.checkForTampering();
      
      // Session should be terminated due to tampering
      expect(sessionSecurityManager.sessionId).toBeNull();
      
      // Should have logged a security event
      expect(sessionSecurityManager.auditLogger.logSecurity).toHaveBeenCalledWith(
        'Session data tampering detected',
        expect.objectContaining({
          action: 'tampering_detected',
          severity: 'high'
        })
      );
    });
  });
});