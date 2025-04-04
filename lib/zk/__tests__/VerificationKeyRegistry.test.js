/**
 * Tests for VerificationKeyRegistry
 * 
 * This file contains tests for the VerificationKeyRegistry module which
 * manages versioned verification keys for zero-knowledge circuits.
 */

import VerificationKeyRegistry, { KEY_STATUS } from '../VerificationKeyRegistry.js';

describe('VerificationKeyRegistry', () => {
  // Mock verification key for testing
  const mockVerificationKey = {
    alpha: ['1', '2', '3'],
    beta: [['4', '5'], ['6', '7']],
    gamma: ['8', '9', '10'],
    delta: ['11', '12', '13'],
    ic: [['14', '15'], ['16', '17']]
  };

  // Test initialization
  test('should initialize correctly', () => {
    expect(VerificationKeyRegistry).toBeDefined();
    expect(VerificationKeyRegistry.keys).toBeDefined();
    expect(VerificationKeyRegistry.circuitVersions).toBeDefined();
  });

  // Test key registration
  test('should register a verification key with correct parameters', () => {
    const keyId = VerificationKeyRegistry.registerKey({
      circuitId: 'test-circuit',
      version: '1.0.0',
      verificationKey: mockVerificationKey,
      status: KEY_STATUS.ACTIVE,
    });

    expect(keyId).toBeDefined();
    expect(keyId).toMatch(/vk-/);
    
    const key = VerificationKeyRegistry.keys.get(keyId);
    expect(key).toBeDefined();
    expect(key.circuitId).toBe('test-circuit');
    expect(key.version).toBe('1.0.0');
    expect(key.status).toBe(KEY_STATUS.ACTIVE);
  });

  // Test version validation
  test('should reject keys with invalid version format', () => {
    expect(() => {
      VerificationKeyRegistry.registerKey({
        circuitId: 'invalid-version',
        version: '1.0', // Missing patch version
        verificationKey: mockVerificationKey,
      });
    }).toThrow();

    expect(() => {
      VerificationKeyRegistry.registerKey({
        circuitId: 'invalid-version',
        version: 'v1.0.0', // Extra character
        verificationKey: mockVerificationKey,
      });
    }).toThrow();
  });

  // Test key retrieval
  test('should retrieve a registered key by ID', () => {
    // Register a key
    const keyId = VerificationKeyRegistry.registerKey({
      circuitId: 'retrieval-test',
      version: '2.0.0',
      verificationKey: mockVerificationKey,
    });

    // Retrieve the key
    const key = VerificationKeyRegistry.getKey(keyId);
    expect(key).toBeDefined();
    expect(key.circuitId).toBe('retrieval-test');
    expect(key.version).toBe('2.0.0');
    expect(key.key).toEqual(mockVerificationKey);
  });

  // Test latest key retrieval
  test('should retrieve the latest key for a circuit', () => {
    // Register multiple versions
    VerificationKeyRegistry.registerKey({
      circuitId: 'multi-version',
      version: '1.0.0',
      verificationKey: mockVerificationKey,
    });
    
    VerificationKeyRegistry.registerKey({
      circuitId: 'multi-version',
      version: '1.1.0',
      verificationKey: mockVerificationKey,
    });
    
    const latestKeyId = VerificationKeyRegistry.registerKey({
      circuitId: 'multi-version',
      version: '2.0.0',
      verificationKey: mockVerificationKey,
    });

    // Get latest version
    const latestKey = VerificationKeyRegistry.getLatestKey('multi-version');
    expect(latestKey).toBeDefined();
    expect(latestKey.version).toBe('2.0.0');
  });

  // Test compatibility checking
  test('should correctly determine compatibility between versions', () => {
    // Register multiple versions
    VerificationKeyRegistry.registerKey({
      circuitId: 'compat-test',
      version: '1.0.0',
      verificationKey: mockVerificationKey,
    });
    
    VerificationKeyRegistry.registerKey({
      circuitId: 'compat-test',
      version: '1.1.0',
      verificationKey: mockVerificationKey,
    });
    
    VerificationKeyRegistry.registerKey({
      circuitId: 'compat-test',
      version: '2.0.0',
      verificationKey: mockVerificationKey,
    });

    // Check compatibility
    expect(VerificationKeyRegistry.areVersionsCompatible('compat-test', '1.0.0', '1.1.0')).toBe(true);
    expect(VerificationKeyRegistry.areVersionsCompatible('compat-test', '1.0.0', '2.0.0')).toBe(false);
  });

  // Test artifact path registration
  test('should register and retrieve artifact paths', () => {
    // Register paths
    const artifacts = {
      wasmFile: '/path/to/circuit.wasm',
      zkeyFile: '/path/to/circuit.zkey',
      verificationKeyFile: '/path/to/verification_key.json',
      r1csFile: '/path/to/circuit.r1cs',
    };

    const result = VerificationKeyRegistry.registerArtifactPaths(
      'artifact-test',
      '1.0.0',
      artifacts
    );

    expect(result).toBe(true);
    
    // Retrieve paths
    const retrievedPaths = VerificationKeyRegistry.getArtifactPaths('artifact-test', '1.0.0');
    expect(retrievedPaths).toBeDefined();
    expect(retrievedPaths.wasmFile).toBe(artifacts.wasmFile);
    expect(retrievedPaths.zkeyFile).toBe(artifacts.zkeyFile);
  });

  // Test key status updating
  test('should update key status', () => {
    // Register a key
    const keyId = VerificationKeyRegistry.registerKey({
      circuitId: 'status-test',
      version: '1.0.0',
      verificationKey: mockVerificationKey,
      status: KEY_STATUS.ACTIVE,
    });

    // Update status
    const result = VerificationKeyRegistry.updateKeyStatus(
      keyId,
      KEY_STATUS.DEPRECATED,
      'Superseded by newer version'
    );

    expect(result).toBeDefined();
    expect(result.oldStatus).toBe(KEY_STATUS.ACTIVE);
    expect(result.newStatus).toBe(KEY_STATUS.DEPRECATED);
    
    // Verify status was updated
    const key = VerificationKeyRegistry.getKey(keyId);
    expect(key.status).toBe(KEY_STATUS.DEPRECATED);
  });

  // Test listing keys for a circuit
  test('should list all keys for a circuit', () => {
    // Register multiple versions
    VerificationKeyRegistry.registerKey({
      circuitId: 'listing-test',
      version: '1.0.0',
      verificationKey: mockVerificationKey,
    });
    
    VerificationKeyRegistry.registerKey({
      circuitId: 'listing-test',
      version: '1.1.0',
      verificationKey: mockVerificationKey,
    });

    // List keys
    const keys = VerificationKeyRegistry.listKeysForCircuit('listing-test');
    expect(keys).toBeDefined();
    expect(keys.length).toBe(2);
    expect(keys[0].version).toBe('1.0.0');
    expect(keys[1].version).toBe('1.1.0');
  });

  // Test key integrity verification
  test('should verify key integrity', () => {
    // Register a key
    const keyId = VerificationKeyRegistry.registerKey({
      circuitId: 'integrity-test',
      version: '1.0.0',
      verificationKey: mockVerificationKey,
    });

    // Verify the same key
    const isValid = VerificationKeyRegistry.verifyKeyIntegrity(keyId, mockVerificationKey);
    expect(isValid).toBe(true);

    // Verify a modified key
    const modifiedKey = { ...mockVerificationKey, alpha: ['5', '6', '7'] };
    const isInvalid = VerificationKeyRegistry.verifyKeyIntegrity(keyId, modifiedKey);
    expect(isInvalid).toBe(false);
  });

  // Test registry export/import
  test('should export and import registry data', () => {
    // Register a key for export
    const exportKeyId = VerificationKeyRegistry.registerKey({
      circuitId: 'export-test',
      version: '1.0.0',
      verificationKey: mockVerificationKey,
    });

    // Export registry
    const exportData = VerificationKeyRegistry.exportRegistry();
    expect(exportData).toBeDefined();
    
    // Create a fresh registry (for testing only)
    const tempRegistry = { ...VerificationKeyRegistry };
    tempRegistry.keys = new Map();
    tempRegistry.circuitVersions = new Map();
    
    // Import registry data
    const importResult = tempRegistry.importRegistry(exportData);
    expect(importResult).toBeDefined();
    expect(importResult.keysImported).toBeGreaterThan(0);
    
    // Verify imported data
    expect(tempRegistry.keys.has(exportKeyId)).toBe(true);
  });
});