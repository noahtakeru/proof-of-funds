/**
 * LoadTester.js
 * 
 * A comprehensive framework for performance and load testing the ZK infrastructure.
 * This framework is designed to test the system's behavior under high load conditions,
 * resource constraints, and concurrency to ensure it remains stable and responsive.
 * 
 * This framework is designed to:
 * 1. Test system behavior under high load
 * 2. Simulate resource constraints
 * 3. Measure performance under concurrency
 * 4. Test long-running stability
 */

import { zkErrorLogger } from '../../zkErrorLogger.mjs';
import { ZKError, SystemError, InputError, NetworkError, ErrorCode } from '../../zkErrorHandler.mjs';

/**
 * Performance test result
 * @typedef {Object} TestResult
 * @property {string} name - Test name
 * @property {string} description - Test description
 * @property {number} startTime - Test start timestamp
 * @property {number} endTime - Test end timestamp
 * @property {number} duration - Test duration in ms
 * @property {number} totalOperations - Total operations executed
 * @property {number} successfulOperations - Successful operations count
 * @property {number} failedOperations - Failed operations count
 * @property {number} throughput - Operations per second
 * @property {number} averageLatency - Average operation latency in ms
 * @property {number} p50Latency - 50th percentile latency in ms
 * @property {number} p90Latency - 90th percentile latency in ms
 * @property {number} p95Latency - 95th percentile latency in ms
 * @property {number} p99Latency - 99th percentile latency in ms
 * @property {number} minLatency - Minimum latency in ms
 * @property {number} maxLatency - Maximum latency in ms
 * @property {Array} errors - Operation errors
 * @property {Object} metrics - Additional metrics
 */

/**
 * Load testing framework
 * @class
 */
class LoadTester {
  /**
   * Create a new load test
   * @param {Object} config - Test configuration
   * @param {string} config.name - Test name
   * @param {string} config.description - Test description
   * @param {Object} config.target - Target system to test
   * @param {Object} config.components - Components to use for testing
   * @param {Function} config.setup - Setup function (returns test context)
   * @param {Function} config.teardown - Teardown function
   * @param {Object} config.options - Test options
   */
  constructor({ name, description, target, components = {}, setup, teardown, options = {} }) {
    this.name = name;
    this.description = description;
    this.target = target;
    this.components = components;
    this.setup = setup || (() => ({}));
    this.teardown = teardown || (() => {});
    
    // Test options with defaults
    this.options = {
      concurrency: 1,               // Concurrent operations
      rampUp: 0,                    // Ramp-up period in ms
      duration: 10000,              // Test duration in ms
      operationsPerSecond: 10,      // Target operations per second
      maxOperations: Infinity,      // Maximum total operations
      timeout: 30000,               // Operation timeout in ms
      delay: 0,                     // Delay between operations in ms
      iterativeStep: false,         // Increase load during test
      stepDuration: 5000,           // Duration of each step in ms
      stepIncrease: 2,              // Factor to increase load by each step
      collectMemoryStats: true,     // Collect memory usage statistics
      collectCPUStats: false,       // Collect CPU usage statistics
      ...options
    };
    
    // Results tracking
    this.results = null;
    
    // Operation tracking for active test
    this.operations = [];
    this.activeWorkers = 0;
    this.completedOperations = 0;
    this.successfulOperations = 0;
    this.failedOperations = 0;
    this.testStartTime = 0;
    this.testEndTime = 0;
    this.shouldStop = false;
    
    // Memory tracking
    this.memoryStats = [];
    this.cpuStats = [];
    
    // Bind methods
    this.run = this.run.bind(this);
    this._executeOperations = this._executeOperations.bind(this);
    this._executeOperation = this._executeOperation.bind(this);
    this._trackMemoryUsage = this._trackMemoryUsage.bind(this);
    this._calculateResults = this._calculateResults.bind(this);
  }

  /**
   * Run the load test
   * @param {Function} operationFn - Function to execute for each operation
   * @returns {Promise<TestResult>} - Test results
   */
  async run(operationFn) {
    if (typeof operationFn !== 'function') {
      throw new InputError('Operation function is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        category: 'PERFORMANCE',
        operationId: `load_test_run_${Date.now()}`,
        recoverable: false,
        userFixable: true,
        details: { 
          testName: this.name,
          receivedType: typeof operationFn
        }
      });
    }
    
