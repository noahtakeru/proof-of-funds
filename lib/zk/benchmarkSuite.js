/**
 * benchmarkSuite.js
 * 
 * Utilities for benchmarking performance of ZK operations.
 */

// Benchmark types
export const BenchmarkType = {
  PROOF_GENERATION: 'prove',
  PROOF_VERIFICATION: 'verify',
  CIRCUIT_LOADING: 'circuit_load',
  WASM_EXECUTION: 'wasm_execution',
  JSON_PROCESSING: 'json_processing'
};

// Create collection for benchmark results
const benchmarkResults = new Map();
let nextBenchmarkId = 1;

/**
 * Create a benchmark object for measuring performance
 * 
 * @param {string} name - Name of the benchmark
 * @param {Object} options - Benchmark options
 * @param {string} options.operationType - Type of operation (from BenchmarkType)
 * @param {string} options.circuitType - Type of circuit (standard, threshold, maximum)
 * @param {Object} options.customParams - Additional custom parameters
 * @returns {Object} Benchmark object with start/end methods
 */
export function createBenchmark(name, options = {}) {
  // Generate a unique ID for this benchmark
  const benchmarkId = `${name}-${nextBenchmarkId++}`;
  
  // Initialize benchmark metadata
  const benchmarkData = {
    id: benchmarkId,
    name,
    operationType: options.operationType || BenchmarkType.PROOF_GENERATION,
    circuitType: options.circuitType || 'unknown',
    startTime: 0,
    endTime: 0,
    executionTime: 0,
    cpuTime: 0,
    customParams: options.customParams || {},
    metadata: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
      platform: typeof navigator !== 'undefined' ? navigator.platform : process.platform,
      timestamp: Date.now()
    }
  };
  
  // Create methods for the benchmark object
  return {
    /**
     * Start the benchmark
     */
    start: () => {
      // Record start time
      benchmarkData.startTime = performance.now();
      
      // Record CPU time if available (Node.js only)
      if (typeof process !== 'undefined' && typeof process.cpuUsage === 'function') {
        benchmarkData.startCpuUsage = process.cpuUsage();
      }
      
      return benchmarkData;
    },
    
    /**
     * End the benchmark and return results
     * 
     * @param {Object} additionalData - Additional data to include in results
     * @returns {Object} Benchmark results
     */
    end: (additionalData = {}) => {
      // Record end time
      benchmarkData.endTime = performance.now();
      benchmarkData.executionTime = benchmarkData.endTime - benchmarkData.startTime;
      
      // Record CPU time if available (Node.js only)
      if (typeof process !== 'undefined' && typeof process.cpuUsage === 'function' && benchmarkData.startCpuUsage) {
        const endCpuUsage = process.cpuUsage(benchmarkData.startCpuUsage);
        benchmarkData.cpuTime = (endCpuUsage.user + endCpuUsage.system) / 1000; // Convert to milliseconds
      }
      
      // Add any additional data
      benchmarkData.additionalData = additionalData;
      
      // Store benchmark results
      benchmarkResults.set(benchmarkId, benchmarkData);
      
      return benchmarkData;
    },
    
    /**
     * Get the benchmark ID
     * 
     * @returns {string} Benchmark ID
     */
    getId: () => benchmarkId
  };
}

/**
 * Get benchmark results
 * 
 * @param {string} benchmarkId - ID of the benchmark (optional)
 * @returns {Object|Array} Benchmark results
 */
export function getBenchmarkResults(benchmarkId) {
  if (benchmarkId) {
    return benchmarkResults.get(benchmarkId);
  }
  
  // Return all results as an array
  return Array.from(benchmarkResults.values());
}

/**
 * Clear all benchmark results
 */
export function clearBenchmarkResults() {
  benchmarkResults.clear();
}

/**
 * Compare two benchmark results
 * 
 * @param {string} baseline - ID of baseline benchmark
 * @param {string} current - ID of current benchmark
 * @returns {Object} Comparison results
 */
export function compareBenchmarks(baseline, current) {
  const baselineResult = benchmarkResults.get(baseline);
  const currentResult = benchmarkResults.get(current);
  
  if (!baselineResult || !currentResult) {
    throw new Error('Benchmark results not found');
  }
  
  const executionTimeDiff = currentResult.executionTime - baselineResult.executionTime;
  const executionTimePercent = (executionTimeDiff / baselineResult.executionTime) * 100;
  
  let cpuTimeDiff = 0;
  let cpuTimePercent = 0;
  
  if (baselineResult.cpuTime && currentResult.cpuTime) {
    cpuTimeDiff = currentResult.cpuTime - baselineResult.cpuTime;
    cpuTimePercent = (cpuTimeDiff / baselineResult.cpuTime) * 100;
  }
  
  return {
    baseline: baselineResult.name,
    current: currentResult.name,
    executionTimeDiff,
    executionTimePercent,
    cpuTimeDiff,
    cpuTimePercent,
    improvement: executionTimeDiff < 0
  };
}

/**
 * Run a benchmarked operation
 * 
 * @param {string} name - Benchmark name
 * @param {Function} operation - Function to benchmark
 * @param {Object} options - Benchmark options
 * @returns {Object} Result of operation with benchmark data
 */
export async function runBenchmarked(name, operation, options = {}) {
  // Create benchmark
  const benchmark = createBenchmark(name, options);
  
  try {
    // Start benchmark
    benchmark.start();
    
    // Run operation
    const result = await operation();
    
    // End benchmark
    const benchmarkResult = benchmark.end();
    
    // Return operation result with benchmark data
    return {
      result,
      benchmark: benchmarkResult
    };
  } catch (error) {
    // End benchmark even if operation fails
    benchmark.end({ error: error.message });
    throw error;
  }
}

export default {
  BenchmarkType,
  createBenchmark,
  getBenchmarkResults,
  clearBenchmarkResults,
  compareBenchmarks,
  runBenchmarked
};