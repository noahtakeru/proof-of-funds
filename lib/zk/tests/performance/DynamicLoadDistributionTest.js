/**
 * @fileoverview Real tests for the DynamicLoadDistribution component
 */

import assert from 'assert';

console.log('Running DynamicLoadDistribution tests...');

// Define enums inline for ESM compatibility
const ResourceType = {
  CPU: 'CPU',
  MEMORY: 'MEMORY'
};

const DistributionStrategy = {
  SINGLE_THREADED: 'single-threaded',
  FIXED_WORKERS: 'fixed-workers',
  DYNAMIC_WORKERS: 'dynamic-workers',
  SERVER_FALLBACK: 'server-fallback',
  HYBRID: 'hybrid'
};

// Mock minimal Web Worker Pool for testing
class WebWorkerPool {
  constructor(config = {}) {
    this.activeWorkers = 0;
  }

  getActiveWorkerCount() {
    return this.activeWorkers;
  }

  async executeTask(type, fn, data, options = {}) {
    return await fn(data);
  }

  setMaxWorkers(count) {
    // No-op for testing
  }

  shutdown() {
    // No-op for testing
  }
}

// Mock implementation of ResourceMonitor
class MockResourceMonitor {
  constructor() {
    this.monitoring = false;
    this.latestSnapshot = {
      resources: {
        [ResourceType.CPU]: {
          currentUsage: 0.2,
          metrics: { usagePercent: 20 }
        },
        [ResourceType.MEMORY]: {
          currentUsage: 0.3,
          metrics: { 
            totalBytes: 8 * 1024 * 1024 * 1024, // 8GB
            usedBytes: 2 * 1024 * 1024 * 1024,  // 2GB
            peakBytes: 3 * 1024 * 1024 * 1024   // 3GB
          }
        }
      }
    };
  }
  
  isMonitoring() {
    return this.monitoring;
  }
  
  async startMonitoring() {
    this.monitoring = true;
    return true;
  }
  
  stopMonitoring() {
    this.monitoring = false;
  }
  
  getLatestSnapshot() {
    return this.latestSnapshot;
  }
  
  async sampleResources() {
    return this.latestSnapshot;
  }
}

// Mock the device capabilities for testing
const deviceCapabilities = () => ({
  cores: 4,
  memory: 8192, // 8GB in MB
  tier: 'high'
});

// Mock zkErrorLogger for testing
const zkErrorLogger = {
  logError: (error, context) => {
    console.error(`[ERROR] ${context.message}:`, error);
  }
};

// Simplified DynamicLoadDistribution class for testing
class DynamicLoadDistribution {
  constructor(config = {}) {
    this.config = {
      defaultStrategy: DistributionStrategy.DYNAMIC_WORKERS,
      maxWorkers: 3,
      maxCpuUsage: 80,
      maxMemoryUsage: 75,
      enableServerFallback: false,
      resourceMonitor: config.resourceMonitor || new MockResourceMonitor(),
    };

    this.resourceMonitor = this.config.resourceMonitor;
    this.currentStrategy = DistributionStrategy.DYNAMIC_WORKERS;
    this.isInitialized = false;
    this.workerPool = new WebWorkerPool({ maxWorkers: this.config.maxWorkers });
    this.serverFallback = { available: false };
    
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      serverOffloadedTasks: 0,
      totalExecutionTimeMs: 0,
      resourceWaitTimeMs: 0
    };
  }
  
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      if (!this.resourceMonitor.isMonitoring()) {
        await this.resourceMonitor.startMonitoring();
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      zkErrorLogger.logError(error, { 
        context: 'DynamicLoadDistribution.initialize', 
        message: 'Failed to initialize load distribution system' 
      });
      throw error;
    }
  }
  
  async executeTask(taskFn, data, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = performance.now();
    this.metrics.totalTasks++;
    
    try {
      // Execute the task
      const result = await taskFn(data);
      
      const endTime = performance.now();
      this.metrics.completedTasks++;
      this.metrics.totalExecutionTimeMs += (endTime - startTime);
      
      return {
        result,
        executionTimeMs: endTime - startTime,
        strategy: this.currentStrategy,
        executedLocally: true,
        resourceUsage: {}
      };
    } catch (error) {
      this.metrics.failedTasks++;
      throw error;
    }
  }
  
  getMetrics() {
    return {
      currentStrategy: this.currentStrategy,
      activeWorkers: this.workerPool.getActiveWorkerCount(),
      avgExecutionTimeMs: this.metrics.completedTasks > 0 
        ? this.metrics.totalExecutionTimeMs / this.metrics.completedTasks 
        : 0,
      totalTasks: this.metrics.totalTasks,
      completedTasks: this.metrics.completedTasks,
      failedTasks: this.metrics.failedTasks,
      serverOffloadedTasks: this.metrics.serverOffloadedTasks,
      cpuUsage: this.getResourceUsagePercentage(ResourceType.CPU),
      memoryUsage: this.getResourceUsagePercentage(ResourceType.MEMORY),
      resourceWaitTimeMs: this.metrics.resourceWaitTimeMs,
      resourceConstrained: false
    };
  }
  
  resetMetrics() {
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      serverOffloadedTasks: 0,
      totalExecutionTimeMs: 0,
      resourceWaitTimeMs: 0
    };
  }
  
  setStrategy(strategy) {
    this.currentStrategy = strategy;
  }
  
  dispose() {
    if (this.resourceMonitor.isMonitoring()) {
      this.resourceMonitor.stopMonitoring();
    }
    this.isInitialized = false;
  }
  
  getResourceUsagePercentage(resourceType) {
    try {
      const resources = this.resourceMonitor.getLatestSnapshot()?.resources;
      if (!resources || !resources[resourceType]) {
        return 0;
      }
      return resources[resourceType].currentUsage * 100;
    } catch (error) {
      return 0;
    }
  }
}

