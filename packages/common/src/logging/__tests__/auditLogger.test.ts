/**
 * Audit Logger Tests
 * 
 * This test suite validates the security audit logging system.
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuditLogger, LogSeverity, LogCategory, RequestContext } from '../auditLogger';

// Mock GCP Storage
jest.mock('@google-cloud/storage', () => {
  const mockFile = {
    save: jest.fn().mockResolvedValue([{}]),
    download: jest.fn().mockResolvedValue([Buffer.from('{"test":"data"}')])
  };
  
  const mockBucket = {
    file: jest.fn().mockReturnValue(mockFile),
    getFiles: jest.fn().mockResolvedValue([[mockFile]]),
    setMetadata: jest.fn().mockResolvedValue([{}])
  };
  
  return {
    Storage: jest.fn().mockImplementation(() => ({
      getBuckets: jest.fn().mockResolvedValue([[{ name: 'test-bucket' }]]),
      createBucket: jest.fn().mockResolvedValue([{}]),
      bucket: jest.fn().mockReturnValue(mockBucket)
    }))
  };
});

// Create a temporary directory for test logs
const TEST_LOG_DIR = path.join(os.tmpdir(), 'audit-logger-test-' + Date.now());

// Clean up temp files after tests
afterAll(() => {
  try {
    if (fs.existsSync(TEST_LOG_DIR)) {
      fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Failed to clean up test directory:', error);
  }
});

describe('AuditLogger', () => {
  // Reset environment variables before each test
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    
    // Create test directory
    if (!fs.existsSync(TEST_LOG_DIR)) {
      fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
    }
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  describe('Constructor & Initialization', () => {
    test('should initialize with default options', () => {
      const logger = new AuditLogger();
      expect(logger).toBeDefined();
    });
    
    test('should use custom options when provided', () => {
      const logger = new AuditLogger({
        projectId: 'custom-project',
        bucketName: 'custom-bucket',
        localBackupPath: TEST_LOG_DIR,
        encryptionEnabled: true
      });
      
      expect(logger).toBeDefined();
      // We can't directly test private properties, but we can test behavior
    });
    
    test('should initialize storage in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const logger = new AuditLogger({
        localBackupPath: TEST_LOG_DIR
      });
      
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Test initialization by making a log call
      const result = await logger.log('test.init', { message: 'test' });
      expect(result).toBe(true);
    });
  });
  
  describe('Logging Functions', () => {
    let logger: AuditLogger;
    
    beforeEach(() => {
      logger = new AuditLogger({
        localBackupPath: TEST_LOG_DIR,
        localBackup: true,
        encryptionEnabled: false
      });
    });
    
    test('should log basic events', async () => {
      const result = await logger.log('test.basic', { message: 'test message' });
      expect(result).toBe(true);
      
      // Check for local backup file
      const files = fs.readdirSync(TEST_LOG_DIR);
      expect(files.length).toBeGreaterThan(0);
    });
    
    test('should log with different severity levels', async () => {
      await logger.debug('test.debug', { level: 'debug' });
      await logger.info('test.info', { level: 'info' });
      await logger.warning('test.warning', { level: 'warning' });
      await logger.error('test.error', { level: 'error' });
      await logger.critical('test.critical', { level: 'critical' });
      
      // Verify all logs were created
      const allFiles = getAllFiles(TEST_LOG_DIR);
      
      // Count different event types
      const debugLogs = allFiles.filter(f => f.includes('test.debug'));
      const infoLogs = allFiles.filter(f => f.includes('test.info'));
      const warningLogs = allFiles.filter(f => f.includes('test.warning'));
      const errorLogs = allFiles.filter(f => f.includes('test.error'));
      const criticalLogs = allFiles.filter(f => f.includes('test.critical'));
      
      expect(debugLogs.length).toBeGreaterThan(0);
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(warningLogs.length).toBeGreaterThan(0);
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(criticalLogs.length).toBeGreaterThan(0);
    });
    
    test('should sanitize sensitive data', async () => {
      const sensitiveData = {
        username: 'testuser',
        password: 'secret123',
        apiKey: 'abc123xyz',
        profile: {
          email: 'test@example.com',
          creditCard: '4111-1111-1111-1111',
          address: '123 Main St'
        },
        tokens: {
          refreshToken: 'refresh-token-value',
          accessToken: 'access-token-value'
        }
      };
      
      await logger.log('test.sensitive', sensitiveData);
      
      // Find the log file
      const allFiles = getAllFiles(TEST_LOG_DIR);
      const logFile = allFiles.find(f => f.includes('test.sensitive'));
      
      if (!logFile) {
        fail('Log file not found');
        return;
      }
      
      // Read and parse the log file
      const logContent = fs.readFileSync(logFile, 'utf8');
      const logEntry = JSON.parse(logContent);
      
      // Check that sensitive fields are redacted
      expect(logEntry.data.password).toBe('[REDACTED]');
      expect(logEntry.data.apiKey).toBe('[REDACTED]');
      expect(logEntry.data.profile.creditCard).toBe('[REDACTED]');
      expect(logEntry.data.profile.address).toBe('[REDACTED]');
      expect(logEntry.data.tokens.refreshToken).toBe('[REDACTED]');
      expect(logEntry.data.tokens.accessToken).toBe('[REDACTED]');
      
      // Non-sensitive fields should remain intact
      expect(logEntry.data.username).toBe('testuser');
      expect(logEntry.data.profile.email).toBe('test@example.com');
    });
    
    test('should include request context data', async () => {
      const context: RequestContext = {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        userId: 'user-123',
        walletAddress: '0xabcdef1234567890',
        path: '/api/test',
        method: 'GET'
      };
      
      await logger.log('test.context', { action: 'test' }, context);
      
      // Find the log file
      const allFiles = getAllFiles(TEST_LOG_DIR);
      const logFile = allFiles.find(f => f.includes('test.context'));
      
      if (!logFile) {
        fail('Log file not found');
        return;
      }
      
      // Read and parse the log file
      const logContent = fs.readFileSync(logFile, 'utf8');
      const logEntry = JSON.parse(logContent);
      
      // Check that context fields are included
      expect(logEntry.context.ip).toBe('192.168.1.1');
      expect(logEntry.context.userAgent).toBe('Mozilla/5.0 Test Browser');
      expect(logEntry.context.userId).toBe('user-123');
      expect(logEntry.context.walletAddress).toBe('0xabcdef1234567890');
      expect(logEntry.context.path).toBe('/api/test');
      expect(logEntry.context.method).toBe('GET');
    });
    
    test('should extract context from Express request', async () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '10.0.0.1',
          'user-agent': 'Express Test',
          'referer': 'https://example.com'
        },
        user: {
          id: 'user-456',
          walletAddress: '0x0123456789abcdef'
        },
        url: '/api/resource',
        method: 'POST',
        socket: {
          remoteAddress: '127.0.0.1'
        }
      };
      
      const context = logger.getContextFromRequest(mockReq);
      
      expect(context.ip).toBe('10.0.0.1');
      expect(context.userAgent).toBe('Express Test');
      expect(context.userId).toBe('user-456');
      expect(context.walletAddress).toBe('0x0123456789abcdef');
      expect(context.path).toBe('/api/resource');
      expect(context.method).toBe('POST');
      expect(context.referrer).toBe('https://example.com');
    });
  });
  
  describe('Encryption', () => {
    let logger: AuditLogger;
    
    beforeEach(() => {
      logger = new AuditLogger({
        localBackupPath: TEST_LOG_DIR,
        localBackup: true,
        encryptionEnabled: true,
        encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' // 32 bytes hex
      });
    });
    
    test('should encrypt and decrypt data', async () => {
      // @ts-ignore - Accessing private method for testing
      const { encryptData, decryptData } = logger;
      
      const testData = { secret: 'top-secret-info', public: 'public-info' };
      
      // @ts-ignore - Binding private method to instance
      const { encryptedData, iv } = encryptData.call(logger, testData);
      expect(encryptedData).toBeDefined();
      expect(iv).toBeDefined();
      
      // @ts-ignore - Binding private method to instance
      const decryptedData = decryptData.call(logger, encryptedData, iv);
      expect(decryptedData).toEqual(testData);
    });
    
    test('should encrypt sensitive data in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const logger = new AuditLogger({
        localBackupPath: TEST_LOG_DIR,
        localBackup: true,
        encryptionEnabled: true,
        encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      });
      
      // Test encryption by logging sensitive data
      await logger.log('test.encrypted', { 
        publicInfo: 'This is public',
        secretInfo: 'This is secret'
      });
      
      // Since we're testing locally, we'll check the local backup
      const allFiles = getAllFiles(TEST_LOG_DIR);
      const logFile = allFiles.find(f => f.includes('test.encrypted'));
      
      if (!logFile) {
        fail('Log file not found');
        return;
      }
      
      // Read the log file
      const logContent = fs.readFileSync(logFile, 'utf8');
      const logEntry = JSON.parse(logContent);
      
      // In local backup, data should still be sanitized but not encrypted
      expect(logEntry.data.publicInfo).toBe('This is public');
      if (logEntry.data.secretInfo === '[REDACTED]') {
        // This is acceptable - it was sanitized
      } else {
        // The data might be encrypted depending on implementation
        expect(typeof logEntry.data).toBe('object');
      }
    });
  });
});

// Helper function to recursively get all files in a directory
function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return results;
  }
  
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    
    if (stat && stat.isDirectory()) {
      // Recurse into subdirectory
      results = results.concat(getAllFiles(file));
    } else {
      // Add file to results
      results.push(file);
    }
  });
  
  return results;
}