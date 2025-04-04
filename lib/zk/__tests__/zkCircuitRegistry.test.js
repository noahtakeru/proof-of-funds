/**
 * Tests for zkCircuitRegistry.js module
 */

// Mock file system for testing
import { jest } from '@jest/globals';
import fs from 'fs';

// Setup mocks
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

// Import module to test
import zkCircuitRegistry from '../zkCircuitRegistry.js';

describe('ZK Circuit Registry', () => {
  // Sample registry data for tests
  const sampleRegistry = {
    buildTimestamp: '2025-03-30T08:00:00.000Z',
    circuits: [
      {
        name: 'StandardProof',
        type: 'standard',
        version: 'v1.0.0',
        description: 'Standard proof of funds',
        constraints: 5000,
        path: 'standard/v1.0.0'
      },
      {
        name: 'ThresholdProof',
        type: 'threshold',
        version: 'v1.0.0',
        description: 'Threshold proof of funds',
        constraints: 8000,
        path: 'threshold/v1.0.0'
      },
      {
        name: 'MaximumProof',
        type: 'maximum',
        version: 'v1.0.0',
        description: 'Maximum proof of funds',
        constraints: 8000,
        path: 'maximum/v1.0.0'
      },
      {
        name: 'StandardProof',
        type: 'standard',
        version: 'v1.1.0',
        description: 'Standard proof of funds (optimized)',
        constraints: 4500,
        path: 'standard/v1.1.0'
      }
    ]
  };
  
  beforeEach(() => {
    // Reset mocked functions before each test
    jest.clearAllMocks();
    
    // Mock fs.existsSync to return true for registry path
    fs.existsSync.mockImplementation(path => true);
    
    // Mock fs.readFileSync to return sample registry
    fs.readFileSync.mockImplementation(() => JSON.stringify(sampleRegistry));
  });
  
  describe('loadRegistry', () => {
    it('should load registry successfully', () => {
      const registry = zkCircuitRegistry.loadRegistry();
      
      expect(registry).toEqual(sampleRegistry);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });
    
    it('should return default registry when file does not exist', () => {
      // Mock fs.existsSync to return false
      fs.existsSync.mockImplementation(() => false);
      
      const registry = zkCircuitRegistry.loadRegistry();
      
      expect(registry).toHaveProperty('buildTimestamp');
      expect(registry).toHaveProperty('circuits');
      expect(registry.circuits).toEqual([]);
    });
    
    it('should return default registry when file read fails', () => {
      // Mock fs.readFileSync to throw error
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });
      
      const registry = zkCircuitRegistry.loadRegistry();
      
      expect(registry).toHaveProperty('buildTimestamp');
      expect(registry).toHaveProperty('circuits');
      expect(registry.circuits).toEqual([]);
    });
  });
  
  describe('getCircuitVersions', () => {
    it('should return all versions of a circuit type', () => {
      const versions = zkCircuitRegistry.getCircuitVersions('standard');
      
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe('v1.1.0'); // Newest first
      expect(versions[1].version).toBe('v1.0.0');
    });
    
    it('should return empty array for unknown circuit type', () => {
      const versions = zkCircuitRegistry.getCircuitVersions('unknown');
      
      expect(versions).toHaveLength(0);
    });
  });
  
  describe('getLatestCircuitVersion', () => {
    it('should return the latest version of a circuit type', () => {
      const latest = zkCircuitRegistry.getLatestCircuitVersion('standard');
      
      expect(latest).not.toBeNull();
      expect(latest.version).toBe('v1.1.0');
    });
    
    it('should return null for unknown circuit type', () => {
      const latest = zkCircuitRegistry.getLatestCircuitVersion('unknown');
      
      expect(latest).toBeNull();
    });
  });
  
  describe('getCircuitVersion', () => {
    it('should return a specific circuit version', () => {
      const version = zkCircuitRegistry.getCircuitVersion('standard', 'v1.0.0');
      
      expect(version).not.toBeNull();
      expect(version.name).toBe('StandardProof');
      expect(version.version).toBe('v1.0.0');
    });
    
    it('should return null for unknown circuit type', () => {
      const version = zkCircuitRegistry.getCircuitVersion('unknown', 'v1.0.0');
      
      expect(version).toBeNull();
    });
    
    it('should return null for unknown version', () => {
      const version = zkCircuitRegistry.getCircuitVersion('standard', 'v2.0.0');
      
      expect(version).toBeNull();
    });
  });
  
  describe('areCircuitsCompatible', () => {
    it('should return true for identical versions', () => {
      const compatible = zkCircuitRegistry.areCircuitsCompatible('standard', 'v1.0.0', 'v1.0.0');
      
      expect(compatible).toBe(true);
    });
    
    it('should return true for compatible versions (same major)', () => {
      const compatible = zkCircuitRegistry.areCircuitsCompatible('standard', 'v1.0.0', 'v1.1.0');
      
      expect(compatible).toBe(true);
    });
    
    it('should return false for incompatible versions (different major)', () => {
      const compatible = zkCircuitRegistry.areCircuitsCompatible('standard', 'v1.0.0', 'v2.0.0');
      
      expect(compatible).toBe(false);
    });
  });
  
  describe('getCircuitArtifactPaths', () => {
    it('should return correct paths for a valid circuit version', () => {
      const paths = zkCircuitRegistry.getCircuitArtifactPaths('standard', 'v1.0.0');
      
      expect(paths).not.toBeNull();
      expect(paths).toHaveProperty('wasmPath');
      expect(paths).toHaveProperty('zkeyPath');
      expect(paths).toHaveProperty('vkeyPath');
      expect(paths).toHaveProperty('metadataPath');
      
      // Check that paths include the circuit name
      expect(paths.wasmPath).toContain('StandardProof');
    });
    
    it('should return null for unknown circuit version', () => {
      const paths = zkCircuitRegistry.getCircuitArtifactPaths('standard', 'v2.0.0');
      
      expect(paths).toBeNull();
    });
  });
  
  describe('findCompatibleCircuit', () => {
    it('should find exact match when available', () => {
      const circuit = zkCircuitRegistry.findCompatibleCircuit('standard', 'v1.0.0');
      
      expect(circuit).not.toBeNull();
      expect(circuit.version).toBe('v1.0.0');
    });
    
    it('should find compatible version when exact match not available', () => {
      // Mock registry with only v1.1.0 available
      const modifiedRegistry = {
        ...sampleRegistry,
        circuits: sampleRegistry.circuits.filter(c => !(c.type === 'standard' && c.version === 'v1.0.0'))
      };
      fs.readFileSync.mockImplementation(() => JSON.stringify(modifiedRegistry));
      
      const circuit = zkCircuitRegistry.findCompatibleCircuit('standard', 'v1.0.0');
      
      expect(circuit).not.toBeNull();
      expect(circuit.version).toBe('v1.1.0'); // Compatible with v1.0.0
    });
    
    it('should return null when no compatible version available', () => {
      const circuit = zkCircuitRegistry.findCompatibleCircuit('standard', 'v2.0.0');
      
      expect(circuit).toBeNull();
    });
  });
  
  describe('getCircuitMemoryRequirements', () => {
    it('should return memory requirements for a valid circuit', () => {
      const requirements = zkCircuitRegistry.getCircuitMemoryRequirements('standard', 'v1.0.0');
      
      expect(requirements).toHaveProperty('proving');
      expect(requirements).toHaveProperty('verifying');
      expect(requirements.proving).toBeGreaterThan(0);
      expect(requirements.verifying).toBeGreaterThan(0);
    });
    
    it('should return default values for unknown circuit', () => {
      const requirements = zkCircuitRegistry.getCircuitMemoryRequirements('unknown', 'v1.0.0');
      
      expect(requirements).toHaveProperty('proving');
      expect(requirements).toHaveProperty('verifying');
      expect(requirements.proving).toBeGreaterThan(0);
      expect(requirements.verifying).toBeGreaterThan(0);
    });
  });
});