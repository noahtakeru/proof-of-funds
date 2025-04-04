/**
 * benchmarkSuite.js - Performance benchmarking for ZK operations
 * 
 * This module provides a comprehensive benchmarking suite for ZK operations.
 * It measures performance metrics like execution time, throughput, and
 * establishes baselines for different device classes.
 * 
 * Version: 1.0.0
 */

import { getDeviceInfo } from './memoryProfiler.js';
import { PERFORMANCE_TARGETS, DEVICE_CLASSES } from './__tests__/testVectors.js';

/**
 * Benchmark result structure
 * @typedef {Object} BenchmarkResult
 * @property {string} operationId - Unique ID for the benchmark
 * @property {string} operationType - Type of operation benchmarked
 * @property {string} circuitType - Type of circuit used
 * @property {number} executionTime - Time taken in milliseconds
 * @property {Object} metrics - Additional performance metrics
 * @property {number} startTimestamp - Start time of benchmark
 * @property {number} endTimestamp - End time of benchmark
 * @property {Object} deviceInfo - Information about the device used
 * @property {string} status - Status of benchmark (success, warning, error)
 * @property {Object} comparisonResult - Comparison against targets
 */

// Registry to store benchmark results
const benchmarkResults = new Map();

/**
 * Create a new benchmark
 * @param {string} operationId - Unique ID for this benchmark
 * @param {Object} options - Benchmark options
 * @param {string} options.operationType - Type of operation (prove, verify, load)
 * @param {string} options.circuitType - Type of circuit (standard, threshold, maximum)
 * @param {Object} [options.customTargets] - Custom performance targets (if not using defaults)
 * @returns {Object} Benchmark object
 */
function createBenchmark(operationId, options = {}) {
  const benchmark = {
    operationId,
    operationType: options.operationType || 'unknown',
    circuitType: options.circuitType || 'unknown',
    customTargets: options.customTargets || null,
    startTime: null,
    endTime: null,
    checkpoints: new Map(),
    isRunning: false,
    
    /**
     * Start the benchmark
     * @returns {Object} This benchmark instance
     */
    start() {
      if (this.isRunning) {
        return this;
      }
      
      this.isRunning = true;
      this.startTime = performance.now();
      this.checkpoints.clear();
      
      // Record start checkpoint
      this.checkpoint('start');
      
      return this;
    },
    
    /**
     * Record a checkpoint within the benchmark
     * @param {string} name - Checkpoint name
     * @returns {Object} This benchmark instance
     */
    checkpoint(name) {
      if (!this.isRunning) {
        return this;
      }
      
      const time = performance.now();
      this.checkpoints.set(name, {
        time,
        elapsed: time - this.startTime
      });
      
      return this;
    },
    
    /**
     * End the benchmark and calculate results
     * @param {Object} [additionalMetrics] - Additional metrics to include in results
     * @returns {BenchmarkResult} Benchmark results
     */
    end(additionalMetrics = {}) {
      if (!this.isRunning) {
        return null;
      }
      
      this.isRunning = false;
      this.endTime = performance.now();
      
      // Record end checkpoint
      this.checkpoint('end');
      
      // Calculate execution time
      const executionTime = this.endTime - this.startTime;
      
      // Calculate checkpoint durations
      const checkpointDurations = {};
      let previousTime = this.startTime;
      
      // Sort checkpoints by time
      const sortedCheckpoints = Array.from(this.checkpoints.entries())
        .sort((a, b) => a[1].time - b[1].time);
      
      for (const [name, data] of sortedCheckpoints) {
        if (name === 'start') continue;
        
        checkpointDurations[name] = {
          fromStart: data.elapsed,
          fromPrevious: data.time - previousTime
        };
        
        previousTime = data.time;
      }
      
      // Get device info
      const deviceInfo = getDeviceInfo();
      
      // Compare against targets
      const comparisonResult = this._compareWithTargets(executionTime, deviceInfo);
      
      // Create result object
      const result = {
        operationId: this.operationId,
        operationType: this.operationType,
        circuitType: this.circuitType,
        executionTime,
        metrics: {
          ...additionalMetrics,
          checkpoints: checkpointDurations,
          operationsPerSecond: executionTime > 0 ? 1000 / executionTime : 0
        },
        startTimestamp: this.startTime,
        endTimestamp: this.endTime,
        deviceInfo,
        status: comparisonResult.status,
        comparisonResult
      };
      
      // Store in registry
      benchmarkResults.set(this.operationId, result);
      
      return result;
    },
    
    /**
     * Cancel the benchmark without calculating results
     */
    cancel() {
      if (!this.isRunning) {
        return;
      }
      
      this.isRunning = false;
      
      // Remove from registry if it was added
      if (benchmarkResults.has(this.operationId)) {
        benchmarkResults.delete(this.operationId);
      }
    },
    
    /**
     * Compare benchmark results with performance targets
     * @param {number} executionTime - Execution time in milliseconds
     * @param {Object} deviceInfo - Device information
     * @returns {Object} Comparison result
     * @private
     */
    _compareWithTargets(executionTime, deviceInfo) {
      // Determine device class (desktop, mobile, server)
      let deviceClass = 'desktop';
      
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        deviceClass = 'server';
      } else if (deviceInfo.isMobile) {
        deviceClass = 'mobile';
      }
      
      // Get appropriate targets (custom or default)
      const targets = this.customTargets || PERFORMANCE_TARGETS;
      const deviceTargets = targets[deviceClass] || targets.desktop;
      
      // Determine target value for this operation type
      let targetKey = '';
      
      if (this.operationType === 'prove') {
        targetKey = `${this.circuitType}ProofGeneration`;
      } else if (this.operationType === 'verify') {
        targetKey = 'proofVerification';
      } else if (this.operationType === 'load') {
        targetKey = 'circuitLoading';
      } else {
        targetKey = this.operationType;
      }
      
      const targetValue = deviceTargets[targetKey] || 5000; // Default to 5 seconds
      
      // Calculate percentage of target
      const percentageOfTarget = (executionTime / targetValue) * 100;
      
      // Determine status based on performance
      let status, message;
      
      if (executionTime <= targetValue) {
        if (executionTime <= targetValue * 0.5) {
          status = 'excellent';
          message = `Performance is excellent (${Math.round(executionTime)}ms vs ${targetValue}ms target)`;
        } else {
          status = 'good';
          message = `Performance is good (${Math.round(executionTime)}ms vs ${targetValue}ms target)`;
        }
      } else {
        if (executionTime <= targetValue * 1.5) {
          status = 'warning';
          message = `Performance is below target (${Math.round(executionTime)}ms vs ${targetValue}ms target)`;
        } else {
          status = 'poor';
          message = `Performance is poor (${Math.round(executionTime)}ms vs ${targetValue}ms target)`;
        }
      }
      
      return {
        status,
        message,
        executionTime,
        targetValue,
        percentageOfTarget,
        deviceClass,
        operationType: this.operationType,
        circuitType: this.circuitType
      };
    }
  };
  
  return benchmark;
}