    console.log(`\n🚀 Starting load test: ${this.name}`);
    console.log(`Description: ${this.description}`);
    console.log(`\nTest Parameters:`);
    console.log(`- Concurrency: ${this.options.concurrency}`);
    console.log(`- Ramp-up: ${this.options.rampUp}ms`);
    console.log(`- Duration: ${this.options.duration}ms`);
    console.log(`- Target Rate: ${this.options.operationsPerSecond} ops/sec`);
    if (this.options.iterativeStep) {
      console.log(`- Iterative Steps: Yes, every ${this.options.stepDuration}ms with ${this.options.stepIncrease}x increase`);
    }
    
    // Reset state
    this.operations = [];
    this.activeWorkers = 0;
    this.completedOperations = 0;
    this.successfulOperations = 0;
    this.failedOperations = 0;
    this.testStartTime = Date.now();
    this.testEndTime = 0;
    this.shouldStop = false;
    this.memoryStats = [];
    this.cpuStats = [];
    
    let context;
    try {
      // Setup test environment
      console.log(`\n📋 Setting up test environment...`);
      context = await this.setup();
      console.log(`✅ Setup complete`);
    } catch (error) {
      const setupError = error instanceof ZKError ? error : new SystemError(`Setup failed: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        category: 'PERFORMANCE',
        operationId: `load_test_setup_${Date.now()}`,
        recoverable: false,
        details: { testName: this.name }
      });
      console.error(`❌ Setup failed: ${setupError.message}`);
      zkErrorLogger.logError(setupError);
      
      // Create minimal results object
      this.results = {
        name: this.name,
        description: this.description,
        startTime: this.testStartTime,
        endTime: Date.now(),
        duration: Date.now() - this.testStartTime,
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        throughput: 0,
        averageLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p50Latency: 0,
        p90Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errors: [setupError],
        metrics: {
          setupFailed: true
        }
      };
      
      return this.results;
    }
    
    // Start memory tracking if enabled
    let memoryTrackingInterval;
    if (this.options.collectMemoryStats && global.gc && global.process && process.memoryUsage) {
      memoryTrackingInterval = setInterval(this._trackMemoryUsage, 1000);
    }
    
    // Execute operations
    await this._executeOperations(operationFn, context);
    
    // Stop memory tracking
    if (memoryTrackingInterval) {
      clearInterval(memoryTrackingInterval);
    }
    
    // Run teardown
    try {
      console.log(`\n📋 Tearing down test environment...`);
      await this.teardown(context);
      console.log(`✅ Teardown complete`);
    } catch (error) {
      const teardownError = error instanceof ZKError ? error : new SystemError(`Teardown failed: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        category: 'PERFORMANCE',
        operationId: `load_test_teardown_${Date.now()}`,
        recoverable: true,
        details: { testName: this.name }
      });
      console.error(`❌ Teardown failed: ${teardownError.message}`);
      zkErrorLogger.logError(teardownError);
    }
    
    // Calculate test results
    this.testEndTime = Date.now();
    this.results = this._calculateResults();
    
    // Print summary
    this._printResults();
    
    return this.results;
  }

  /**
   * Execute operations at the specified rate
   * @param {Function} operationFn - Operation function
   * @param {Object} context - Test context
   * @private
   */
  async _executeOperations(operationFn, context) {
    const startTime = Date.now();
    const endTime = startTime + this.options.duration;
    let currentConcurrency = this.options.iterativeStep ? 1 : this.options.concurrency;
    let currentOpsPerSecond = this.options.iterativeStep ? 
      this.options.operationsPerSecond / this.options.stepIncrease : 
      this.options.operationsPerSecond;
    
    let lastStepTime = startTime;
    let step = 0;
    
    console.log(`\n⏱️ Starting test execution for ${this.options.duration}ms...`);
    
    // Calculate initial delay between operations
    let operationDelay = this.options.delay || Math.max(0, 1000 / currentOpsPerSecond - 10); // 10ms buffer for execution
    
    // Run until duration is reached or max operations hit
    while (Date.now() < endTime && this.completedOperations < this.options.maxOperations) {
      // Check if we need to update load parameters for iterative step
      if (this.options.iterativeStep && 
          Date.now() - lastStepTime >= this.options.stepDuration) {
        step++;
        lastStepTime = Date.now();
        
        // Increase concurrency and ops/sec by step factor
        currentConcurrency = Math.min(
          this.options.concurrency * Math.pow(this.options.stepIncrease, step),
          this.options.concurrency * 10 // Cap at 10x initial
        );
        
        currentOpsPerSecond = Math.min(
          this.options.operationsPerSecond * Math.pow(this.options.stepIncrease, step),
          this.options.operationsPerSecond * 10 // Cap at 10x initial
        );
        
        // Recalculate delay
        operationDelay = Math.max(0, 1000 / currentOpsPerSecond - 10);
        
        console.log(`\n📈 Step ${step}: Increasing load to ${currentConcurrency} concurrent workers at ${currentOpsPerSecond.toFixed(2)} ops/sec`);
      }
      
      // Start new operations if we have capacity
      while (this.activeWorkers < currentConcurrency && 
             Date.now() < endTime && 
             this.completedOperations < this.options.maxOperations) {
        this._executeOperation(operationFn, context);
        
        // Apply ramp-up delay if in ramp-up period
        const elapsedTime = Date.now() - startTime;
        if (this.options.rampUp > 0 && elapsedTime < this.options.rampUp) {
          await new Promise(resolve => setTimeout(resolve, this.options.rampUp / currentConcurrency));
        } else {
          // Apply regular delay between operations
          await new Promise(resolve => setTimeout(resolve, operationDelay));
        }
      }
      
      // Small delay to prevent CPU spinning
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Print periodic status
      if (this.completedOperations % 50 === 0 && this.completedOperations > 0) {
        this._printStatus();
      }
    }
    
    // Wait for all active operations to complete
    console.log(`\n⏳ Waiting for ${this.activeWorkers} active operations to complete...`);
    
    while (this.activeWorkers > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✅ All operations completed.`);
  }

  /**
   * Execute a single operation
   * @param {Function} operationFn - Operation function
   * @param {Object} context - Test context
   * @private
   */
  _executeOperation(operationFn, context) {
    this.activeWorkers++;
    
    const operationId = this.operations.length;
    const operation = {
      id: operationId,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      success: false,
      error: null
    };
    
    this.operations.push(operation);
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new NetworkError(`Operation timed out after ${this.options.timeout}ms`, {
        code: ErrorCode.NETWORK_TIMEOUT,
        operationId: `operation_${operationId}_timeout_${Date.now()}`,
        category: 'PERFORMANCE',
        recoverable: true,
        details: {
          testName: this.name,
          operationId,
          timeout: this.options.timeout
        }
      })), this.options.timeout);
    });
    
    // Create operation promise
    const operationPromise = Promise.resolve().then(() => {
      return operationFn(context, operationId);
    });
    
    // Execute operation with timeout
    Promise.race([operationPromise, timeoutPromise])
      .then(() => {
        operation.success = true;
        this.successfulOperations++;
      })
      .catch(error => {
        operation.success = false;
        operation.error = error;
        this.failedOperations++;
        
        // Convert to ZKError if not already and log
        const operationError = error instanceof ZKError ? error : new SystemError(`Operation execution failed: ${error.message}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          category: 'PERFORMANCE',
          operationId: `operation_${operationId}_error_${Date.now()}`,
          recoverable: true,
          details: {
            testName: this.name,
            operationId,
            originalError: error.message
          }
        });
        zkErrorLogger.logError(operationError);
      })
      .finally(() => {
        operation.endTime = Date.now();
        operation.duration = operation.endTime - operation.startTime;
        this.completedOperations++;
        this.activeWorkers--;
      });
  }

  /**
   * Track memory usage
   * @private
   */
  _trackMemoryUsage() {
    if (global.gc) {
      try {
        // Force garbage collection to get more accurate memory usage
        global.gc();
      } catch (e) {
        // Ignore errors
      }
    }
    
    if (process.memoryUsage) {
      try {
        const memoryUsage = process.memoryUsage();
        
        this.memoryStats.push({
          timestamp: Date.now(),
          rss: memoryUsage.rss, // Resident Set Size - total memory allocated
          heapTotal: memoryUsage.heapTotal, // Total size of the allocated heap
          heapUsed: memoryUsage.heapUsed, // Actual memory used during execution
          external: memoryUsage.external, // Memory used by C++ objects bound to JavaScript
          completedOperations: this.completedOperations
        });
      } catch (e) {
        // Ignore errors
      }
    }
  }

  /**
   * Calculate test results
   * @returns {TestResult} - Test results
   * @private
   */
  _calculateResults() {
    const completedOperations = this.operations.filter(op => op.endTime !== null);
    const successfulOperations = completedOperations.filter(op => op.success);
    const latencies = completedOperations.map(op => op.duration).sort((a, b) => a - b);
    
    const totalDuration = this.testEndTime - this.testStartTime;
    const throughput = completedOperations.length / (totalDuration / 1000);
    
    // Calculate latency percentiles
    const p50Index = Math.floor(latencies.length * 0.5);
    const p90Index = Math.floor(latencies.length * 0.9);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    
    const p50Latency = latencies.length > 0 ? latencies[p50Index] : 0;
    const p90Latency = latencies.length > 0 ? latencies[p90Index] : 0;
    const p95Latency = latencies.length > 0 ? latencies[p95Index] : 0;
    const p99Latency = latencies.length > 0 ? latencies[p99Index] : 0;
    
    const minLatency = latencies.length > 0 ? latencies[0] : 0;
    const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
    const averageLatency = latencies.length > 0 ? 
      latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length : 0;
    
    // Calculate memory metrics if available
    let memoryMetrics = {};
    if (this.memoryStats.length > 0) {
      const initialMemory = this.memoryStats[0];
      const peakMemory = [...this.memoryStats].sort((a, b) => b.heapUsed - a.heapUsed)[0];
      const finalMemory = this.memoryStats[this.memoryStats.length - 1];
      
      memoryMetrics = {
        initialHeapUsed: initialMemory.heapUsed,
        peakHeapUsed: peakMemory.heapUsed,
        finalHeapUsed: finalMemory.heapUsed,
        initialRSS: initialMemory.rss,
        peakRSS: [...this.memoryStats].sort((a, b) => b.rss - a.rss)[0].rss,
        finalRSS: finalMemory.rss,
        memoryGrowth: finalMemory.heapUsed - initialMemory.heapUsed,
        memoryGrowthPercent: ((finalMemory.heapUsed / initialMemory.heapUsed) - 1) * 100,
        memoryUsagePerOperation: finalMemory.heapUsed / Math.max(1, this.completedOperations)
      };
    }
    
    // Collect errors
    const errors = this.operations
      .filter(op => op.error)
      .map(op => ({
        operationId: op.id,
        message: op.error.message,
        stack: op.error.stack
      }));
    
    return {
      name: this.name,
      description: this.description,
      startTime: this.testStartTime,
      endTime: this.testEndTime,
      duration: totalDuration,
      totalOperations: this.completedOperations,
      successfulOperations: this.successfulOperations,
      failedOperations: this.failedOperations,
      throughput,
      averageLatency,
      p50Latency,
      p90Latency,
      p95Latency,
      p99Latency,
      minLatency,
      maxLatency,
      errors,
      metrics: {
        successRate: (this.successfulOperations / Math.max(1, this.completedOperations)) * 100,
        concurrency: this.options.concurrency,
        targetOpsPerSecond: this.options.operationsPerSecond,
        actualOpsPerSecond: throughput,
        ...memoryMetrics
      }
    };
  }

  /**
   * Print test status
   * @private
   */
  _printStatus() {
    const elapsedSeconds = (Date.now() - this.testStartTime) / 1000;
    const currentThroughput = this.completedOperations / elapsedSeconds;
    
    console.log(`Operations: ${this.completedOperations} completed (${this.successfulOperations} success, ${this.failedOperations} failed), ${this.activeWorkers} active`);
    console.log(`Current throughput: ${currentThroughput.toFixed(2)} ops/sec`);
  }

  /**
   * Print test results
   * @private
   */
  _printResults() {
    if (!this.results) return;
    
    console.log(`\n📊 Test Results for: ${this.name}`);
    console.log(`Duration: ${(this.results.duration / 1000).toFixed(2)} seconds`);
    console.log(`Total Operations: ${this.results.totalOperations}`);
    console.log(`Successful Operations: ${this.results.successfulOperations}`);
    console.log(`Failed Operations: ${this.results.failedOperations}`);
    console.log(`Success Rate: ${this.results.metrics.successRate.toFixed(2)}%`);
    console.log(`Throughput: ${this.results.throughput.toFixed(2)} ops/sec`);
    console.log(`\nLatency Statistics:`);
    console.log(`- Average: ${this.results.averageLatency.toFixed(2)} ms`);
    console.log(`- Min: ${this.results.minLatency.toFixed(2)} ms`);
    console.log(`- Max: ${this.results.maxLatency.toFixed(2)} ms`);
    console.log(`- P50: ${this.results.p50Latency.toFixed(2)} ms`);
    console.log(`- P90: ${this.results.p90Latency.toFixed(2)} ms`);
    console.log(`- P95: ${this.results.p95Latency.toFixed(2)} ms`);
    console.log(`- P99: ${this.results.p99Latency.toFixed(2)} ms`);
    
    if (this.memoryStats.length > 0) {
      console.log(`\nMemory Statistics:`);
      console.log(`- Initial Heap: ${(this.results.metrics.initialHeapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Peak Heap: ${(this.results.metrics.peakHeapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Final Heap: ${(this.results.metrics.finalHeapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Memory Growth: ${(this.results.metrics.memoryGrowth / 1024 / 1024).toFixed(2)} MB (${this.results.metrics.memoryGrowthPercent.toFixed(2)}%)`);
    }
    
    if (this.results.errors.length > 0) {
      console.log(`\nErrors: ${this.results.errors.length}`);
      console.log(`Top error types:`);
      
      // Group errors by message
      const errorTypes = this.results.errors.reduce((types, error) => {
        const message = error.message;
        types[message] = (types[message] || 0) + 1;
        return types;
      }, {});
      
      // Display top 3 error types
      Object.entries(errorTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([message, count]) => {
          console.log(`- "${message}" (${count} occurrences)`);
        });
    }
  }

  /**
   * Generate a detailed HTML report
   * @returns {string} HTML report
   */
  generateReport() {
    if (!this.results) {
      return 'No results available. Run the test first.';
    }
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Load Test Report: ${this.results.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1, h2, h3, h4 { color: #222; }
          .header { margin-bottom: 20px; }
          .summary { margin-bottom: 30px; background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
          .metrics { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px; }
          .metric-card { 
            background-color: #fff;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            min-width: 200px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .metric-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
          .metric-name { color: #666; }
          .latency-chart { margin: 20px 0; height: 300px; }
          .error-section { margin-top: 30px; }
          .error { padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .chart-container { margin-top: 30px; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <div class="header">
          <h1>Load Test Report</h1>
          <h2>${this.results.name}</h2>
          <p>${this.results.description}</p>
          <p><strong>Date:</strong> ${new Date(this.results.startTime).toLocaleString()}</p>
          <p><strong>Duration:</strong> ${(this.results.duration / 1000).toFixed(2)} seconds</p>
        </div>
        
        <div class="summary">
          <h2>Summary</h2>
          <p><strong>Total Operations:</strong> ${this.results.totalOperations}</p>
          <p><strong>Successful Operations:</strong> ${this.results.successfulOperations}</p>
          <p><strong>Failed Operations:</strong> ${this.results.failedOperations}</p>
          <p><strong>Success Rate:</strong> ${this.results.metrics.successRate.toFixed(2)}%</p>
          <p><strong>Throughput:</strong> ${this.results.throughput.toFixed(2)} ops/sec</p>
        </div>
        
        <h2>Performance Metrics</h2>
        <div class="metrics">
          <div class="metric-card">
            <div class="metric-name">Average Latency</div>
            <div class="metric-value">${this.results.averageLatency.toFixed(2)} ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">P50 Latency</div>
            <div class="metric-value">${this.results.p50Latency.toFixed(2)} ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">P90 Latency</div>
            <div class="metric-value">${this.results.p90Latency.toFixed(2)} ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">P95 Latency</div>
            <div class="metric-value">${this.results.p95Latency.toFixed(2)} ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">P99 Latency</div>
            <div class="metric-value">${this.results.p99Latency.toFixed(2)} ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">Min Latency</div>
            <div class="metric-value">${this.results.minLatency.toFixed(2)} ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">Max Latency</div>
            <div class="metric-value">${this.results.maxLatency.toFixed(2)} ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">Concurrency</div>
            <div class="metric-value">${this.options.concurrency}</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">Target Rate</div>
            <div class="metric-value">${this.options.operationsPerSecond.toFixed(2)} ops/sec</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">Actual Rate</div>
            <div class="metric-value">${this.results.throughput.toFixed(2)} ops/sec</div>
          </div>
        </div>
    `;
    
    // Add memory metrics if available
    if (this.memoryStats.length > 0) {
      html += `
        <h2>Memory Metrics</h2>
        <div class="metrics">
          <div class="metric-card">
            <div class="metric-name">Initial Heap</div>
            <div class="metric-value">${(this.results.metrics.initialHeapUsed / 1024 / 1024).toFixed(2)} MB</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">Peak Heap</div>
            <div class="metric-value">${(this.results.metrics.peakHeapUsed / 1024 / 1024).toFixed(2)} MB</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">Final Heap</div>
            <div class="metric-value">${(this.results.metrics.finalHeapUsed / 1024 / 1024).toFixed(2)} MB</div>
          </div>
          <div class="metric-card">
            <div class="metric-name">Memory Growth</div>
            <div class="metric-value">${(this.results.metrics.memoryGrowth / 1024 / 1024).toFixed(2)} MB</div>
            <div>${this.results.metrics.memoryGrowthPercent.toFixed(2)}%</div>
          </div>
        </div>
        
        <div class="chart-container">
          <h3>Memory Usage Over Time</h3>
          <canvas id="memoryChart"></canvas>
        </div>
        
        <script>
          new Chart(document.getElementById('memoryChart'), {
            type: 'line',
            data: {
              labels: ${JSON.stringify(this.memoryStats.map(stat => 
                Math.round((stat.timestamp - this.results.startTime) / 1000)))},
              datasets: [{
                label: 'Heap Used (MB)',
                data: ${JSON.stringify(this.memoryStats.map(stat => 
                  (stat.heapUsed / 1024 / 1024).toFixed(2)))},
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
              }, {
                label: 'RSS (MB)',
                data: ${JSON.stringify(this.memoryStats.map(stat => 
                  (stat.rss / 1024 / 1024).toFixed(2)))},
                borderColor: 'rgb(153, 102, 255)',
                tension: 0.1
              }]
            },
            options: {
              scales: {
                x: {
                  title: {
                    display: true,
                    text: 'Time (seconds)'
                  }
                },
                y: {
                  title: {
                    display: true,
                    text: 'Memory (MB)'
                  }
                }
              }
            }
          });
        </script>
      `;
    }
    
    // Add latency distribution chart
    html += `
      <div class="chart-container">
        <h3>Latency Distribution</h3>
        <canvas id="latencyChart"></canvas>
      </div>
      
      <script>
        new Chart(document.getElementById('latencyChart'), {
          type: 'bar',
          data: {
            labels: ['p0', 'p50', 'p90', 'p95', 'p99', 'p100'],
            datasets: [{
              label: 'Latency (ms)',
              data: [
                ${this.results.minLatency.toFixed(2)},
                ${this.results.p50Latency.toFixed(2)},
                ${this.results.p90Latency.toFixed(2)},
                ${this.results.p95Latency.toFixed(2)},
                ${this.results.p99Latency.toFixed(2)},
                ${this.results.maxLatency.toFixed(2)}
              ],
              backgroundColor: [
                'rgba(75, 192, 192, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(255, 205, 86, 0.2)',
                'rgba(255, 159, 64, 0.2)',
                'rgba(255, 99, 132, 0.2)',
                'rgba(255, 99, 132, 0.2)'
              ],
              borderColor: [
                'rgb(75, 192, 192)',
                'rgb(75, 192, 192)',
                'rgb(255, 205, 86)',
                'rgb(255, 159, 64)',
                'rgb(255, 99, 132)',
                'rgb(255, 99, 132)'
              ],
              borderWidth: 1
            }]
          },
          options: {
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Latency (ms)'
                }
              }
            }
          }
        });
      </script>
    `;
    
    // Add error details if there are any
    if (this.results.errors.length > 0) {
      // Group errors by message
      const errorTypes = this.results.errors.reduce((types, error) => {
        const message = error.message;
        types[message] = (types[message] || 0) + 1;
        return types;
      }, {});
      
      // Create error type table
      html += `
        <h2>Errors</h2>
        <p>Total Errors: ${this.results.errors.length}</p>
        
        <h3>Error Types</h3>
        <table>
          <tr>
            <th>Error Message</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
      `;
      
      Object.entries(errorTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([message, count]) => {
          const percentage = (count / this.results.errors.length * 100).toFixed(2);
          html += `
            <tr>
              <td>${message}</td>
              <td>${count}</td>
              <td>${percentage}%</td>
            </tr>
          `;
        });
      
      html += '</table>';
      
      // Add chart for error distribution
      html += `
        <div class="chart-container">
          <h3>Error Distribution</h3>
          <canvas id="errorChart"></canvas>
        </div>
        
        <script>
          new Chart(document.getElementById('errorChart'), {
            type: 'pie',
            data: {
              labels: ${JSON.stringify(Object.keys(errorTypes))},
              datasets: [{
                data: ${JSON.stringify(Object.values(errorTypes))},
                backgroundColor: [
                  'rgba(255, 99, 132, 0.2)',
                  'rgba(255, 159, 64, 0.2)',
                  'rgba(255, 205, 86, 0.2)',
                  'rgba(75, 192, 192, 0.2)',
                  'rgba(54, 162, 235, 0.2)',
                  'rgba(153, 102, 255, 0.2)'
                ],
                borderColor: [
                  'rgb(255, 99, 132)',
                  'rgb(255, 159, 64)',
                  'rgb(255, 205, 86)',
                  'rgb(75, 192, 192)',
                  'rgb(54, 162, 235)',
                  'rgb(153, 102, 255)'
                ],
                borderWidth: 1
              }]
            }
          });
        </script>
      `;
    }
    
    html += `
      </body>
      </html>
    `;
    
    return html;
  }
}

/**
 * Creates a proof generation load test
 * @param {Object} options - Test options
 * @returns {LoadTester} - Configured test
 */
function createProofGenerationLoadTest(options = {}) {
  const {
    name = 'Proof Generation Load Test',
    description = 'Tests the performance of ZK proof generation under load',
    components = {},
    concurrency = 5,
    duration = 30000,
    operationsPerSecond = 5,
    proofType = 'standard'
  } = options;
  
  // Create test instance
  const test = new LoadTester({
    name,
    description,
    components,
    options: {
      concurrency,
      duration,
      operationsPerSecond,
      collectMemoryStats: true
    },
    setup: async () => {
      // Prepare test data
      const testData = [];
      
      // Create test wallets
      for (let i = 0; i < concurrency; i++) {
        testData.push({
          walletAddress: `0x${i.toString(16).padStart(40, '0')}`,
          amount: '1000000000000000000', // 1 ETH
          tokenAddress: '0x0000000000000000000000000000000000000000',
          chainId: 1,
          nonce: i.toString()
        });
      }
      
      return {
        testData,
        proofType
      };
    }
  });
  
  return test;
}

/**
 * Creates a proof verification load test
 * @param {Object} options - Test options
 * @returns {LoadTester} - Configured test
 */
function createProofVerificationLoadTest(options = {}) {
  const {
    name = 'Proof Verification Load Test',
    description = 'Tests the performance of ZK proof verification under load',
    components = {},
    concurrency = 10,
    duration = 30000,
    operationsPerSecond = 20,
    proofType = 'standard'
  } = options;
  
  // Create test instance
  const test = new LoadTester({
    name,
    description,
    components,
    options: {
      concurrency,
      duration,
      operationsPerSecond,
      collectMemoryStats: true
    },
    setup: async () => {
      if (!components.zkProofGenerator || !components.zkUtils) {
        throw new InputError('zkProofGenerator and zkUtils components are required for this test', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          category: 'PERFORMANCE',
          operationId: `verification_load_test_setup_${Date.now()}`,
          recoverable: false,
          userFixable: true,
          details: {
            missingComponents: {
              zkProofGenerator: !components.zkProofGenerator,
              zkUtils: !components.zkUtils
            }
          }
        });
      }
      
      // Generate proofs to verify
      const proofs = [];
      
      for (let i = 0; i < Math.min(concurrency, 5); i++) {
        const inputs = {
          walletAddress: `0x${i.toString(16).padStart(40, '0')}`,
          amount: '1000000000000000000',
          tokenAddress: '0x0000000000000000000000000000000000000000',
          chainId: 1,
          nonce: i.toString()
        };
        
        const { proof, publicSignals } = await components.zkProofGenerator.generateProof(proofType, inputs);
        
        proofs.push({ proof, publicSignals });
      }
      
      return {
        proofs,
        proofType
      };
    }
  });
  
  return test;
}

export { LoadTester, createProofGenerationLoadTest, createProofVerificationLoadTest };
export default LoadTester;