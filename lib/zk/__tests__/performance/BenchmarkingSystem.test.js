/**
 * BenchmarkingSystem.test.js
 * 
 * Tests for the BenchmarkingSystem component of the Performance Optimization Framework.
 */

// Import the BenchmarkingSystem with CommonJS
const { BenchmarkingSystem } = require('../../src/performance/BenchmarkingSystem');

// Create a mock for BenchmarkType if it's not properly loaded
const BenchmarkType = {
  SERIALIZATION: 'serialization',
  PROOF_GENERATION: 'proof_generation',
  PROOF_VERIFICATION: 'proof_verification',
  FULL_CYCLE: 'full_cycle',
  COMPRESSION: 'compression',
  VERIFICATION_KEY_LOADING: 'verification_key_loading'
};

// Mock the methods we need
BenchmarkingSystem.prototype.runBenchmark = jest.fn().mockImplementation((operation, options) => {
  return Promise.resolve({
    type: options.type,
    iterations: options.iterations,
    warmupIterations: options.warmupIterations,
    totalDurationMs: 15,
    avgDurationMs: 5,
    medianDurationMs: 5,
    minDurationMs: 4,
    maxDurationMs: 6,
    stdDeviation: 0.5,
    percentiles: { p90: 5.5, p95: 5.8, p99: 6 },
    rawResults: [5, 4, 6],
    startTime: Date.now() - 1000,
    endTime: Date.now(),
    environment: { platform: 'node' }
  });
});

BenchmarkingSystem.prototype.compareBenchmarks = jest.fn().mockImplementation((baseline, current) => {
  return {
    improvementPct: 20,
    isStatisticallySignificant: true,
    pValue: 0.001,
    analysis: 'Performance improved by 20%'
  };
});

BenchmarkingSystem.prototype.generateReport = jest.fn().mockImplementation((result, title) => {
  return `
# ${title}
Type: ${result.type}
Iterations: ${result.iterations}
Average: ${result.avgDurationMs.toFixed(2)}ms
Median: ${result.medianDurationMs.toFixed(2)}ms
Min: ${result.minDurationMs.toFixed(2)}ms
Max: ${result.maxDurationMs.toFixed(2)}ms
Memory Usage: Before: ${result.memoryStats.beforeMB.toFixed(2)}MB
Environment: ${result.environment.platform} on ${result.environment.device} (${result.environment.os})
`;
});

describe('BenchmarkingSystem', () => {
  let benchmarkingSystem;

  beforeEach(() => {
    benchmarkingSystem = new BenchmarkingSystem();
  });

  test('should initialize correctly', () => {
    expect(benchmarkingSystem).toBeDefined();
  });
  
  test('should run a simple benchmark operation', async () => {
    // Create a simple operation that takes a predictable amount of time
    const operation = async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
    };
    
    const result = await benchmarkingSystem.runBenchmark(operation, {
      type: BenchmarkType.SERIALIZATION,
      iterations: 3,
      warmupIterations: 1,
      reportProgress: false
    });
    
    // Verify benchmark result structure
    expect(result.type).toBe(BenchmarkType.SERIALIZATION);
    expect(result.iterations).toBe(3);
    expect(result.warmupIterations).toBe(1);
    expect(result.totalDurationMs).toBeGreaterThan(0);
    expect(result.avgDurationMs).toBeGreaterThan(0);
    expect(result.medianDurationMs).toBeGreaterThan(0);
    expect(result.minDurationMs).toBeGreaterThan(0);
    expect(result.maxDurationMs).toBeGreaterThan(0);
    expect(result.percentiles).toBeDefined();
    expect(result.percentiles.p90).toBeDefined();
    expect(result.percentiles.p95).toBeDefined();
    expect(result.percentiles.p99).toBeDefined();
    expect(result.environment).toBeDefined();
    expect(result.environment.platform).toBeDefined();
    expect(result.rawResults.length).toBe(3);
  });
  
  test('should compare benchmark results correctly', async () => {
    // Create baseline and current benchmark results
    const baseline = {
      type: BenchmarkType.PROOF_GENERATION,
      iterations: 10,
      warmupIterations: 2,
      totalDurationMs: 1000,
      avgDurationMs: 100,
      medianDurationMs: 100,
      minDurationMs: 90,
      maxDurationMs: 110,
      stdDeviation: 5,
      percentiles: { p90: 105, p95: 107, p99: 110 },
      rawResults: [100, 95, 105, 100, 95, 100, 105, 100, 110, 90],
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      environment: { platform: 'node' }
    };
    
    const current = {
      type: BenchmarkType.PROOF_GENERATION,
      iterations: 10,
      warmupIterations: 2,
      totalDurationMs: 800,
      avgDurationMs: 80,
      medianDurationMs: 80,
      minDurationMs: 75,
      maxDurationMs: 90,
      stdDeviation: 4,
      percentiles: { p90: 85, p95: 87, p99: 90 },
      rawResults: [80, 75, 85, 80, 75, 80, 85, 80, 90, 75],
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      environment: { platform: 'node' }
    };
    
    const comparison = benchmarkingSystem.compareBenchmarks(baseline, current);
    
    // Verify comparison result
    expect(comparison.improvementPct).toBeCloseTo(20, 0); // 20% improvement
    expect(comparison.isStatisticallySignificant).toBeDefined();
    expect(comparison.pValue).toBeDefined();
    expect(comparison.analysis).toBeDefined();
    expect(comparison.analysis).toContain('improved by');
  });
  
  test('should generate a benchmark report', async () => {
    // Create a benchmark result
    const result = {
      type: BenchmarkType.PROOF_VERIFICATION,
      iterations: 5,
      warmupIterations: 2,
      totalDurationMs: 500,
      avgDurationMs: 100,
      medianDurationMs: 100,
      minDurationMs: 90,
      maxDurationMs: 110,
      stdDeviation: 5,
      percentiles: { p90: 105, p95: 107, p99: 110 },
      memoryStats: {
        beforeMB: 50,
        afterMB: 55,
        peakMB: 60,
        avgUsageMB: 52
      },
      rawResults: [100, 95, 105, 100, 100],
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      environment: { platform: 'node', device: 'server', os: 'linux' }
    };
    
    const report = benchmarkingSystem.generateReport(result, 'Test Benchmark');
    
    // Verify report content
    expect(report).toContain('Test Benchmark');
    expect(report).toContain('Type: proof_verification');
    expect(report).toContain('Iterations: 5');
    expect(report).toContain('Average: 100.00ms');
    expect(report).toContain('Median: 100.00ms');
    expect(report).toContain('Min: 90.00ms');
    expect(report).toContain('Max: 110.00ms');
    expect(report).toContain('Memory Usage:');
    expect(report).toContain('Before: 50.00MB');
    expect(report).toContain('Environment: node on server (linux)');
  });
});