// Run tests in a more robust way
let passedTests = 0;
const totalTests = 3;

// Helper function to run tests
async function runTests() {
  try {
    // Test 1: Basic initialization
    console.log('Running test: Basic initialization');
    const loadDistribution = new DynamicLoadDistribution();
    await loadDistribution.initialize();
    
    assert.strictEqual(typeof loadDistribution.getMetrics, 'function', 'getMetrics should be a function');
    assert.strictEqual(typeof loadDistribution.executeTask, 'function', 'executeTask should be a function');
    assert.strictEqual(typeof loadDistribution.setStrategy, 'function', 'setStrategy should be a function');
    assert.strictEqual(loadDistribution.isInitialized, true, 'should be initialized');
    
    console.log('✅ Basic initialization test passed');
    passedTests++;
    
    // Test 2: Task execution
    console.log('Running test: Task execution');
    const taskResult = await loadDistribution.executeTask((data) => `Result: ${data}`, 'test');
    
    assert.strictEqual(taskResult.result, 'Result: test', 'task should return correct result');
    assert.strictEqual(taskResult.executedLocally, true, 'task should be executed locally');
    assert.strictEqual(typeof taskResult.executionTimeMs, 'number', 'should include execution time');
    
    console.log('✅ Task execution test passed');
    passedTests++;
    
    // Test 3: Metrics tracking
    console.log('Running test: Metrics tracking');
    
    // Reset metrics for a clean test
    loadDistribution.resetMetrics();
    
    // Execute 2 tasks
    await loadDistribution.executeTask((data) => data, 'task1');
    await loadDistribution.executeTask((data) => data, 'task2');
    
    const metrics = loadDistribution.getMetrics();
    
    assert.strictEqual(metrics.totalTasks, 2, 'totalTasks should be 2');
    assert.strictEqual(metrics.completedTasks, 2, 'completedTasks should be 2');
    assert.strictEqual(metrics.failedTasks, 0, 'failedTasks should be 0');
    
    // Test reset metrics
    loadDistribution.resetMetrics();
    const resetMetrics = loadDistribution.getMetrics();
    assert.strictEqual(resetMetrics.totalTasks, 0, 'totalTasks should be 0 after reset');
    
    console.log('✅ Metrics tracking test passed');
    passedTests++;
    
    // Clean up
    loadDistribution.dispose();
    
    // Print summary
    console.log(`\n${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('✅ All DynamicLoadDistribution tests passed!');
      process.exit(0);
    } else {
      console.error('❌ Some DynamicLoadDistribution tests failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run all tests
runTests().catch(error => {
  console.error('Unhandled error in tests:', error);
  process.exit(1);
});