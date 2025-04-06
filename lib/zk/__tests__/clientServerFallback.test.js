/**
 * Integration tests for the client-server fallback system
 * 
 * These tests verify that the entire system works together correctly,
 * handling client-server switching, progress reporting, rate limiting,
 * and error handling.
 */

import { jest } from '@jest/globals';
import { ZKProxyClient } from '../zkProxyClient.js';
import { detectFeatures } from '../browserCompatibility.js';
import { snarkjsLoader } from '../snarkjsLoader.ts';
import { telemetry } from '../telemetry.ts';

// Import constants
const EXECUTION_MODES = {
  CLIENT_SIDE: 'client',
  SERVER_SIDE: 'server',
  HYBRID: 'hybrid',
  AUTO: 'auto'
};

// Create instance
let zkProxyClient;

// Mock modules
jest.mock('../browserCompatibility.js', () => ({
  detectFeatures: jest.fn(),
  __esModule: true,
}));

jest.mock('../snarkjsLoader.ts', () => ({
  isInitialized: jest.fn(),
  initialize: jest.fn(),
  getSnarkjs: jest.fn(),
  __esModule: true,
}));

jest.mock('../telemetry.ts', () => ({
  recordOperation: jest.fn(),
  recordError: jest.fn(),
  __esModule: true,
  telemetry: {
    recordOperation: jest.fn(),
    recordError: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Helper function for quick capability mocking
function mockCapabilities(level, features = {}) {
  // Levels: 'high', 'medium', 'low', 'incompatible'
  const baseFeatures = {
    webAssembly: level !== 'incompatible',
    webCrypto: level !== 'incompatible',
    webWorkers: level === 'high',
    sharedArrayBuffer: level === 'high',
    bigInt: level !== 'low' && level !== 'incompatible',
    indexedDB: level !== 'low' && level !== 'incompatible',
  };
  
  const performanceScores = {
    high: { memory: 80, cpu: 85, webAssembly: 90, overall: 85 },
    medium: { memory: 50, cpu: 55, webAssembly: 60, overall: 55 },
    low: { memory: 30, cpu: 25, webAssembly: 20, overall: 25 },
    incompatible: { memory: 10, cpu: 10, webAssembly: 0, overall: 10 }
  };
  
  const recommendedPaths = {
    high: 'clientSide',
    medium: 'hybrid',
    low: 'serverSide',
    incompatible: 'serverSide'
  };
  
  return {
    features: { ...baseFeatures, ...features },
    browser: {
      name: 'chrome',
      version: '100.0',
      isMobile: false,
      isSupported: level !== 'incompatible'
    },
    performance: performanceScores[level],
    compatibility: {
      level: level === 'incompatible' ? 'incompatible' : level,
      recommendedPath: recommendedPaths[level],
      issues: level === 'incompatible' ? ['Browser incompatible with WebAssembly'] : []
    }
  };
}

// Helper to mock API responses
function mockApiResponse(endpoint, status, data) {
  global.fetch.mockImplementationOnce((url) => {
    if (url.includes(endpoint)) {
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data)
      });
    }
    
    // Pass through other requests
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ available: true })
    });
  });
}

