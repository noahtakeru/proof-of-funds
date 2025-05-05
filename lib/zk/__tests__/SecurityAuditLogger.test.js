/**
 * Tests for Security Audit Logger
 * 
 * Tests the audit logging, tamper-evidence, and anomaly detection features.
 */

import SecurityAuditLogger from '../SecurityAuditLogger';

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
    })
  };
})();

// Mock crypto.subtle
const mockSubtle = {
  digest: jest.fn().mockImplementation(() => {
    // Mock returning a hash
    const buffer = new Uint8Array(32);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = i;
    }
    return Promise.resolve(buffer.buffer);
  }),
  importKey: jest.fn().mockResolvedValue('mock-crypto-key'),
  sign: jest.fn().mockImplementation(() => {
    // Mock returning a signature
    const buffer = new Uint8Array(32);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = i;
    }
    return Promise.resolve(buffer.buffer);
  })
};

// Mock window
global.window = {
  sessionStorage: mockSessionStorage
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

describe('SecurityAuditLogger', () => {
  let logger;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.clear();
    
    // Fresh logger for each test
    logger = new SecurityAuditLogger({
      persistToStorage: false, // Disable persistence for most tests
      logRotationThreshold: 10 // Lower threshold for testing
    });
  });
  
  describe('logging functionality', () => {
    it('should initialize with default config', () => {
      expect(logger.config).toBeDefined();
      expect(logger.logs).toBeInstanceOf(Array);
      expect(logger.logs.length).toBe(1); // Initial log entry
      expect(logger.signingKey).toBeDefined();
      expect(logger.lastLogHash).toBeDefined();
    });
    
    it('should log informational messages', async () => {
      await logger.log('Test info message', { testData: 123 });
      
      // Should have 2 logs (init + new log)
      expect(logger.logs.length).toBe(2);
      
      const lastLog = logger.logs[1];
      expect(lastLog.message).toBe('Test info message');
      expect(lastLog.level).toBe('info');
      expect(lastLog.data).toHaveProperty('testData', 123);
      expect(lastLog.timestamp).toBeDefined();
      expect(lastLog.hash).toBeDefined();
    });
    
    it('should log errors', async () => {
      await logger.logError('Test error message', { error: 'Something went wrong' });
      
      const lastLog = logger.logs[1];
      expect(lastLog.message).toBe('Test error message');
      expect(lastLog.level).toBe('error');
      expect(lastLog.data).toHaveProperty('error', 'Something went wrong');
    });
    
    it('should log security events', async () => {
      await logger.logSecurity('Security breach detected', { 
        severity: 'high',
        location: 'sessionStorage'
      });
      
      const lastLog = logger.logs[1];
      expect(lastLog.message).toBe('Security breach detected');
      expect(lastLog.level).toBe('security');
      expect(lastLog.data).toHaveProperty('severity', 'high');
      expect(lastLog.data).toHaveProperty('location', 'sessionStorage');
    });
    
    it('should include chain hashes for tamper evidence', async () => {
      await logger.log('First message');
      await logger.log('Second message');
      
      // Each log should reference the hash of the previous log
      const firstLog = logger.logs[1]; // After init log
      const secondLog = logger.logs[2];
      
      // We can't directly check hash content since it's implementation-dependent
      // But we can verify the chain structure
      expect(firstLog.hash).toBeDefined();
      expect(secondLog.hash).toBeDefined();
      expect(logger.lastLogHash).toBe(secondLog.hash);
    });
  });
  
  describe('persistence and loading', () => {
    it('should persist logs to sessionStorage', async () => {
      // Create logger with persistence enabled
      const persistentLogger = new SecurityAuditLogger({
        persistToStorage: true,
        logRotationThreshold: 1 // Ensure immediate persistence
      });
      
      // Add enough logs to trigger persistence
      await persistentLogger.log('Test message 1');
      
      // Should have called sessionStorage.setItem
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        persistentLogger.config.storageKey,
        expect.any(String)
      );
    });
    
    it('should load logs from sessionStorage', () => {
      // Set up mock logs in storage
      const mockLogs = [
        {
          message: 'Logger initialized',
          level: 'info',
          timestamp: new Date().toISOString(),
          data: { config: {} },
          sequenceId: 0,
          hash: 'hash1'
        },
        {
          message: 'Test message',
          level: 'info',
          timestamp: new Date().toISOString(),
          data: {},
          sequenceId: 1,
          hash: 'hash2'
        }
      ];
      
      mockSessionStorage.getItem.mockReturnValueOnce(JSON.stringify(mockLogs));
      
      // Create logger which will load from storage
      const loadingLogger = new SecurityAuditLogger({
        persistToStorage: true
      });
      
      // Should have called sessionStorage.getItem
      expect(mockSessionStorage.getItem).toHaveBeenCalled();
      
      // Should have loaded logs
      expect(loadingLogger.logs.length).toBe(2);
      expect(loadingLogger.logs[1].message).toBe('Test message');
    });
  });
  
  describe('tamper evidence', () => {
    it('should detect tampered logs', async () => {
      // Add some logs
      await logger.log('Message 1');
      await logger.log('Message 2');
      await logger.log('Message 3');
      
      // The logs should have an intact chain
      const verified = await logger.verifyLogIntegrity();
      expect(verified).toBe(true);
      
      // Now tamper with a log
      logger.logs[1].message = 'Tampered message';
      
      // Verification should fail
      const verifiedAfterTamper = await logger.verifyLogIntegrity();
      expect(verifiedAfterTamper).toBe(false);
    });
    
    it('should export logs with integrity information', async () => {
      // Add some logs
      await logger.log('Message 1');
      await logger.log('Message 2');
      
      // Export logs
      const exported = logger.exportLogs();
      
      expect(exported).toHaveProperty('logs');
      expect(exported).toHaveProperty('metadata');
      expect(exported.metadata).toHaveProperty('integrity');
      expect(exported.logs.length).toBe(3); // Init + 2 messages
    });
    
    it('should clear logs and keep clearing entry', async () => {
      // Add some logs
      await logger.log('Message 1');
      await logger.log('Message 2');
      
      // Clear logs (now async)
      const cleared = await logger.clearLogs({ reason: 'test' });
      
      expect(cleared).toBe(true);
      expect(logger.logs.length).toBe(1); // Just the clearing entry
      expect(logger.logs[0].message).toBe('Logs cleared');
      expect(logger.logs[0].level).toBe('security');
      expect(logger.logs[0].data).toHaveProperty('reason', 'test');
    });
  });
  
  describe('anomaly detection', () => {
    it('should detect frequency anomalies', async () => {
      // Mock the logSecurity method to check if it's called
      logger.logSecurity = jest.fn();
      
      // Initialize anomaly detection data
      logger.anomalyDetectionData.eventTimings['login'] = {
        lastSeen: Date.now() - 5000, // 5 seconds ago
        intervals: [5000, 5000, 5000, 5000, 5000] // Consistently every 5 seconds
      };
      
      // Trigger the detection
      logger.detectFrequencyAnomalies('login');
      
      // No anomaly yet
      expect(logger.logSecurity).not.toHaveBeenCalled();
      
      // Now add an anomalous interval (much faster)
      logger.anomalyDetectionData.eventTimings['login'].intervals.push(100); // 0.1 second
      
      // Trigger the detection again
      logger.detectFrequencyAnomalies('login');
      
      // Should detect the anomaly
      expect(logger.logSecurity).toHaveBeenCalledWith(
        'Anomalous event frequency detected',
        expect.objectContaining({
          eventType: 'login',
          anomalyType: 'frequency'
        })
      );
    });
    
    it('should detect sequence anomalies', async () => {
      // Mock the logSecurity method to check if it's called
      logger.logSecurity = jest.fn();
      
      // Setup recent events with security issues
      const now = Date.now();
      logger.anomalyDetectionData.lastEvents = [
        { message: 'login', level: 'info', timestamp: now - 5000 },
        { message: 'login failed', level: 'error', timestamp: now - 4000 },
        { message: 'login failed', level: 'error', timestamp: now - 3000 },
        { message: 'password reset requested', level: 'security', timestamp: now - 2000 },
        { message: 'login failed', level: 'error', timestamp: now - 1000 }
      ];
      
      // Trigger the detection
      logger.detectSequenceAnomalies();
      
      // Should detect the anomaly
      expect(logger.logSecurity).toHaveBeenCalledWith(
        'Anomalous event sequence detected',
        expect.objectContaining({
          anomalyType: 'sequence',
          securityEventCount: expect.any(Number)
        })
      );
    });
  });
});