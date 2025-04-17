/**
 * BenchmarkingSystem.cjs
 * 
 * CommonJS version of the BenchmarkingSystem component for measuring
 * and comparing the performance of ZK operations.
 */

/**
 * Enum for benchmark operation types
 */
const BenchmarkType = {
  PROOF_GENERATION: 'proof_generation',
  PROOF_VERIFICATION: 'proof_verification',
  INPUT_PREPARATION: 'input_preparation',
  CIRCUIT_LOADING: 'circuit_loading',
  WASM_EXECUTION: 'wasm_execution',
  SERIALIZATION: 'serialization',
  PROOF_SERIALIZATION: 'proof_serialization',
  KEY_GENERATION: 'key_generation',
  COMPUTATION: 'computation',
  FULL_WORKFLOW: 'full_workflow'
};

/**
 * Performance telemetry system for collecting benchmark data 
 */
class PerformanceTelemetry {
  constructor() {
    this.results = [];
  }

  /**
   * Report a benchmark result
   */
  reportBenchmarkResult(result) {
    this.results.push(result);
    return true;
  }

  /**
   * Get all collected results
   */
  getAllResults() {
    return this.results;
  }
}

/**
 * System for benchmarking ZK operations with detailed statistical analysis
 */
class BenchmarkingSystem {
  constructor(telemetry) {
    this.registeredBenchmarks = new Map();
    this.benchmarkResults = new Map();
    this.telemetry = telemetry || new PerformanceTelemetry();
    this.nextBenchmarkId = 1;
    this.environment = this.detectEnvironment();
  }

  /**
   * Register a benchmark function
   * 
   * @param {string} name - Name of the benchmark
   * @param {Function} fn - Async function to benchmark
   * @param {Object} options - Benchmark options
   * @returns {string} Benchmark ID
   */
  registerBenchmark(name, fn, options = {}) {
    const id = `benchmark_${this.nextBenchmarkId++}`;
    
    // Create full options with defaults
    const fullOptions = {
      name,
      type: options.type || BenchmarkType.COMPUTATION,
      iterations: options.iterations || 1,
      warmup: options.warmup !== false,
      warmupIterations: options.warmupIterations || 1,
      context: options.context || {},
      reportTelemetry: options.reportTelemetry !== false,
      timeoutMs: options.timeoutMs || 60000
    };
    
    // Register the benchmark
    this.registeredBenchmarks.set(id, {
      id,
      name,
      fn,
      options: fullOptions
    });
    
    return id;
  }