describe('Client-Server Fallback System (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create new instance for each test
    zkProxyClient = new ZKProxyClient();
    
    // Default mock responses
    global.fetch.mockImplementation((url) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ 
            available: true,
            version: '0.7.5',
            features: ['groth16.fullProve', 'groth16.verify']
          })
        });
      } else if (url.includes('/fullProve')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            proof: { pi_a: ['1', '2', '3'], pi_b: [['4', '5'], ['6', '7']], pi_c: ['8', '9', '10'] },
            publicSignals: ['11', '12', '13'],
            executionTimeMs: 500,
            operationId: 'test-op-id'
          })
        });
      } else if (url.includes('/verify')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            verified: true,
            executionTimeMs: 100,
            operationId: 'test-verify-id'
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      });
    });
    
    // Default client-side capabilities (high)
    detectFeatures.mockReturnValue(mockCapabilities('high'));
    
    // Mock snarkjs
    snarkjsLoader.isInitialized.mockReturnValue(false);
    snarkjsLoader.initialize.mockResolvedValue(true);
    snarkjsLoader.getSnarkjs.mockReturnValue({
      groth16: {
        fullProve: jest.fn().mockResolvedValue({
          proof: { pi_a: ['1', '2', '3'], pi_b: [['4', '5'], ['6', '7']], pi_c: ['8', '9', '10'] },
          publicSignals: ['11', '12', '13']
        }),
        verify: jest.fn().mockResolvedValue(true)
      }
    });
  });
  
  afterEach(() => {
    global.fetch.mockClear();
  });
  
  describe('Automatic execution path selection', () => {
    it('should select client-side execution for high-capability devices', async () => {
      detectFeatures.mockReturnValue(mockCapabilities('high'));
      
      await zkProxyClient.initialize();
      
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.CLIENT_SIDE);
    });
    
    it('should select hybrid execution for medium-capability devices', async () => {
      detectFeatures.mockReturnValue(mockCapabilities('medium'));
      
      await zkProxyClient.initialize();
      
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.HYBRID);
    });
    
    it('should select server-side execution for low-capability devices', async () => {
      detectFeatures.mockReturnValue(mockCapabilities('low'));
      
      await zkProxyClient.initialize();
      
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.SERVER_SIDE);
    });
    
    it('should select server-side execution for incompatible devices', async () => {
      detectFeatures.mockReturnValue(mockCapabilities('incompatible'));
      
      await zkProxyClient.initialize();
      
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.SERVER_SIDE);
    });
  });
  
  describe('Automatic fallback', () => {
    it('should fallback to server-side execution when client-side fails', async () => {
      detectFeatures.mockReturnValue(mockCapabilities('high'));
      await zkProxyClient.initialize();
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.CLIENT_SIDE);
      
      // Make client-side execution fail
      snarkjsLoader.getSnarkjs().groth16.fullProve.mockRejectedValueOnce(
        new Error('Memory allocation failed')
      );
      
      // Set up server response
      mockApiResponse('/fullProve', 200, {
        proof: { pi_a: ['1', '2', '3'], pi_b: [['4', '5'], ['6', '7']], pi_c: ['8', '9', '10'] },
        publicSignals: ['11', '12', '13'],
        executionTimeMs: 500,
        operationId: 'fallback-op-id'
      });
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Track progress
      const progressEvents = [];
      const result = await zkProxyClient.generateProof(proofParams, {
        onProgress: (progress) => {
          progressEvents.push({
            progress: progress.progress,
            status: progress.status
          });
        }
      });
      
      // Verify fallback occurred
      expect(snarkjsLoader.getSnarkjs().groth16.fullProve).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zk/fullProve',
        expect.any(Object)
      );
      expect(result.isServerSide).toBe(true);
      
      // Verify progress reporting includes fallback messaging
      const fallbackEvent = progressEvents.find(e => 
        e.status && e.status.includes('Falling back to server-side')
      );
      expect(fallbackEvent).toBeDefined();
      
      // Verify error was recorded
      expect(telemetry.recordError).toHaveBeenCalledWith(
        'generateProof',
        'Memory allocation failed'
      );
    });
    
    it('should not fallback when fallback is disabled in user preferences', async () => {
      detectFeatures.mockReturnValue(mockCapabilities('high'));
      await zkProxyClient.initialize({
        userPreferences: {
          allowFallback: false
        }
      });
      
      // Make client-side execution fail
      snarkjsLoader.getSnarkjs().groth16.fullProve.mockRejectedValueOnce(
        new Error('Memory allocation failed')
      );
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Should fail without fallback
      await expect(zkProxyClient.generateProof(proofParams))
        .rejects.toThrow('Memory allocation failed');
      
      // Server should not have been called
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/zk/fullProve',
        expect.any(Object)
      );
    });
    
    it('should fallback to client-side execution when server is unavailable', async () => {
      // Set medium capability that would typically use hybrid mode
      detectFeatures.mockReturnValue(mockCapabilities('medium'));
      
      // Make server unavailable
      mockApiResponse('/status', 500, { error: 'Server unavailable' });
      
      await zkProxyClient.initialize();
      
      // Server unavailable, should use client-side
      expect(zkProxyClient.serverAvailable).toBe(false);
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.CLIENT_SIDE);
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Generate proof - should use client-side
      const result = await zkProxyClient.generateProof(proofParams);
      
      // Verify client-side was used
      expect(snarkjsLoader.getSnarkjs().groth16.fullProve).toHaveBeenCalled();
      expect(result.isClientSide).toBe(true);
      
      // Server should not have been called for proof gen
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/zk/fullProve',
        expect.any(Object)
      );
    });
    
    it('should throw error when both client and server execution fail', async () => {
      detectFeatures.mockReturnValue(mockCapabilities('high'));
      await zkProxyClient.initialize();
      
      // Make client-side execution fail
      snarkjsLoader.getSnarkjs().groth16.fullProve.mockRejectedValueOnce(
        new Error('Client execution failed')
      );
      
      // Make server-side execution fail too
      mockApiResponse('/fullProve', 500, { 
        error: 'Server error',
        message: 'Server execution failed' 
      });
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Should fail with server error since it's the last attempt
      await expect(zkProxyClient.generateProof(proofParams))
        .rejects.toThrow(/Server error/);
      
      // Both client and server should have been tried
      expect(snarkjsLoader.getSnarkjs().groth16.fullProve).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zk/fullProve',
        expect.any(Object)
      );
    });
  });
  
  describe('User preference handling', () => {
    it('should respect user preference for client-side execution', async () => {
      // Set low capability that would typically use server-side
      detectFeatures.mockReturnValue(mockCapabilities('low'));
      
      await zkProxyClient.initialize({
        userPreferences: {
          preferClientSide: true
        }
      });
      
      // Despite low capability, should use client-side due to preference
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.CLIENT_SIDE);
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Generate proof - should use client-side
      const result = await zkProxyClient.generateProof(proofParams);
      
      // Verify client-side was used
      expect(snarkjsLoader.getSnarkjs().groth16.fullProve).toHaveBeenCalled();
      expect(result.isClientSide).toBe(true);
    });
    
    it('should respect user preference for server-side execution', async () => {
      // Set high capability that would typically use client-side
      detectFeatures.mockReturnValue(mockCapabilities('high'));
      
      await zkProxyClient.initialize({
        userPreferences: {
          preferServerSide: true
        }
      });
      
      // Despite high capability, should use server-side due to preference
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.SERVER_SIDE);
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Generate proof - should use server-side
      const result = await zkProxyClient.generateProof(proofParams);
      
      // Verify server-side was used
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zk/fullProve',
        expect.any(Object)
      );
      expect(result.isServerSide).toBe(true);
    });
    
    it('should allow changing execution mode after initialization', async () => {
      detectFeatures.mockReturnValue(mockCapabilities('high'));
      await zkProxyClient.initialize();
      
      // Start with client-side
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.CLIENT_SIDE);
      
      // Change preference to server-side
      zkProxyClient.setUserPreferences({
        preferServerSide: true
      });
      
      // Execute mode should update
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.SERVER_SIDE);
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Generate proof - should use server-side
      const result = await zkProxyClient.generateProof(proofParams);
      
      // Verify server-side was used
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zk/fullProve',
        expect.any(Object)
      );
      expect(result.isServerSide).toBe(true);
      
      // Now set back to auto
      zkProxyClient.setExecutionMode(EXECUTION_MODES.AUTO);
      
      // Should go back to client-side for high-capability device
      expect(zkProxyClient.executionMode).toBe(EXECUTION_MODES.CLIENT_SIDE);
    });
  });
  
  describe('Hybrid mode operation', () => {
    beforeEach(async () => {
      detectFeatures.mockReturnValue(mockCapabilities('medium'));
      await zkProxyClient.initialize();
      zkProxyClient.setExecutionMode(EXECUTION_MODES.HYBRID);
    });
    
    it('should use client-side for simple proofs in hybrid mode', async () => {
      // Standard proof (type 0) - should use client-side
      const standardProofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      const standardResult = await zkProxyClient.generateProof(standardProofParams);
      
      // Verify client-side was used for standard proof
      expect(snarkjsLoader.getSnarkjs().groth16.fullProve).toHaveBeenCalled();
      expect(standardResult.isClientSide).toBe(true);
    });
    
    it('should use server-side for complex proofs in hybrid mode', async () => {
      // Reset call counts
      snarkjsLoader.getSnarkjs().groth16.fullProve.mockClear();
      global.fetch.mockClear();
      
      // Maximum proof (type 2) - should use server-side
      const maximumProofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 2 // Maximum proof is more complex
      };
      
      const maximumResult = await zkProxyClient.generateProof(maximumProofParams);
      
      // Verify server-side was used for maximum proof
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/zk/fullProve',
        expect.any(Object)
      );
      expect(maximumResult.isServerSide).toBe(true);
    });
  });
  
  describe('Progress reporting', () => {
    it('should report consistent progress for both client and server execution', async () => {
      // Initialize with client-side capabilities
      detectFeatures.mockReturnValue(mockCapabilities('high'));
      await zkProxyClient.initialize();
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Track progress for client-side
      const clientProgressEvents = [];
      await zkProxyClient.generateProof(proofParams, {
        onProgress: (progress) => {
          clientProgressEvents.push({
            progress: progress.progress,
            status: progress.status
          });
        }
      });
      
      // Verify client-side progress reporting
      expect(clientProgressEvents.length).toBeGreaterThan(2);
      expect(clientProgressEvents[0].progress).toBe(0); // First event at 0%
      expect(clientProgressEvents[clientProgressEvents.length - 1].progress).toBe(100); // Last event at 100%
      
      // Switch to server-side
      zkProxyClient.setExecutionMode(EXECUTION_MODES.SERVER_SIDE);
      
      // Track progress for server-side
      const serverProgressEvents = [];
      await zkProxyClient.generateProof(proofParams, {
        onProgress: (progress) => {
          serverProgressEvents.push({
            progress: progress.progress,
            status: progress.status
          });
        }
      });
      
      // Verify server-side progress reporting
      expect(serverProgressEvents.length).toBeGreaterThan(2);
      expect(serverProgressEvents[0].progress).toBe(0); // First event at 0%
      expect(serverProgressEvents[serverProgressEvents.length - 1].progress).toBe(100); // Last event at 100%
      
      // Verify both have similar progression patterns
      expect(Math.abs(clientProgressEvents.length - serverProgressEvents.length)).toBeLessThan(5);
    });
  });
  
  describe('Rate limiting', () => {
    it('should handle server-side rate limiting', async () => {
      // Set server-side execution
      detectFeatures.mockReturnValue(mockCapabilities('low'));
      await zkProxyClient.initialize();
      
      // Mock rate limit error
      mockApiResponse('/fullProve', 429, {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 30,
        limits: {
          minuteLimit: {
            remaining: 0,
            reset: Date.now() + 30000
          }
        }
      });
      
      // Create proof params
      const proofParams = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000',
        proofType: 0
      };
      
      // Should fail with rate limit error
      await expect(zkProxyClient.generateProof(proofParams))
        .rejects.toThrow(/Rate limit exceeded/);
      
      // Error should be recorded
      expect(telemetry.recordError).toHaveBeenCalled();
    });
  });
  
  describe('Error handling', () => {
    it('should handle and report initialization errors', async () => {
      // Mock initialization failure
      snarkjsLoader.initialize.mockRejectedValueOnce(new Error('Failed to initialize snarkjs'));
      
      // Should throw error during initialization
      await expect(zkProxyClient.initialize())
        .rejects.toThrow('Failed to initialize snarkjs');
      
      // Error should be recorded
      expect(telemetry.recordError).toHaveBeenCalledWith(
        'zkProxyClient.initialize',
        'Failed to initialize snarkjs'
      );
    });
    
    it('should handle server unavailability during status check', async () => {
      // Mock server status failure
      mockApiResponse('/status', 500, { error: 'Server unavailable' });
      
      // Initialize should still succeed, just mark server as unavailable
      await zkProxyClient.initialize();
      
      expect(zkProxyClient.serverAvailable).toBe(false);
    });
  });
});