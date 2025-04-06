/**
 * Mocks for ZK testing
 * 
 * This file contains mock implementations used for testing the ZK module.
 */

// Mock implementation of zkProxyClient for testing
export function createMockZKProxyClient() {
  // Define execution modes
  const EXECUTION_MODES = {
    CLIENT_SIDE: 'client',
    SERVER_SIDE: 'server',
    HYBRID: 'hybrid',
    AUTO: 'auto'
  };

  // Mock rate limiter implementation
  class MockRateLimiter {
    constructor() {
      this.userLimits = new Map();
    }
    
    checkRateLimit(userId) {
      return { 
        allowed: true, 
        minuteLimit: { remaining: 10, reset: Date.now() + 60000 },
        hourLimit: { remaining: 100, reset: Date.now() + 3600000 },
        dayLimit: { remaining: 1000, reset: Date.now() + 86400000 }
      };
    }
    
    releaseRequest(userId) {
      // Do nothing for tests
    }
  }

  // Mock request queue implementation
  class MockRequestQueue {
    constructor() {
      this.pendingRequests = [];
    }
    
    enqueue(operation, priority = 5) {
      // For testing, just execute operation immediately
      return operation();
    }
    
    getPendingCount() {
      return this.pendingRequests.length;
    }
  }

  // Create mock client
  return {
    capabilities: {
      features: {
        webAssembly: true,
        webCrypto: true,
        webWorkers: true,
        indexedDB: true
      },
      compatibility: {
        level: 'high',
        recommendedPath: 'clientSide'
      },
      device: {
        memory: 8192,
        cpuCores: 4,
        isLowPowered: false,
        isMobile: false
      }
    },
    executionMode: EXECUTION_MODES.AUTO,
    operationQueue: new MockRequestQueue(),
    rateLimiter: new MockRateLimiter(),
    serverAvailable: true,
    userPreferences: {
      preferClientSide: false,
      preferServerSide: false,
      allowFallback: true
    },
    progressCallbacks: new Map(),
    operationHistory: [],
    isInitialized: false,
    
    async initialize() {
      this.isInitialized = true;
      return true;
    },
    
    determineOptimalExecutionMode() {
      if (this.userPreferences.preferClientSide) {
        this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
      } else if (this.userPreferences.preferServerSide) {
        this.executionMode = EXECUTION_MODES.SERVER_SIDE;
      } else if (this.capabilities.device.isLowPowered) {
        this.executionMode = EXECUTION_MODES.SERVER_SIDE;
      } else {
        this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
      }
      return this.executionMode;
    },
    
    setExecutionMode(mode) {
      if (Object.values(EXECUTION_MODES).includes(mode)) {
        this.executionMode = mode;
        return true;
      }
      return false;
    },
    
    registerProgressCallback(operationId, callback) {
      if (typeof callback === 'function') {
        this.progressCallbacks.set(operationId, callback);
      }
    },
    
    reportProgress(operationId, progress, status) {
      if (this.progressCallbacks.has(operationId)) {
        this.progressCallbacks.get(operationId)({
          operationId,
          progress,
          status,
          timestamp: Date.now()
        });
      }
    },
    
    async generateProofClientSide(params, operationId) {
      this.reportProgress(operationId, 20, 'Preparing inputs...');
      await new Promise(r => setTimeout(r, 50));
      
      this.reportProgress(operationId, 40, 'Computing proof on client...');
      await new Promise(r => setTimeout(r, 50));
      
      this.reportProgress(operationId, 90, 'Finalizing proof...');
      await new Promise(r => setTimeout(r, 50));
      
      this.operationHistory.push({
        type: 'client',
        params,
        timestamp: Date.now()
      });
      
      return {
        proof: { 
          pi_a: ['1', '2', '3'], 
          pi_b: [['4', '5'], ['6', '7']], 
          pi_c: ['8', '9', '10'] 
        },
        publicSignals: ['11', '12', '13'],
        isClientSide: true,
        executionTimeMs: 100
      };
    },
    
    async generateProofServerSide(params, operationId) {
      this.reportProgress(operationId, 20, 'Sending request to server...');
      await new Promise(r => setTimeout(r, 50));
      
      this.reportProgress(operationId, 50, 'Computing proof on server...');
      await new Promise(r => setTimeout(r, 50));
      
      this.reportProgress(operationId, 90, 'Receiving proof from server...');
      await new Promise(r => setTimeout(r, 50));
      
      this.operationHistory.push({
        type: 'server',
        params,
        timestamp: Date.now()
      });
      
      return {
        proof: { 
          pi_a: ['1', '2', '3'], 
          pi_b: [['4', '5'], ['6', '7']], 
          pi_c: ['8', '9', '10'] 
        },
        publicSignals: ['11', '12', '13'],
        isServerSide: true,
        executionTimeMs: 150
      };
    },
    
    async generateProofHybrid(params, operationId) {
      this.reportProgress(operationId, 10, 'Starting hybrid proof generation');
      
      if (params.proofType === 2) { // Maximum proof type is complex
        this.reportProgress(operationId, 20, 'Using server for complex proof generation');
        return this.generateProofServerSide(params, operationId);
      } else {
        this.reportProgress(operationId, 20, 'Using client for proof generation');
        return this.generateProofClientSide(params, operationId);
      }
    },
    
    async generateProof(params, options = {}) {
      const operationId = options.operationId || `test_op_${Date.now()}`;
      
      if (options.onProgress) {
        this.registerProgressCallback(operationId, options.onProgress);
      }
      
      this.reportProgress(operationId, 0, 'Starting proof generation');
      
      let result;
      switch (this.executionMode) {
        case EXECUTION_MODES.CLIENT_SIDE:
          result = await this.generateProofClientSide(params, operationId);
          break;
        case EXECUTION_MODES.SERVER_SIDE:
          result = await this.generateProofServerSide(params, operationId);
          break;
        case EXECUTION_MODES.HYBRID:
          result = await this.generateProofHybrid(params, operationId);
          break;
        default: // AUTO
          if (params.proofType === 2) { // Complex proof
            result = await this.generateProofServerSide(params, operationId);
          } else {
            result = await this.generateProofClientSide(params, operationId);
          }
      }
      
      this.reportProgress(operationId, 100, 'Proof generation complete');
      
      return result;
    },
    
    setUserPreferences(preferences) {
      this.userPreferences = {
        ...this.userPreferences,
        ...preferences
      };
    },
    
    async verifyProof(proof, publicSignals, options = {}) {
      return { isValid: true, verificationTimeMs: 50 };
    },
    
    async getServerStatus() {
      return {
        available: this.serverAvailable,
        load: 0.3,
        queueDepth: 0,
        estimatedWaitTime: 0,
        features: ['standard', 'threshold', 'maximum']
      };
    }
  };
}