  /**
   * Run a registered benchmark
   * 
   * @param {string} benchmarkId - ID of the benchmark to run
   * @returns {Promise<Object>} Benchmark result
   */
  async runBenchmark(benchmarkId) {
    const benchmark = this.registeredBenchmarks.get(benchmarkId);
    
    if (!benchmark) {
      throw new Error(`Benchmark with ID '${benchmarkId}' not found`);
    }
    
    const { fn, options } = benchmark;
    
    // Perform warmup if enabled
    if (options.warmup && options.warmupIterations && options.warmupIterations > 0) {
      for (let i = 0; i < options.warmupIterations; i++) {
        try {
          await fn();
        } catch (e) {
          // Ignore errors during warmup
        }
      }
    }
    
    // Run the benchmark
    const measurements = [];
    const startTimestamp = Date.now();
    
    // Create timeout handler
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Benchmark timed out')), options.timeoutMs);
    });
    
    try {
      for (let i = 0; i < (options.iterations || 1); i++) {
        // Prepare memory measurement if possible
        let memoryBefore;
        if (typeof process !== 'undefined' && process.memoryUsage) {
          memoryBefore = process.memoryUsage().heapUsed;
        } else if (typeof performance !== 'undefined' && performance.memory) {
          memoryBefore = performance.memory.usedJSHeapSize;
        }
        
        const start = Date.now();
        let cpuTimeStart;
        
        // Try to measure CPU time if available
        if (typeof process !== 'undefined' && process.cpuUsage) {
          const cpuUsage = process.cpuUsage();
          cpuTimeStart = cpuUsage.user + cpuUsage.system;
        }
        
        // Execute the function with timeout protection
        const fnPromise = fn();
        await Promise.race([fnPromise, timeoutPromise]);
        
        const end = Date.now();
        const durationMs = end - start;
        
        // Calculate CPU time if available
        let cpuTimeMs;
        if (typeof process !== 'undefined' && process.cpuUsage && cpuTimeStart !== undefined) {
          const cpuUsage = process.cpuUsage();
          const cpuTimeEnd = cpuUsage.user + cpuUsage.system;
          cpuTimeMs = (cpuTimeEnd - cpuTimeStart) / 1000; // Convert from microseconds to milliseconds
        }
        
        // Calculate memory usage if available
        let memoryBytes;
        if (typeof process !== 'undefined' && process.memoryUsage && memoryBefore !== undefined) {
          const memoryAfter = process.memoryUsage().heapUsed;
          memoryBytes = memoryAfter - memoryBefore;
        } else if (typeof performance !== 'undefined' && performance.memory && memoryBefore !== undefined) {
          const memoryAfter = performance.memory.usedJSHeapSize;
          memoryBytes = memoryAfter - memoryBefore;
        }
        
        // Record measurement
        measurements.push({
          durationMs,
          cpuTimeMs,
          memoryBytes,
          iteration: i,
          timestamp: end
        });
      }
    } catch (error) {
      throw new Error(`Benchmark '${options.name}' failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clear the timeout
      if (timeoutId) clearTimeout(timeoutId);
    }
    
    const endTimestamp = Date.now();
    
    // Calculate statistics
    const result = this.calculateStatistics(measurements, options, startTimestamp, endTimestamp);
    
    // Store the result
    this.benchmarkResults.set(benchmarkId, result);
    
    // Report to telemetry if enabled
    if (options.reportTelemetry) {
      this.telemetry.reportBenchmarkResult(result);
    }
    
    return result;
  }

  /**
   * Run a benchmark function directly without registration
   * 
   * @param {string} name - Name of the benchmark
   * @param {Function} fn - Async function to benchmark
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark result
   */
  async benchmark(name, fn, options = {}) {
    const benchmarkId = this.registerBenchmark(name, fn, options);
    return this.runBenchmark(benchmarkId);
  }

  /**
   * Direct execution of operation with benchmark configuration
   * 
   * @param {Function} operation - Operation to execute
   * @param {Object} config - Benchmark configuration
   * @returns {Promise<Object>} Result with performance metrics
   */
  async execute(operation, config = {}) {
    // Apply defaults
    const iterations = config.iterations || 10;
    const warmupIterations = config.warmupIterations || 2;
    const type = config.type || BenchmarkType.COMPUTATION;
    const collectMemoryStats = config.collectMemoryStats !== false;
    
    // Create benchmark
    return this.benchmark("Ad hoc execution", operation, {
      type,
      iterations,
      warmupIterations,
      context: config.parameters || {}
    });
  }

  /**
   * Compare two benchmark results
   * 
   * @param {Object} baseline - Baseline benchmark result
   * @param {Object} current - Current benchmark result to compare
   * @returns {Object} Comparison analysis
   */
  compareBenchmarks(baseline, current) {
    if (!baseline || !current) {
      throw new Error("Both baseline and current results must be provided");
    }
    
    // Calculate improvement percentage based on average duration
    const baselineAvg = baseline.meanDurationMs || baseline.avgDurationMs;
    const currentAvg = current.meanDurationMs || current.avgDurationMs;
    
    if (!baselineAvg || !currentAvg) {
      throw new Error("Invalid benchmark results - missing duration metrics");
    }
    
    const improvementPct = ((baselineAvg - currentAvg) / baselineAvg) * 100;
    
    // Calculate if the improvement is statistically significant
    // Using simplified t-test approach
    const baselineSamples = baseline.measurements || baseline.rawResults || [];
    const currentSamples = current.measurements || current.rawResults || [];
    
    let isStatisticallySignificant = false;
    let pValue = 0.5;
    
    if (baselineSamples.length >= 5 && currentSamples.length >= 5) {
      // Simple heuristic for statistical significance
      const baselineStdDev = baseline.stdDevDurationMs || baseline.stdDeviation || 0;
      const currentStdDev = current.stdDevDurationMs || current.stdDeviation || 0;
      
      // Very simple approach - if the difference is larger than the combined standard deviations
      const combinedStdDev = Math.sqrt(
        (baselineStdDev * baselineStdDev) / baselineSamples.length + 
        (currentStdDev * currentStdDev) / currentSamples.length
      );
      
      const tStatistic = Math.abs(baselineAvg - currentAvg) / combinedStdDev;
      isStatisticallySignificant = tStatistic > 2.0;  // Rough approximation of p<0.05
      pValue = tStatistic > 3.0 ? 0.01 : (tStatistic > 2.0 ? 0.05 : 0.5);
    } else {
      // Not enough samples for statistical significance
      isStatisticallySignificant = Math.abs(improvementPct) > 20;  // Simple heuristic
      pValue = 0.1;
    }
    
    // Generate analysis text
    let analysis = '';
    if (improvementPct > 0) {
      analysis = `Performance improved by ${improvementPct.toFixed(2)}% `;
    } else {
      analysis = `Performance degraded by ${Math.abs(improvementPct).toFixed(2)}% `;
    }
    
    if (isStatisticallySignificant) {
      analysis += `(statistically significant, p≈${pValue.toFixed(2)})`;
    } else {
      analysis += `(not statistically significant, p≈${pValue.toFixed(2)})`;
    }
    
    return {
      baselineName: baseline.name || "Baseline",
      currentName: current.name || "Current",
      improvementPct,
      isStatisticallySignificant,
      pValue,
      analysis,
      baselineAvg,
      currentAvg
    };
  }

  /**
   * Generate a concise report from benchmark results
   * 
   * @param {Object} result - Benchmark result
   * @param {string} title - Optional report title
   * @returns {string} Formatted report
   */
  generateReport(result, title) {
    let report = '';
    
    if (title) {
      report += `=== ${title} ===\n\n`;
    } else {
      report += `=== ${result.type || "Benchmark"} Report ===\n\n`;
    }
    
    report += `Type: ${result.type || "custom"}\n`;
    
    const iterations = result.iterations || (result.measurements ? result.measurements.length : 0);
    const warmupIterations = result.warmupIterations || 0;
    
    report += `Iterations: ${iterations}${warmupIterations > 0 ? ` (+ ${warmupIterations} warmup)` : ''}\n`;
    
    const totalDuration = result.totalDurationMs || 
                         (result.measurements ? 
                           result.measurements.reduce((sum, m) => sum + m.durationMs, 0) : 0);
                           
    report += `Total Duration: ${totalDuration.toFixed(2)}ms\n\n`;
    
    // Display duration statistics
    const avgDuration = result.meanDurationMs || result.avgDurationMs || 0;
    const medianDuration = result.medianDurationMs || 0;
    const minDuration = result.minDurationMs || 0;
    const maxDuration = result.maxDurationMs || 0;
    const stdDeviation = result.stdDevDurationMs || result.stdDeviation || 0;
    
    report += `Average: ${avgDuration.toFixed(2)}ms\n`;
    report += `Median: ${medianDuration.toFixed(2)}ms\n`;
    report += `Min: ${minDuration.toFixed(2)}ms\n`;
    report += `Max: ${maxDuration.toFixed(2)}ms\n`;
    report += `Std Deviation: ${stdDeviation.toFixed(2)}ms\n\n`;
    
    // Display percentiles
    const percentiles = result.percentiles || {};
    const p90 = percentiles.p90 || result.p90DurationMs || 0;
    const p95 = percentiles.p95 || result.p95DurationMs || 0;
    const p99 = percentiles.p99 || result.p99DurationMs || 0;
    
    report += `Percentiles:\n`;
    report += `  p90: ${p90.toFixed(2)}ms\n`;
    report += `  p95: ${p95.toFixed(2)}ms\n`;
    report += `  p99: ${p99.toFixed(2)}ms\n\n`;
    
    // Display memory stats if available
    const memoryStats = result.memoryStats || {};
    const meanMemoryBytes = result.meanMemoryBytes;
    
    if (memoryStats.beforeMB !== undefined || 
        memoryStats.afterMB !== undefined || 
        memoryStats.peakMB !== undefined || 
        memoryStats.avgUsageMB !== undefined ||
        meanMemoryBytes !== undefined) {
      
      report += `Memory Usage:\n`;
      
      if (memoryStats.beforeMB !== undefined) {
        report += `  Before: ${memoryStats.beforeMB.toFixed(2)}MB\n`;
      }
      
      if (memoryStats.afterMB !== undefined) {
        report += `  After: ${memoryStats.afterMB.toFixed(2)}MB\n`;
      }
      
      if (memoryStats.peakMB !== undefined) {
        report += `  Peak: ${memoryStats.peakMB.toFixed(2)}MB\n`;
      }
      
      if (memoryStats.avgUsageMB !== undefined) {
        report += `  Average: ${memoryStats.avgUsageMB.toFixed(2)}MB\n`;
      }
      
      if (meanMemoryBytes !== undefined) {
        report += `  Average: ${(meanMemoryBytes / (1024 * 1024)).toFixed(2)}MB\n`;
      }
      
      report += '\n';
    }
    
    // Display environment information
    const environment = result.environment || this.environment;
    
    report += `Environment: ${environment.platform || "unknown"}`;
    
    if (environment.device) {
      report += ` on ${environment.device}`;
    }
    
    if (environment.os) {
      report += ` (${environment.os})`;
    }
    
    report += '\n';
    
    return report;
  }

  /**
   * Calculate statistics from benchmark measurements
   * 
   * @param {Array} measurements - Array of measurement objects
   * @param {Object} options - Benchmark options
   * @param {number} startTimestamp - Start timestamp
   * @param {number} endTimestamp - End timestamp
   * @returns {Object} Result with calculated statistics
   */
  calculateStatistics(measurements, options, startTimestamp, endTimestamp) {
    // Extract durations for statistics
    const durations = measurements.map(m => m.durationMs);
    const sortedDurations = [...durations].sort((a, b) => a - b);
    
    // Calculate basic statistics
    const meanDurationMs = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDurationMs = sortedDurations[0];
    const maxDurationMs = sortedDurations[sortedDurations.length - 1];
    const medianDurationMs = this.calculatePercentile(sortedDurations, 0.5);
    const p90DurationMs = this.calculatePercentile(sortedDurations, 0.9);
    const p95DurationMs = this.calculatePercentile(sortedDurations, 0.95);
    const p99DurationMs = this.calculatePercentile(sortedDurations, 0.99);
    
    // Calculate standard deviation
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - meanDurationMs, 2), 0) / durations.length;
    const stdDevDurationMs = Math.sqrt(variance);
    
    // Calculate memory usage statistics if available
    let meanMemoryBytes;
    const memories = measurements
      .map(m => m.memoryBytes)
      .filter(m => m !== undefined);
      
    if (memories.length > 0) {
      meanMemoryBytes = memories.reduce((sum, m) => sum + m, 0) / memories.length;
    }
    
    // Calculate total duration and operations per second
    const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);
    const opsPerSecond = (measurements.length / totalDurationMs) * 1000;
    
    return {
      name: options.name,
      type: options.type,
      measurements,
      meanDurationMs,
      avgDurationMs: meanDurationMs, // Alias for compatibility
      medianDurationMs,
      minDurationMs,
      maxDurationMs,
      stdDevDurationMs,
      stdDeviation: stdDevDurationMs, // Alias for compatibility
      p90DurationMs,
      p95DurationMs,
      p99DurationMs,
      percentiles: { // For compatibility with old format
        p90: p90DurationMs,
        p95: p95DurationMs,
        p99: p99DurationMs
      },
      meanMemoryBytes,
      iterations: measurements.length,
      warmupIterations: options.warmupIterations || 0,
      totalDurationMs,
      opsPerSecond,
      rawResults: durations, // For compatibility
      context: options.context || {},
      parameters: options.context || {}, // For compatibility
      startTimestamp,
      endTimestamp,
      startTime: startTimestamp, // For compatibility
      endTime: endTimestamp, // For compatibility
      environment: this.environment
    };
  }

  /**
   * Calculate a percentile value from a sorted array of numbers
   * 
   * @param {Array<number>} sortedValues - Sorted array of values
   * @param {number} percentile - Percentile to calculate (0-1)
   * @returns {number} Percentile value
   */
  calculatePercentile(sortedValues, percentile) {
    if (sortedValues.length === 0) {
      return 0;
    }
    
    if (sortedValues.length === 1) {
      return sortedValues[0];
    }
    
    const index = Math.min(
      Math.floor(percentile * sortedValues.length),
      sortedValues.length - 1
    );
    
    return sortedValues[index];
  }

  /**
   * Get all benchmark results
   * 
   * @returns {Array} Array of benchmark results
   */
  getAllResults() {
    return Array.from(this.benchmarkResults.values());
  }

  /**
   * Get a specific benchmark result
   * 
   * @param {string} benchmarkId - ID of the benchmark
   * @returns {Object|undefined} Benchmark result or undefined
   */
  getResult(benchmarkId) {
    return this.benchmarkResults.get(benchmarkId);
  }

  /**
   * Clear all benchmark results
   */
  clearResults() {
    this.benchmarkResults.clear();
  }

  /**
   * Helper method to detect the current environment
   * 
   * @returns {Object} Environment information
   */
  detectEnvironment() {
    return {
      platform: typeof process !== 'undefined' ? 'node' : 'browser',
      device: typeof navigator !== 'undefined' ? 
              (navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop') : 
              'server',
      os: typeof process !== 'undefined' ? process.platform : 
          (typeof navigator !== 'undefined' ? 
            (navigator.platform || navigator.userAgent) : 'unknown')
    };
  }
}

module.exports = {
  BenchmarkingSystem,
  BenchmarkType,
  PerformanceTelemetry
};