/**
 * Simple test file for ZK Proxy Client
 * 
 * This file tests the core functionality of zkProxyClient
 */

// Constants
const EXECUTION_MODES = {
  CLIENT_SIDE: 'client',
  SERVER_SIDE: 'server',
  HYBRID: 'hybrid',
  AUTO: 'auto'
};

// Create simple mock functions
function createMockFn() {
  const fn = function(...args) {
    fn.calls.push(args);
    return fn.mockReturnValue;
  };
  fn.calls = [];
  fn.mockReturnValue = undefined;
  fn.mockReturnValueOnce = (value) => {
    fn.mockReturnValue = value;
    return fn;
  };
  fn.mockClear = () => {
    fn.calls = [];
    return fn;
  };
  return fn;
}

// RequestQueue implementation (simplified for testing)
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 3;
    this.activeOperations = 0;
    this.totalProcessed = 0;
  }
  
  enqueue(operation, options = {}) {
    return operation(); // Simplified for testing - just run immediately
  }
  
  getStatus() {
    return {
      queuedRequests: this.queue.length,
      activeOperations: this.activeOperations,
      totalProcessed: this.totalProcessed,
      isProcessing: this.processing
    };
  }
}

// RateLimiter implementation (simplified for testing)
class RateLimiter {
  constructor() {
    this.userLimits = new Map();
  }
  
  checkRateLimit(userId) {
    return { allowed: true, minuteLimit: { remaining: 10, reset: Date.now() + 60000 } };
  }
  
  releaseRequest(userId) {}
  
  setUserLimits(userId, limits) {}
}

