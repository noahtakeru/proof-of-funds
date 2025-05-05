/**
 * @fileoverview Benchmarking system for measuring ZK operation performance
 * 
 * This module provides tools for measuring and comparing the performance of
 * different operations related to zero-knowledge proofs, allowing for
 * optimization of critical paths.
 */

import { PerformanceTelemetry } from './PerformanceTelemetry';

/**
 * Types of operations that can be benchmarked
 */
export enum BenchmarkOperationType {
  /** Generating a proof */
  ProofGeneration = 'proof_generation',
  /** Verifying a proof */
  ProofVerification = 'proof_verification',
  /** Preparing circuit inputs */
  InputPreparation = 'input_preparation',
  /** Loading circuits and dependencies */
  CircuitLoading = 'circuit_loading',
  /** Serializing and deserializing proofs */
  ProofSerialization = 'proof_serialization',
  /** Key generation operations */
  KeyGeneration = 'key_generation',
  /** Generic computation */
  Computation = 'computation'
}

/**
 * Benchmark configuration options
 */
export interface BenchmarkOptions {
  /** Name of the benchmark */
  name: string;
  /** Type of operation being benchmarked */
  type: BenchmarkOperationType;
  /** Number of iterations to run (default: 1) */
  iterations?: number;
  /** Whether to warm up before benchmarking (default: true) */
  warmup?: boolean;
  /** Number of warmup iterations (default: 1) */
  warmupIterations?: number;
  /** Additional context information */
  context?: Record<string, any>;
  /** Whether to report results to telemetry (default: true) */
  reportTelemetry?: boolean;
  /** Timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
}

/**
 * Single measurement from a benchmark
 */
export interface BenchmarkMeasurement {
  /** Duration in milliseconds */
  durationMs: number;
  /** CPU time used (if available) */
  cpuTimeMs?: number;
  /** Memory used in bytes (if measured) */
  memoryBytes?: number;
  /** Iteration number */
  iteration: number;
  /** Timestamp when the measurement was taken */
  timestamp: number;
}

/**
 * Result of a benchmark operation
 */
export interface BenchmarkResult {
  /** Name of the benchmark */
  name: string;
  /** Type of operation benchmarked */
  type: BenchmarkOperationType;
  /** Individual measurements */
  measurements: BenchmarkMeasurement[];
  /** Mean duration in milliseconds */
  meanDurationMs: number;
  /** Median duration in milliseconds */
  medianDurationMs: number;
  /** Minimum duration in milliseconds */
  minDurationMs: number;
  /** Maximum duration in milliseconds */
  maxDurationMs: number;
  /** Standard deviation of duration in milliseconds */
  stdDevDurationMs: number;
  /** 90th percentile duration in milliseconds */
  p90DurationMs: number;
  /** 95th percentile duration in milliseconds */
  p95DurationMs: number;
  /** 99th percentile duration in milliseconds */
  p99DurationMs: number;
  /** Mean memory usage in bytes (if measured) */
  meanMemoryBytes?: number;
  /** Number of iterations performed */
  iterations: number;
  /** Total duration of all iterations in milliseconds */
  totalDurationMs: number;
  /** Operations per second */
  opsPerSecond: number;
  /** Context information */
  context: Record<string, any>;
  /** Timestamp when the benchmark started */
  startTimestamp: number;
  /** Timestamp when the benchmark ended */
  endTimestamp: number;
}

/**
 * Benchmark registration information
 */
interface RegisteredBenchmark {
  /** ID of the benchmark */
  id: string;
  /** Name of the benchmark */
  name: string;
  /** Function to execute */
  fn: () => Promise<any>;
  /** Benchmark options */
  options: BenchmarkOptions;
}

/**
 * System for benchmarking performance of ZK operations
 */
export class BenchmarkingSystem {
  private registeredBenchmarks: Map<string, RegisteredBenchmark> = new Map();
  private benchmarkResults: Map<string, BenchmarkResult> = new Map();
  private telemetry: PerformanceTelemetry;
  private nextBenchmarkId = 1;
  
  /**
   * Create a new benchmarking system
   */
  constructor(telemetry?: PerformanceTelemetry) {
    this.telemetry = telemetry || new PerformanceTelemetry();
  }
  
