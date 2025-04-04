/**
 * Tests for CircuitBuildManager
 * 
 * This file contains tests for the CircuitBuildManager module which
 * handles building and versioning of zero-knowledge circuits.
 */

import fs from 'fs';
import path from 'path';
import CircuitBuildManager from '../CircuitBuildManager.js';
import { CIRCUIT_TYPES } from '../CircuitBuildManager.js';

// Mock the file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(() => Buffer.from('test data')),
  writeFileSync: jest.fn(),
}));

// Mock child_process.exec
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => callback(null, { stdout: 'success', stderr: '' })),
  execSync: jest.fn(() => 'command output'),
}));

// Mock VerificationKeyRegistry
jest.mock('../VerificationKeyRegistry.js', () => ({
  __esModule: true,
  default: {
    registerKey: jest.fn(() => 'mock-key-id'),
    registerArtifactPaths: jest.fn(() => true),
  },
  KEY_STATUS: {
    ACTIVE: 'active',
    DEPRECATED: 'deprecated',
    REVOKED: 'revoked',
    TESTING: 'testing',
  },
}));

describe('CircuitBuildManager', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  // Test initialization
  test('should initialize correctly', () => {
    expect(CircuitBuildManager).toBeDefined();
    expect(CircuitBuildManager.baseDir).toBeDefined();
    expect(CircuitBuildManager.circuitsDir).toBeDefined();
    expect(CircuitBuildManager.buildDir).toBeDefined();
  });

  // Test directory creation
  test('should ensure required directories exist', () => {
    CircuitBuildManager.ensureDirectories();
    
    // Should check if directories exist
    expect(fs.existsSync).toHaveBeenCalled();
    
    // Should create directories if they don't exist
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  // Test circuit building
  test('should build a circuit', async () => {
    const result = await CircuitBuildManager.buildCircuit({
      circuitType: CIRCUIT_TYPES.STANDARD.id,
      circuitName: 'TestCircuit',
      version: '1.0.0',
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.circuitId).toBe('standard-TestCircuit');
    expect(result.version).toBe('1.0.0');
    expect(result.keyId).toBe('mock-key-id');
  });

  // Test circuit version registration
  test('should register a circuit version', () => {
    const buildInfo = {
      buildTime: Date.now(),
      buildPaths: {
        r1cs: '/path/to/r1cs',
        wasm: '/path/to/wasm',
        zkey: '/path/to/zkey',
        verificationKey: '/path/to/vkey',
      },
      fileHashes: {
        r1cs: '0xabc123',
        wasm: '0xdef456',
        zkey: '0xghi789',
        verificationKey: '0xjkl012',
      },
    };

    CircuitBuildManager.registerCircuitVersion(
      CIRCUIT_TYPES.THRESHOLD.id,
      'ThresholdTest',
      '1.0.0',
      buildInfo
    );

    // Check if version was registered
    const circuitId = `${CIRCUIT_TYPES.THRESHOLD.id}-ThresholdTest`;
    expect(CircuitBuildManager.circuitVersions.has(circuitId)).toBe(true);
    
    const versions = CircuitBuildManager.circuitVersions.get(circuitId);
    expect(versions.has('1.0.0')).toBe(true);
  });

  // Test getting circuit version info
  test('should get circuit version information', () => {
    // Register a version
    const buildInfo = {
      buildTime: Date.now(),
      buildPaths: {
        r1cs: '/path/to/r1cs',
        wasm: '/path/to/wasm',
        zkey: '/path/to/zkey',
        verificationKey: '/path/to/vkey',
      },
      fileHashes: {
        r1cs: '0x123',
        wasm: '0x456',
        zkey: '0x789',
        verificationKey: '0x012',
      },
    };

    CircuitBuildManager.registerCircuitVersion(
      CIRCUIT_TYPES.MAXIMUM.id,
      'MaxTest',
      '1.0.0',
      buildInfo
    );

    // Get version info
    const versionInfo = CircuitBuildManager.getCircuitVersion(
      CIRCUIT_TYPES.MAXIMUM.id,
      'MaxTest',
      '1.0.0'
    );

    expect(versionInfo).toBeDefined();
    expect(versionInfo.circuitId).toBe('maximum-MaxTest');
    expect(versionInfo.version).toBe('1.0.0');
    expect(versionInfo.buildPaths).toEqual(buildInfo.buildPaths);
    expect(versionInfo.fileHashes).toEqual(buildInfo.fileHashes);
  });

  // Test listing circuit versions
  test('should list all versions of a circuit', () => {
    // Register multiple versions
    const buildInfo = {
      buildTime: Date.now(),
      buildPaths: { /* paths */ },
      fileHashes: { /* hashes */ },
    };

    CircuitBuildManager.registerCircuitVersion(
      CIRCUIT_TYPES.STANDARD.id,
      'ListTest',
      '1.0.0',
      buildInfo
    );

    CircuitBuildManager.registerCircuitVersion(
      CIRCUIT_TYPES.STANDARD.id,
      'ListTest',
      '1.1.0',
      buildInfo
    );

    // List versions
    const versions = CircuitBuildManager.listCircuitVersions(
      CIRCUIT_TYPES.STANDARD.id,
      'ListTest'
    );

    expect(versions).toBeDefined();
    expect(versions.length).toBe(2);
    expect(versions[0].version).toBe('1.0.0');
    expect(versions[1].version).toBe('1.1.0');
  });

  // Test getting latest circuit version
  test('should get the latest version of a circuit', () => {
    // Register multiple versions
    const buildInfo = {
      buildTime: Date.now(),
      buildPaths: { /* paths */ },
      fileHashes: { /* hashes */ },
    };

    CircuitBuildManager.registerCircuitVersion(
      CIRCUIT_TYPES.THRESHOLD.id,
      'LatestTest',
      '1.0.0',
      buildInfo
    );

    CircuitBuildManager.registerCircuitVersion(
      CIRCUIT_TYPES.THRESHOLD.id,
      'LatestTest',
      '2.0.0',
      buildInfo
    );

    CircuitBuildManager.registerCircuitVersion(
      CIRCUIT_TYPES.THRESHOLD.id,
      'LatestTest',
      '1.5.0',
      buildInfo
    );

    // Get latest version
    const latest = CircuitBuildManager.getLatestCircuitVersion(
      CIRCUIT_TYPES.THRESHOLD.id,
      'LatestTest'
    );

    expect(latest).toBeDefined();
    expect(latest.version).toBe('2.0.0');
  });

  // Test getting build metrics
  test('should provide build metrics', () => {
    // Add some build history
    CircuitBuildManager.buildHistory.push({
      circuitType: CIRCUIT_TYPES.STANDARD.id,
      circuitName: 'MetricsTest',
      version: '1.0.0',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      duration: 5000,
      success: true,
    });

    CircuitBuildManager.buildHistory.push({
      circuitType: CIRCUIT_TYPES.MAXIMUM.id,
      circuitName: 'MetricsTest',
      version: '1.0.0',
      startTime: Date.now() - 3000,
      endTime: Date.now(),
      duration: 3000,
      success: true,
    });

    CircuitBuildManager.buildHistory.push({
      circuitType: CIRCUIT_TYPES.THRESHOLD.id,
      circuitName: 'MetricsTest',
      version: '1.0.0',
      startTime: Date.now() - 2000,
      endTime: Date.now(),
      duration: 2000,
      success: false,
      error: 'Test error',
    });

    // Get metrics
    const metrics = CircuitBuildManager.getBuildMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.totalBuilds).toBe(3);
    expect(metrics.successfulBuilds).toBe(2);
    expect(metrics.failedBuilds).toBe(1);
    expect(metrics.successRate).toBe((2/3) * 100);
    expect(metrics.averageDuration).toBe(4000); // (5000 + 3000) / 2
  });

  // Test circuit integrity verification
  test('should verify circuit integrity', async () => {
    // Register a version
    const buildInfo = {
      buildTime: Date.now(),
      buildPaths: {
        r1cs: '/path/to/r1cs',
        wasm: '/path/to/wasm',
        zkey: '/path/to/zkey',
        verificationKey: '/path/to/vkey',
      },
      fileHashes: {
        r1cs: '0xaabbcc',
        wasm: '0xddeeff',
        zkey: '0x112233',
        verificationKey: '0x445566',
      },
    };

    // Mock file hashing to return expected values
    CircuitBuildManager.hashFile = jest.fn(async (path) => {
      if (path === buildInfo.buildPaths.r1cs) return buildInfo.fileHashes.r1cs;
      if (path === buildInfo.buildPaths.wasm) return buildInfo.fileHashes.wasm;
      if (path === buildInfo.buildPaths.zkey) return buildInfo.fileHashes.zkey;
      if (path === buildInfo.buildPaths.verificationKey) return buildInfo.fileHashes.verificationKey;
      return 'invalid-hash';
    });

    CircuitBuildManager.registerCircuitVersion(
      CIRCUIT_TYPES.STANDARD.id,
      'IntegrityTest',
      '1.0.0',
      buildInfo
    );

    // Verify integrity
    const result = await CircuitBuildManager.verifyCircuitIntegrity(
      CIRCUIT_TYPES.STANDARD.id,
      'IntegrityTest',
      '1.0.0'
    );

    expect(result).toBeDefined();
    expect(result.allValid).toBe(true);
    expect(result.results.r1cs.isValid).toBe(true);
    expect(result.results.wasm.isValid).toBe(true);
    expect(result.results.zkey.isValid).toBe(true);
    expect(result.results.verificationKey.isValid).toBe(true);
  });
});