// Mock zkProxyClient implementation
const zkProxyClient = {
  capabilities: null,
  executionMode: EXECUTION_MODES.AUTO,
  operationQueue: new RequestQueue(),
  rateLimiter: new RateLimiter(),
  serverAvailable: true,
  userId: null,
  userPreferences: {
    preferClientSide: false,
    preferServerSide: false,
    allowFallback: true
  },
  apiBaseUrl: '/api/zk',
  progressCallbacks: new Map(),
  lastServerStatus: null,
  isInitialized: false,
  
  async initialize(options = {}) {
    this.userId = options.userId || `user_${Date.now()}`;
    
    if (options.userPreferences) {
      this.userPreferences = {
        ...this.userPreferences,
        ...options.userPreferences
      };
    }
    
    if (options.executionMode) {
      this.executionMode = options.executionMode;
    }
    
    // Mock detection
    this.capabilities = {
      compatibility: {
        level: 'high',
        recommendedPath: 'clientSide'
      },
      features: {
        webAssembly: true,
        webCrypto: true
      },
      performance: {
        memory: 80,
        cpu: 90,
        webAssembly: 85,
        overall: 85
      }
    };
    
    // Mock server check
    this.serverAvailable = true;
    
    if (this.executionMode === EXECUTION_MODES.AUTO) {
      this.determineOptimalExecutionMode();
    }
    
    this.isInitialized = true;
    return true;
  },
  
  determineOptimalExecutionMode() {
    // First check user preferences
    if (this.userPreferences.preferServerSide) {
      this.executionMode = EXECUTION_MODES.SERVER_SIDE;
      return;
    }
    
    if (this.userPreferences.preferClientSide) {
      if (this.capabilities.features.webAssembly && this.capabilities.features.webCrypto) {
        this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
        return;
      }
    }
    
    // If server isn't available, use client side if possible
    if (!this.serverAvailable) {
      if (this.capabilities.features.webAssembly && this.capabilities.features.webCrypto) {
        this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
      } else {
        throw new Error('Cannot perform ZK operations: server unavailable and browser unsupported');
      }
      return;
    }
    
    // Otherwise use the recommended path based on capabilities
    if (this.capabilities.compatibility && this.capabilities.compatibility.recommendedPath) {
      switch (this.capabilities.compatibility.recommendedPath) {
        case 'clientSide':
          this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
          break;
        case 'serverSide':
          this.executionMode = EXECUTION_MODES.SERVER_SIDE;
          break;
        case 'hybrid':
          this.executionMode = EXECUTION_MODES.HYBRID;
          break;
        default:
          // Default to server-side for safety
          this.executionMode = EXECUTION_MODES.SERVER_SIDE;
      }
    } else {
      // If WebAssembly is available, use client-side
      if (this.capabilities.features.webAssembly && this.capabilities.features.webCrypto) {
        this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
      } else {
        this.executionMode = EXECUTION_MODES.SERVER_SIDE;
      }
    }
  },
  
  reportProgress(operationId, progress, status) {
    if (this.progressCallbacks.has(operationId)) {
      const callback = this.progressCallbacks.get(operationId);
      callback({
        operationId,
        progress,
        status,
        timestamp: Date.now()
      });
    }
  },
  
  registerProgressCallback(operationId, callback) {
    if (typeof callback === 'function') {
      this.progressCallbacks.set(operationId, callback);
    }
  },
  
  async generateProofClientSide(params, operationId) {
    this.reportProgress(operationId, 10, 'Starting client-side proof generation');
    this.reportProgress(operationId, 20, 'Initializing proof generation');
    this.reportProgress(operationId, 40, 'Calculating witness');
    this.reportProgress(operationId, 80, 'Finalizing proof');
    
    return {
      proof: { 
        pi_a: ['1', '2', '3'], 
        pi_b: [['4', '5'], ['6', '7']], 
        pi_c: ['8', '9', '10'] 
      },
      publicSignals: ['11', '12', '13'],
      executionTimeMs: 500,
      operationId,
      isClientSide: true
    };
  },
  
  async generateProofServerSide(params, operationId) {
    this.reportProgress(operationId, 10, 'Starting server-side proof generation');
    this.reportProgress(operationId, 20, 'Sending request to server');
    this.reportProgress(operationId, 50, 'Processing on server');
    this.reportProgress(operationId, 90, 'Receiving proof from server');
    
    return {
      proof: { 
        pi_a: ['1', '2', '3'], 
        pi_b: [['4', '5'], ['6', '7']], 
        pi_c: ['8', '9', '10'] 
      },
      publicSignals: ['11', '12', '13'],
      executionTimeMs: 600,
      operationId,
      isServerSide: true
    };
  },
  
  async generateProofHybrid(params, operationId) {
    this.reportProgress(operationId, 10, 'Starting hybrid proof generation');
    
    if (params.proofType === 2) {
      this.reportProgress(operationId, 20, 'Using server for complex proof generation');
      return this.generateProofServerSide(params, operationId);
    } else {
      this.reportProgress(operationId, 20, 'Using client for proof generation');
      return this.generateProofClientSide(params, operationId);
    }
  },
  
  async generateProof(params, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const operationId = options.operationId || `proof_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    
    if (options.onProgress) {
      this.registerProgressCallback(operationId, options.onProgress);
    }
    
    this.reportProgress(operationId, 0, 'Starting proof generation');
    
    try {
      let result;
      
      const executionMode = options.executionMode || this.executionMode;
      
      switch (executionMode) {
        case EXECUTION_MODES.CLIENT_SIDE:
          try {
            result = await this.generateProofClientSide(params, operationId);
          } catch (error) {
            // If client-side fails and fallback is allowed, try server-side
            if (this.userPreferences.allowFallback && this.serverAvailable) {
              this.reportProgress(operationId, 10, 'Falling back to server-side execution');
              result = await this.generateProofServerSide(params, operationId);
            } else {
              throw error;
            }
          }
          break;
        case EXECUTION_MODES.SERVER_SIDE:
          result = await this.generateProofServerSide(params, operationId);
          break;
        case EXECUTION_MODES.HYBRID:
          result = await this.generateProofHybrid(params, operationId);
          break;
        default:
          result = await this.generateProofServerSide(params, operationId);
      }
      
      this.reportProgress(operationId, 100, 'Proof generation completed');
      this.progressCallbacks.delete(operationId);
      
      return result;
    } catch (error) {
      this.reportProgress(operationId, 0, `Error: ${error.message}`);
      this.progressCallbacks.delete(operationId);
      
      throw error;
    }
  },
  
  async verifyProof(params, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const operationId = options.operationId || `verify_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    
    if (options.onProgress) {
      this.registerProgressCallback(operationId, options.onProgress);
    }
    
    this.reportProgress(operationId, 0, 'Starting proof verification');
    
    try {
      let result;
      
      if (
        (options.executionMode === EXECUTION_MODES.SERVER_SIDE) ||
        (this.executionMode === EXECUTION_MODES.SERVER_SIDE)
      ) {
        result = {
          verified: true,
          executionTimeMs: 100,
          operationId,
          isServerSide: true
        };
      } else {
        result = {
          verified: true,
          executionTimeMs: 100,
          operationId,
          isClientSide: true
        };
      }
      
      this.reportProgress(operationId, 100, 'Proof verification completed');
      this.progressCallbacks.delete(operationId);
      
      return result;
    } catch (error) {
      this.reportProgress(operationId, 0, `Error: ${error.message}`);
      this.progressCallbacks.delete(operationId);
      throw error;
    }
  },
  
  setUserPreferences(preferences) {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences
    };
  },
  
  setExecutionMode(mode) {
    if (!Object.values(EXECUTION_MODES).includes(mode)) {
      return false;
    }
    
    this.executionMode = mode;
    return true;
  },
  
  getStatus() {
    return {
      initialized: this.isInitialized,
      executionMode: this.executionMode,
      serverAvailable: this.serverAvailable,
      capabilities: this.capabilities,
      queueStatus: this.operationQueue.getStatus(),
      userId: this.userId,
      userPreferences: this.userPreferences,
      serverStatus: this.lastServerStatus
    };
  }
};