/**
 * Get a stored benchmark result by ID
 * @param {string} operationId - ID of the benchmark to retrieve
 * @returns {BenchmarkResult|null} The benchmark result or null if not found
 */
function getBenchmarkResult(operationId) {
  return benchmarkResults.get(operationId) || null;
}

/**
 * Get all stored benchmark results
 * @returns {BenchmarkResult[]} Array of all benchmark results
 */
function getAllBenchmarkResults() {
  return Array.from(benchmarkResults.values());
}

/**
 * Clear all stored benchmark results
 */
function clearBenchmarkResults() {
  benchmarkResults.clear();
}

/**
 * Run a benchmarking function multiple times and collect statistics
 * @param {string} operationId - Unique ID for this benchmark
 * @param {Function} benchmarkFn - Async function to benchmark
 * @param {Object} options - Benchmark options
 * @param {string} options.operationType - Type of operation to benchmark
 * @param {string} options.circuitType - Type of circuit to benchmark
 * @param {number} [options.iterations=3] - Number of iterations to run
 * @param {number} [options.warmupRuns=1] - Number of warmup runs to perform
 * @returns {Promise<Object>} - Statistical results of benchmark
 */
async function runBenchmarkWithStats(operationId, benchmarkFn, options = {}) {
  const iterations = options.iterations || 3;
  const warmupRuns = options.warmupRuns || 1;
  
  // Perform warmup runs (not measured)
  for (let i = 0; i < warmupRuns; i++) {
    try {
      await benchmarkFn();
    } catch (error) {
      console.warn(`Warmup run ${i + 1} failed:`, error);
    }
  }
  
  // Collect results for actual benchmark runs
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const benchmark = createBenchmark(`${operationId}-iteration-${i + 1}`, {
      operationType: options.operationType,
      circuitType: options.circuitType
    });
    
    try {
      benchmark.start();
      await benchmarkFn();
      const result = benchmark.end();
      results.push(result);
    } catch (error) {
      console.error(`Benchmark iteration ${i + 1} failed:`, error);
      benchmark.cancel();
      // Continue with other iterations even if one fails
    }
  }
  
  // Calculate statistics
  if (results.length === 0) {
    return {
      operationId,
      status: 'error',
      message: 'All benchmark iterations failed',
      iterations: 0
    };
  }
  
  // Calculate average, min, max, median
  const executionTimes = results.map(r => r.executionTime);
  executionTimes.sort((a, b) => a - b);
  
  const sum = executionTimes.reduce((acc, time) => acc + time, 0);
  const average = sum / executionTimes.length;
  const min = executionTimes[0];
  const max = executionTimes[executionTimes.length - 1];
  const median = executionTimes[Math.floor(executionTimes.length / 2)];
  
  // Calculate standard deviation
  const squaredDiffs = executionTimes.map(time => Math.pow(time - average, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / squaredDiffs.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  
  // Use median result as the representative result
  const medianResultIndex = executionTimes.indexOf(median);
  const representativeResult = results[medianResultIndex];
  
  // Get device info
  const deviceInfo = getDeviceInfo();
  
  // Create statistical result
  const statsResult = {
    operationId,
    operationType: options.operationType,
    circuitType: options.circuitType,
    statistics: {
      iterations: results.length,
      average,
      median,
      min,
      max,
      stdDev,
      stdDevPercent: (stdDev / average) * 100
    },
    results: results,
    representativeResult,
    deviceInfo,
    status: representativeResult.status
  };
  
  // Store in registry with main operation ID
  benchmarkResults.set(operationId, statsResult);
  
  return statsResult;
}

/**
 * Generate performance recommendations based on benchmark results
 * @param {BenchmarkResult[]} results - Array of benchmark results to analyze
 * @returns {Object} Recommendations and insights
 */
function getPerformanceRecommendations(results) {
  if (!results || results.length === 0) {
    return { message: 'No benchmark results to analyze' };
  }
  
  // Group results by operation type
  const operationGroups = {};
  
  for (const result of results) {
    const { operationType, circuitType } = result;
    const key = `${operationType}-${circuitType}`;
    
    if (!operationGroups[key]) {
      operationGroups[key] = [];
    }
    
    operationGroups[key].push(result);
  }
  
  // Generate recommendations for each operation type
  const recommendations = {
    operations: [],
    generalRecommendations: [],
    performanceHotspots: []
  };
  
  for (const key in operationGroups) {
    const groupResults = operationGroups[key];
    const [operationType, circuitType] = key.split('-');
    
    // Calculate average execution time
    const executionTimes = groupResults.map(r => r.executionTime);
    const avgExecutionTime = executionTimes.reduce((acc, time) => acc + time, 0) / executionTimes.length;
    
    // Check results against targets
    const poorResults = groupResults.filter(r => r.status === 'poor');
    const warningResults = groupResults.filter(r => r.status === 'warning');
    const goodResults = groupResults.filter(r => r.status === 'good');
    
    const operationSummary = {
      operationType,
      circuitType,
      avgExecutionTime,
      sampleCount: groupResults.length,
      poorCount: poorResults.length,
      warningCount: warningResults.length,
      goodCount: goodResults.length
    };
    
    recommendations.operations.push(operationSummary);
    
    // Identify performance hotspots
    if (poorResults.length > 0) {
      recommendations.performanceHotspots.push({
        operation: `${operationType} on ${circuitType}`,
        avgExecutionTime,
        targetDevices: poorResults.map(r => r.deviceInfo.platform).join(', '),
        recommendation: `Optimize ${operationType} operation for ${circuitType} circuit to improve performance.`
      });
    }
  }
  
  // Sort operations by average execution time (highest first)
  recommendations.operations.sort((a, b) => b.avgExecutionTime - a.avgExecutionTime);
  
  // Generate general recommendations
  if (recommendations.performanceHotspots.length > 0) {
    recommendations.generalRecommendations.push(
      "Consider offloading heavy operations to server-side for low-power devices."
    );
  }
  
  // Add recommendations for Web Workers if appropriate
  const hasSlowOperations = recommendations.operations.some(op => op.avgExecutionTime > 5000);
  if (hasSlowOperations) {
    recommendations.generalRecommendations.push(
      "Use Web Workers for time-consuming operations to prevent UI freezing."
    );
  }
  
  // Check if there's high variability in results
  const highVariabilityOps = recommendations.operations.filter(op => {
    const results = operationGroups[`${op.operationType}-${op.circuitType}`];
    const times = results.map(r => r.executionTime);
    const avg = times.reduce((acc, t) => acc + t, 0) / times.length;
    const maxDiff = Math.max(...times) - Math.min(...times);
    return (maxDiff / avg) > 0.5; // More than 50% variation
  });
  
  if (highVariabilityOps.length > 0) {
    recommendations.generalRecommendations.push(
      "Implement more consistent memory management to reduce performance variability."
    );
  }
  
  return recommendations;
}

export {
  createBenchmark,
  getBenchmarkResult,
  getAllBenchmarkResults,
  clearBenchmarkResults,
  runBenchmarkWithStats,
  getPerformanceRecommendations
};

export default {
  createBenchmark,
  getBenchmarkResult,
  getAllBenchmarkResults,
  clearBenchmarkResults,
  runBenchmarkWithStats,
  getPerformanceRecommendations
};