  /**
   * Register a benchmark function
   * 
   * @returns Benchmark ID
   */
  public registerBenchmark(
    name: string,
    fn: () => Promise<any>,
    options: Partial<BenchmarkOptions> = {}
  ): string {
    const id = `benchmark_${this.nextBenchmarkId++}`;
    
    // Create full options with defaults
    const fullOptions: BenchmarkOptions = {
      name,
      type: options.type || BenchmarkOperationType.Computation,
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
   * @returns Benchmark result
   */
  public async runBenchmark(benchmarkId: string): Promise<BenchmarkResult> {
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
    const measurements: BenchmarkMeasurement[] = [];
    const startTimestamp = Date.now();
    
    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Benchmark timed out')), options.timeoutMs);
    });
    
    try {
      for (let i = 0; i < (options.iterations || 1); i++) {
        // Prepare memory measurement if possible
        let memoryBefore: number | undefined;
        if (typeof process !== 'undefined' && process.memoryUsage) {
          memoryBefore = process.memoryUsage().heapUsed;
        } else if (typeof performance !== 'undefined' && (performance as any).memory) {
          // Chrome-specific memory info
          const chromePerf = performance as any;
          memoryBefore = chromePerf.memory?.usedJSHeapSize;
        }
        
        const start = Date.now();
        let cpuTimeStart: number | undefined;
        
        // Try to measure CPU time if available
        if (typeof process !== 'undefined' && process.cpuUsage) {
          cpuTimeStart = process.cpuUsage().user + process.cpuUsage().system;
        }
        
        // Execute the function with timeout protection
        await Promise.race([fn(), timeoutPromise]);
        
        const end = Date.now();
        const durationMs = end - start;
        
        // Calculate CPU time if available
        let cpuTimeMs: number | undefined;
        if (typeof process !== 'undefined' && process.cpuUsage && cpuTimeStart !== undefined) {
          const cpuTimeEnd = process.cpuUsage().user + process.cpuUsage().system;
          cpuTimeMs = (cpuTimeEnd - cpuTimeStart) / 1000; // Convert from microseconds to milliseconds
        }
        
        // Calculate memory usage if available
        let memoryBytes: number | undefined;
        if (typeof process !== 'undefined' && process.memoryUsage && memoryBefore !== undefined) {
          const memoryAfter = process.memoryUsage().heapUsed;
          memoryBytes = memoryAfter - memoryBefore;
        } else if (typeof performance !== 'undefined' && (performance as any).memory && memoryBefore !== undefined) {
          // Chrome-specific memory info
          const chromePerf = performance as any;
          const memoryAfter = chromePerf.memory?.usedJSHeapSize;
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
   * @returns Benchmark result
   */
  public async benchmark(
    name: string,
    fn: () => Promise<any>,
    options: Partial<BenchmarkOptions> = {}
  ): Promise<BenchmarkResult> {
    const benchmarkId = this.registerBenchmark(name, fn, options);
    return this.runBenchmark(benchmarkId);
  }
  
  /**
   * Compare two benchmark results
   * 
   * @returns Comparison result with percentage differences
   */
  public compareBenchmarks(
    baselineId: string,
    comparisonId: string
  ): Record<string, number | string> {
    const baseline = this.benchmarkResults.get(baselineId);
    const comparison = this.benchmarkResults.get(comparisonId);
    
    if (!baseline) {
      throw new Error(`Baseline benchmark with ID '${baselineId}' not found`);
    }
    
    if (!comparison) {
      throw new Error(`Comparison benchmark with ID '${comparisonId}' not found`);
    }
    
    // Calculate percentage differences
    const meanDiff = this.calculatePercentDifference(baseline.meanDurationMs, comparison.meanDurationMs);
    const medianDiff = this.calculatePercentDifference(baseline.medianDurationMs, comparison.medianDurationMs);
    const p95Diff = this.calculatePercentDifference(baseline.p95DurationMs, comparison.p95DurationMs);
    const opsPerSecondDiff = this.calculatePercentDifference(baseline.opsPerSecond, comparison.opsPerSecond);
    
    // Default to 0 if memory measurements aren't available
    let memoryDiff = 0;
    if (baseline.meanMemoryBytes && comparison.meanMemoryBytes) {
      memoryDiff = this.calculatePercentDifference(baseline.meanMemoryBytes, comparison.meanMemoryBytes);
    }
    
    return {
      baselineName: baseline.name,
      comparisonName: comparison.name,
      meanDurationDiff: meanDiff,
      medianDurationDiff: medianDiff,
      p95DurationDiff: p95Diff,
      opsPerSecondDiff: opsPerSecondDiff,
      memoryDiff: memoryDiff,
      conclusion: meanDiff < 0 ? 
        `${comparison.name} is ${Math.abs(meanDiff).toFixed(2)}% faster than ${baseline.name}` : 
        `${comparison.name} is ${meanDiff.toFixed(2)}% slower than ${baseline.name}`
    };
  }
  
  /**
   * Get all benchmark results
   */
  public getAllResults(): BenchmarkResult[] {
    return Array.from(this.benchmarkResults.values());
  }
  
  /**
   * Get a specific benchmark result
   */
  public getResult(benchmarkId: string): BenchmarkResult | undefined {
    return this.benchmarkResults.get(benchmarkId);
  }
  
  /**
   * Clear all benchmark results
   */
  public clearResults(): void {
    this.benchmarkResults.clear();
  }
  
  /**
   * Calculate statistics from benchmark measurements
   */
  private calculateStatistics(
    measurements: BenchmarkMeasurement[],
    options: BenchmarkOptions,
    startTimestamp: number,
    endTimestamp: number
  ): BenchmarkResult {
    // Extract durations for statistics
    const durations = measurements.map(m => m.durationMs);
    durations.sort((a, b) => a - b);
    
    // Calculate basic statistics
    const meanDurationMs = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDurationMs = durations[0];
    const maxDurationMs = durations[durations.length - 1];
    const medianDurationMs = this.calculatePercentile(durations, 0.5);
    const p90DurationMs = this.calculatePercentile(durations, 0.9);
    const p95DurationMs = this.calculatePercentile(durations, 0.95);
    const p99DurationMs = this.calculatePercentile(durations, 0.99);
    
    // Calculate standard deviation
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - meanDurationMs, 2), 0) / durations.length;
    const stdDevDurationMs = Math.sqrt(variance);
    
    // Calculate memory usage statistics if available
    let meanMemoryBytes: number | undefined;
    const memories = measurements
      .map(m => m.memoryBytes)
      .filter((m): m is number => m !== undefined);
      
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
      medianDurationMs,
      minDurationMs,
      maxDurationMs,
      stdDevDurationMs,
      p90DurationMs,
      p95DurationMs,
      p99DurationMs,
      meanMemoryBytes,
      iterations: measurements.length,
      totalDurationMs,
      opsPerSecond,
      context: options.context || {},
      startTimestamp,
      endTimestamp
    };
  }
  
  /**
   * Calculate a percentile value from an array of numbers
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
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
   * Calculate percentage difference between baseline and comparison values
   */
  private calculatePercentDifference(baseline: number, comparison: number): number {
    return ((comparison - baseline) / baseline) * 100;
  }
}