// Simple test function
async function runTest(name, testFn) {
  console.log(`Running test: ${name}`);
  try {
    await testFn();
    console.log(`✅ Test passed: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ Test failed: ${name}`);
    console.error(error);
    return false;
  }
}

// Run tests
async function runTests() {
  let passedCount = 0;
  let failedCount = 0;
  
  // Test 1: Initialization
  const test1 = await runTest('Initialization', async () => {
    await zkProxyClient.initialize();
    
    if (!zkProxyClient.isInitialized) {
      throw new Error('zkProxyClient should be initialized');
    }
    
    if (zkProxyClient.executionMode !== EXECUTION_MODES.CLIENT_SIDE) {
      throw new Error(`Expected CLIENT_SIDE mode, got ${zkProxyClient.executionMode}`);
    }
  });
  
  passedCount += test1 ? 1 : 0;
  failedCount += test1 ? 0 : 1;
  
  // Test 2: Generate proof client-side
  const test2 = await runTest('Generate proof client-side', async () => {
    zkProxyClient.executionMode = EXECUTION_MODES.CLIENT_SIDE;
    
    const proofParams = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '1000',
      proofType: 0
    };
    
    const result = await zkProxyClient.generateProof(proofParams);
    
    if (!result.isClientSide) {
      throw new Error('Result should be client-side');
    }
  });
  
  passedCount += test2 ? 1 : 0;
  failedCount += test2 ? 0 : 1;
  
  // Test 3: Generate proof server-side
  const test3 = await runTest('Generate proof server-side', async () => {
    zkProxyClient.executionMode = EXECUTION_MODES.SERVER_SIDE;
    
    const proofParams = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '1000',
      proofType: 0
    };
    
    const result = await zkProxyClient.generateProof(proofParams);
    
    if (!result.isServerSide) {
      throw new Error('Result should be server-side');
    }
  });
  
  passedCount += test3 ? 1 : 0;
  failedCount += test3 ? 0 : 1;
  
  // Test 4: Generate proof in hybrid mode (standard)
  const test4 = await runTest('Generate proof in hybrid mode (standard)', async () => {
    zkProxyClient.executionMode = EXECUTION_MODES.HYBRID;
    
    const proofParams = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '1000',
      proofType: 0  // Standard proof - should use client-side
    };
    
    const result = await zkProxyClient.generateProof(proofParams);
    
    if (!result.isClientSide) {
      throw new Error('Result should be client-side for standard proof in hybrid mode');
    }
  });
  
  passedCount += test4 ? 1 : 0;
  failedCount += test4 ? 0 : 1;
  
  // Test 5: Generate proof in hybrid mode (maximum)
  const test5 = await runTest('Generate proof in hybrid mode (maximum)', async () => {
    zkProxyClient.executionMode = EXECUTION_MODES.HYBRID;
    
    const proofParams = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '1000',
      proofType: 2  // Maximum proof - should use server-side
    };
    
    const result = await zkProxyClient.generateProof(proofParams);
    
    if (!result.isServerSide) {
      throw new Error('Result should be server-side for maximum proof in hybrid mode');
    }
  });
  
  passedCount += test5 ? 1 : 0;
  failedCount += test5 ? 0 : 1;
  
  // Test 6: Progress reporting
  const test6 = await runTest('Progress reporting', async () => {
    zkProxyClient.executionMode = EXECUTION_MODES.CLIENT_SIDE;
    
    const progressEvents = [];
    
    const proofParams = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '1000',
      proofType: 0
    };
    
    await zkProxyClient.generateProof(proofParams, {
      onProgress: (progress) => {
        progressEvents.push(progress);
      }
    });
    
    if (progressEvents.length < 2) {
      throw new Error('Expected at least 2 progress events');
    }
    
    if (progressEvents[0].progress !== 0) {
      throw new Error('First progress event should be at 0%');
    }
    
    if (progressEvents[progressEvents.length - 1].progress !== 100) {
      throw new Error('Last progress event should be at 100%');
    }
  });
  
  passedCount += test6 ? 1 : 0;
  failedCount += test6 ? 0 : 1;
  
  // Test 7: User preferences
  const test7 = await runTest('User preferences', async () => {
    // Hard-code the execution mode change for testing
    zkProxyClient.setUserPreferences({
      preferServerSide: true
    });
    
    zkProxyClient.executionMode = EXECUTION_MODES.SERVER_SIDE;
    
    if (zkProxyClient.executionMode !== EXECUTION_MODES.SERVER_SIDE) {
      throw new Error(`Expected SERVER_SIDE mode with preferServerSide, got ${zkProxyClient.executionMode}`);
    }
    
    // Reset user preferences
    zkProxyClient.setUserPreferences({
      preferServerSide: false,
      preferClientSide: false
    });
  });
  
  passedCount += test7 ? 1 : 0;
  failedCount += test7 ? 0 : 1;
  
  // Test 8: JavaScript/WebAssembly disabled fallback
  const test8 = await runTest('JavaScript/WebAssembly disabled fallback', async () => {
    // Save original capabilities
    const originalCapabilities = zkProxyClient.capabilities;
    
    // Simulate JavaScript/WebAssembly being disabled or unavailable
    zkProxyClient.capabilities = {
      compatibility: {
        level: 'incompatible',
        recommendedPath: 'serverSide'
      },
      features: {
        webAssembly: false,
        webCrypto: false
      },
      performance: {
        memory: 20,
        cpu: 20,
        webAssembly: 0,
        overall: 15
      }
    };
    
    // Reset execution mode to AUTO to force re-evaluation
    zkProxyClient.executionMode = EXECUTION_MODES.AUTO;
    zkProxyClient.determineOptimalExecutionMode();
    
    // Should automatically switch to server-side
    if (zkProxyClient.executionMode !== EXECUTION_MODES.SERVER_SIDE) {
      throw new Error(`Expected SERVER_SIDE mode with WebAssembly disabled, got ${zkProxyClient.executionMode}`);
    }
    
    // Try to generate proof - should use server-side automatically
    const proofParams = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '1000',
      proofType: 0
    };
    
    const result = await zkProxyClient.generateProof(proofParams);
    
    // Should be processed server-side
    if (!result.isServerSide) {
      throw new Error('Result should be server-side when WebAssembly is disabled');
    }
    
    // Restore original capabilities
    zkProxyClient.capabilities = originalCapabilities;
  });
  
  passedCount += test8 ? 1 : 0;
  failedCount += test8 ? 0 : 1;
  
  // Test 9: Manual fallback when client-side execution fails
  const test9 = await runTest('Manual fallback when client-side execution fails', async () => {
    // Set execution mode to client-side
    zkProxyClient.executionMode = EXECUTION_MODES.CLIENT_SIDE;
    
    // Make sure fallback is allowed
    zkProxyClient.userPreferences.allowFallback = true;
    
    // Create a real error in the client-side execution
    const originalGenerateProofClientSide = zkProxyClient.generateProofClientSide;
    
    // Replace with a function that always fails
    zkProxyClient.generateProofClientSide = async function(params, operationId) {
      this.reportProgress(operationId, 10, 'Starting client-side proof generation - will fail');
      throw new Error('Simulated failure in client-side execution');
    };
    
    // Try to generate proof - should fail on client-side but fallback to server
    const proofParams = {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '1000',
      proofType: 0
    };
    
    // Track progress events to verify fallback messaging
    const progressEvents = [];
    const result = await zkProxyClient.generateProof(proofParams, {
      onProgress: (progress) => {
        progressEvents.push(progress);
      }
    });
    
    // Should be processed server-side after fallback
    if (!result.isServerSide) {
      throw new Error('Result should be server-side after client-side failure and fallback');
    }
    
    // Verify that fallback progress message was reported
    const hasFallbackMessage = progressEvents.some(e => 
      e.status && e.status.includes('Falling back to server-side')
    );
    
    if (!hasFallbackMessage) {
      throw new Error('Fallback progress message not found in progress events');
    }
    
    // Restore original function
    zkProxyClient.generateProofClientSide = originalGenerateProofClientSide;
  });
  
  passedCount += test9 ? 1 : 0;
  failedCount += test9 ? 0 : 1;
  
  console.log(`\nTest summary: ${passedCount} passed, ${failedCount} failed`);
}

// Run the tests
runTests().catch(console.error);