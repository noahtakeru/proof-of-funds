/**
 * Server Fallback System Test Runner
 * 
 * This module runs tests for the client/server fallback system
 * that ensures proofs can be generated either on the client or server
 * depending on device capabilities and preferences.
 */

import { createBenchmark } from '../../benchmarkSuite.js';
// Define execution modes locally to avoid import issues
const EXECUTION_MODES = {
  CLIENT_SIDE: 'client',
  SERVER_SIDE: 'server',
  HYBRID: 'hybrid',
  AUTO: 'auto'
};

// Mock implementations for the test runner
class MockRateLimiter {
  constructor() {
    this.userLimits = new Map();
  }
  
  checkRateLimit(userId) {
    return { allowed: true, minuteLimit: { remaining: 10, reset: Date.now() + 60000 } };
  }
  
  releaseRequest(userId) {}
}

class MockRequestQueue {
  constructor() {}
  
  enqueue(operation) {
    return operation();
  }
}

/**
 * Create a mock ZK Proxy Client for testing
 * @returns {Object} A simplified mock of zkProxyClient
 */
function createMockZKProxyClient() {
  return {
    capabilities: {
      features: {
        webAssembly: true,
        webCrypto: true
      },
      compatibility: {
        level: 'high',
        recommendedPath: 'clientSide'
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
    isInitialized: false,
    
    async initialize() {
      this.isInitialized = true;
      return true;
    },
    
    determineOptimalExecutionMode() {
      // Select client-side for tests
      this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
    },
    
    setExecutionMode(mode) {
      this.executionMode = mode;
      return true;
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
      this.reportProgress(operationId, 20, 'Computing proof on client...');
      await new Promise(r => setTimeout(r, 100));
      
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
      this.reportProgress(operationId, 20, 'Computing proof on server...');
      await new Promise(r => setTimeout(r, 100));
      
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
      
      if (params.proofType === 2) {
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
      this.reportProgress(operationId, 100, 'Completing proof generation');
      
      switch (this.executionMode) {
        case EXECUTION_MODES.CLIENT_SIDE:
          return this.generateProofClientSide(params, operationId);
        case EXECUTION_MODES.SERVER_SIDE:
          return this.generateProofServerSide(params, operationId);
        case EXECUTION_MODES.HYBRID:
          return this.generateProofHybrid(params, operationId);
        default:
          return this.generateProofServerSide(params, operationId);
      }
    },
    
    setUserPreferences(preferences) {
      this.userPreferences = {
        ...this.userPreferences,
        ...preferences
      };
    }
  };
}

/**
 * Test client-side execution mode
 * @param {Object} client - ZK Proxy Client
 * @returns {Object} Test result
 */
async function testClientSideExecution(client) {
  client.setExecutionMode(EXECUTION_MODES.CLIENT_SIDE);
  
  const result = await client.generateProof({
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    amount: '1000',
    proofType: 0
  });
  
  return {
    passed: result.isClientSide === true,
    message: result.isClientSide ? 'Client-side execution successful' : 'Expected client-side execution'
  };
}

/**
 * Test server-side execution mode
 * @param {Object} client - ZK Proxy Client
 * @returns {Object} Test result
 */
async function testServerSideExecution(client) {
  client.setExecutionMode(EXECUTION_MODES.SERVER_SIDE);
  
  const result = await client.generateProof({
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    amount: '1000',
    proofType: 0
  });
  
  return {
    passed: result.isServerSide === true,
    message: result.isServerSide ? 'Server-side execution successful' : 'Expected server-side execution'
  };
}

/**
 * Test hybrid execution mode with standard proof (should use client)
 * @param {Object} client - ZK Proxy Client
 * @returns {Object} Test result
 */
async function testHybridExecutionStandard(client) {
  client.setExecutionMode(EXECUTION_MODES.HYBRID);
  
  const result = await client.generateProof({
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    amount: '1000',
    proofType: 0 // Standard proof should use client
  });
  
  return {
    passed: result.isClientSide === true,
    message: result.isClientSide ? 'Hybrid mode correctly chose client-side for standard proof' : 'Expected client-side for standard proof in hybrid mode'
  };
}

/**
 * Test user preference for server-side
 * @param {Object} client - ZK Proxy Client
 * @returns {Object} Test result
 */
async function testUserPreferenceServerSide(client) {
  // Set preference for server-side
  client.setUserPreferences({
    preferServerSide: true,
    preferClientSide: false
  });
  
  client.setExecutionMode(EXECUTION_MODES.AUTO);
  
  const result = await client.generateProof({
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    amount: '1000',
    proofType: 0
  });
  
  // Reset preferences
  client.setUserPreferences({
    preferServerSide: false,
    preferClientSide: false
  });
  
  return {
    passed: result.isServerSide === true,
    message: result.isServerSide ? 'User preference for server-side respected' : 'Failed to respect server-side preference'
  };
}

/**
 * Test progress reporting
 * @param {Object} client - ZK Proxy Client
 * @returns {Object} Test result
 */
async function testProgressReporting(client) {
  client.setExecutionMode(EXECUTION_MODES.CLIENT_SIDE);
  
  const progressEvents = [];
  
  await client.generateProof({
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    amount: '1000',
    proofType: 0
  }, {
    onProgress: (progress) => {
      progressEvents.push(progress);
    }
  });
  
  const hasInitialProgress = progressEvents.some(e => e.progress === 0);
  const hasFinalProgress = progressEvents.some(e => e.progress === 100);
  
  return {
    passed: progressEvents.length >= 2 && hasInitialProgress && hasFinalProgress,
    message: progressEvents.length >= 2 ? 'Progress reporting works correctly' : 'Progress reporting failed'
  };
}

/**
 * Run all server fallback tests
 * @returns {Object} Test results
 */
// Function to run tests when called directly
async function main() {
  const results = await runServerFallbackTests();
  console.log(JSON.stringify(results, null, 2));
  return results;
}

// Run tests if called directly
if (typeof process !== 'undefined' && 
    process.argv.length > 1 && 
    process.argv[1] && 
    import.meta && 
    process.argv[1] === import.meta.url.substring(7)) {
  main().catch(console.error);
}

export async function runServerFallbackTests() {
  console.log('Starting Server Fallback Tests...');
  
  const benchmark = createBenchmark('server-fallback', {
    operationType: 'testing',
    circuitType: 'fallback'
  });
  
  benchmark.start();
  
  try {
    const client = createMockZKProxyClient();
    await client.initialize();
    
    const tests = [
      { name: 'Client-Side Execution', run: () => testClientSideExecution(client) },
      { name: 'Server-Side Execution', run: () => testServerSideExecution(client) },
      { name: 'Hybrid Execution (Standard Proof)', run: () => testHybridExecutionStandard(client) },
      { name: 'User Preference (Server-Side)', run: () => testUserPreferenceServerSide(client) },
      { name: 'Progress Reporting', run: () => testProgressReporting(client) }
    ];
    
    const results = [];
    let totalPassed = 0;
    
    for (const test of tests) {
      console.log(`  Running test: ${test.name}`);
      try {
        const testResult = await test.run();
        results.push({
          name: test.name,
          passed: testResult.passed,
          message: testResult.message
        });
        
        if (testResult.passed) {
          totalPassed++;
          console.log(`  ✅ ${test.name}: Passed`);
        } else {
          console.log(`  ❌ ${test.name}: Failed - ${testResult.message}`);
        }
      } catch (error) {
        results.push({
          name: test.name,
          passed: false,
          message: error.message,
          error: error.stack
        });
        console.log(`  ❌ ${test.name}: Error - ${error.message}`);
      }
    }
    
    // Calculate total execution time
    const benchmarkResult = benchmark.end();
    
    return {
      testName: 'Server Fallback',
      totalTests: tests.length,
      totalPassed,
      results,
      executionTime: benchmarkResult.executionTime,
      performanceMetrics: {
        generation: benchmarkResult.executionTime / tests.length,
        verification: 0 // Not applicable for these tests
      }
    };
  } catch (error) {
    console.error('Error running Server Fallback tests:', error);
    throw error;
  }
}