// Create mock fetch for testing API endpoints
export function createMockFetch() {
  return async (url, options = {}) => {
    if (url.includes('/api/zk/fullProve')) {
      return {
        ok: true,
        json: async () => ({
          proof: { 
            pi_a: ['1', '2', '3'], 
            pi_b: [['4', '5'], ['6', '7']], 
            pi_c: ['8', '9', '10'] 
          },
          publicSignals: ['11', '12', '13'],
          executionTimeMs: 150
        })
      };
    }
    
    if (url.includes('/api/zk/verify')) {
      return {
        ok: true,
        json: async () => ({
          isValid: true,
          verificationTimeMs: 50
        })
      };
    }
    
    if (url.includes('/api/zk/status')) {
      return {
        ok: true,
        json: async () => ({
          available: true,
          capabilities: {
            cpu: { cores: 16, load: 0.3 },
            memory: { total: 32768, free: 16384 },
          },
          limits: {
            maxConcurrent: 50,
            maxQueueDepth: 100
          },
          currentState: {
            queueDepth: 0,
            activeOperations: 0
          }
        })
      };
    }
    
    return { 
      ok: false,
      status: 404,
      json: async () => ({ error: 'Endpoint not found' })
    };
  };
}

export default {
  createMockZKProxyClient,
  createMockFetch
};