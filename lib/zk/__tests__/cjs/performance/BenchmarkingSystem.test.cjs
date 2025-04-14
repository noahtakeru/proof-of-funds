/**
 * BenchmarkingSystem.test.cjs
 * 
 * CommonJS version of tests for the BenchmarkingSystem component
 * of the Performance Optimization Framework.
 */

const { BenchmarkingSystem, BenchmarkType } = require('../../cjs/performance/BenchmarkingSystem.cjs');

// Mock Jest environment for running outside Jest
global.describe = (name, fn) => {
  console.log(`\n${name}`);
  fn();
};

global.test = (name, fn) => {
  console.log(`- ${name}`);
  try {
    fn();
    console.log('  ✓ PASS');
  } catch (error) {
    console.error(`  ✗ FAIL: ${error.message}`);
    throw error;
  }
};

global.expect = (actual) => ({
  toBeDefined: () => {
    if (actual === undefined) throw new Error('Expected value to be defined, but got undefined');
  },
  toBe: (expected) => {
    if (actual !== expected) throw new Error(`Expected ${actual} to be ${expected}`);
  },
  toBeGreaterThan: (expected) => {
    if (!(actual > expected)) throw new Error(`Expected ${actual} to be greater than ${expected}`);
  },
  toContain: (expected) => {
    if (!actual.includes(expected)) throw new Error(`Expected "${actual}" to contain "${expected}"`);
  },
  toBeCloseTo: (expected, precision) => {
    const power = Math.pow(10, precision || 2);
    const actualRounded = Math.round(actual * power) / power;
    const expectedRounded = Math.round(expected * power) / power;
    if (actualRounded !== expectedRounded) {
      throw new Error(`Expected ${actual} to be close to ${expected} (with precision ${precision}), got ${actualRounded} vs ${expectedRounded}`);
    }
  }
});

// Simple beforeEach mock
let benchmarkingSystem;
global.beforeEach = (fn) => {
  fn();
};

// Execute the tests
describe('BenchmarkingSystem (CJS)', () => {
  beforeEach(() => {
    benchmarkingSystem = new BenchmarkingSystem();
  });

  test('should initialize correctly', () => {
    expect(benchmarkingSystem).toBeDefined();
  });
  
  test('should generate a benchmark report', () => {
    // Create a benchmark result
    const result = {
      type: 'proof_verification',
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
  });
  
  test('should compare benchmark results correctly', () => {
    // Create baseline and current benchmark results
    const baseline = {
      type: 'proof_generation',
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
      type: 'proof_generation',
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
    expect(comparison.analysis).toContain('improved by');
  });
});

console.log("\nAll BenchmarkingSystem tests passed!");