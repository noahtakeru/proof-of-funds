/**
 * zkCircuitRegistry.js - Circuit versioning registry for the ZK Proof of Funds system
 * 
 * This module provides a centralized registry of all circuit versions, their compatibility
 * relationships, and access to their artifacts (wasm, zkey, vkey files). It ensures
 * that proofs generated with specific circuit versions can be correctly verified.
 * 
 * Version: 1.0.0
 */

import fs from 'fs';
import path from 'path';

// Base paths
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_DIR = path.resolve(__dirname, 'build');
const REGISTRY_PATH = path.join(BUILD_DIR, 'circuit-registry.json');

/**
 * Circuit types supported by the system
 */
const CIRCUIT_TYPES = {
  STANDARD: 'standard',
  THRESHOLD: 'threshold',
  MAXIMUM: 'maximum'
};

/**
 * Default circuit registry data structure
 */
const DEFAULT_REGISTRY = {
  buildTimestamp: null,
  circuits: []
};

/**
 * Load the circuit registry from disk
 * @returns {Object} The circuit registry object
 */
function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_PATH)) {
      const content = fs.readFileSync(REGISTRY_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('Error loading circuit registry:', error.message);
  }
  
  return { ...DEFAULT_REGISTRY };
}

/**
 * Get all available circuit versions for a given circuit type
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @returns {Array<Object>} Array of circuit metadata objects
 */
function getCircuitVersions(circuitType) {
  const registry = loadRegistry();
  
  return registry.circuits
    .filter(circuit => circuit.type === circuitType)
    .sort((a, b) => {
      // Sort by version (newest first)
      const versionA = a.version.replace('v', '').split('.').map(Number);
      const versionB = b.version.replace('v', '').split('.').map(Number);
      
      // Compare major version
      if (versionA[0] !== versionB[0]) {
        return versionB[0] - versionA[0];
      }
      
      // Compare minor version
      if (versionA[1] !== versionB[1]) {
        return versionB[1] - versionA[1];
      }
      
      // Compare patch version
      return versionB[2] - versionA[2];
    });
}

/**
 * Get the latest circuit version for a given circuit type
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @returns {Object|null} Circuit metadata or null if not found
 */
function getLatestCircuitVersion(circuitType) {
  const versions = getCircuitVersions(circuitType);
  return versions.length > 0 ? versions[0] : null;
}

/**
 * Get a specific circuit version
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} version - The version string (e.g. "v1.0.0")
 * @returns {Object|null} Circuit metadata or null if not found
 */
function getCircuitVersion(circuitType, version) {
  const registry = loadRegistry();
  
  return registry.circuits.find(circuit => 
    circuit.type === circuitType && circuit.version === version
  ) || null;
}

/**
 * Check if two circuit versions are compatible
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} version1 - First circuit version
 * @param {string} version2 - Second circuit version
 * @returns {boolean} True if compatible, false otherwise
 */
function areCircuitsCompatible(circuitType, version1, version2) {
  // If versions are identical, they are compatible
  if (version1 === version2) {
    return true;
  }
  
  // Parse semantic versions
  const v1 = version1.replace('v', '').split('.').map(Number);
  const v2 = version2.replace('v', '').split('.').map(Number);
  
  // Major versions must match for compatibility
  if (v1[0] !== v2[0]) {
    return false;
  }
  
  // For the same major version, we consider them compatible
  // In a real implementation, you might have more complex compatibility rules
  return true;
}

/**
 * Get the file paths for circuit artifacts
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} version - The version string (e.g. "v1.0.0")
 * @returns {Object|null} Object with paths to circuit artifacts or null if not found
 */
function getCircuitArtifactPaths(circuitType, version) {
  const circuit = getCircuitVersion(circuitType, version);
  
  if (!circuit) {
    return null;
  }
  
  const basePath = path.join(BUILD_DIR, circuit.path);
  const circuitName = circuit.name;
  
  return {
    wasmPath: path.join(basePath, `${circuitName}.wasm`),
    zkeyPath: path.join(basePath, `${circuitName}.zkey`),
    vkeyPath: path.join(basePath, `${circuitName}.vkey.json`),
    metadataPath: path.join(basePath, `${circuitName}.metadata.json`)
  };
}

/**
 * Find a compatible circuit version for a proof generated with a specific version
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} proofVersion - The version string of the circuit that generated the proof
 * @returns {Object|null} Compatible circuit metadata or null if not found
 */
function findCompatibleCircuit(circuitType, proofVersion) {
  // First try to find the exact version
  const exactMatch = getCircuitVersion(circuitType, proofVersion);
  if (exactMatch) {
    return exactMatch;
  }
  
  // If no exact match, look for a compatible version
  const versions = getCircuitVersions(circuitType);
  
  for (const circuit of versions) {
    if (areCircuitsCompatible(circuitType, circuit.version, proofVersion)) {
      return circuit;
    }
  }
  
  return null;
}

/**
 * Get memory requirements for a circuit
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} version - The version string (e.g. "v1.0.0")
 * @returns {Object} Object with memory requirements (in MB)
 */
function getCircuitMemoryRequirements(circuitType, version) {
  const circuit = getCircuitVersion(circuitType, version);
  
  if (!circuit) {
    // Default values if circuit not found
    return {
      proving: 500,  // 500 MB for proving
      verifying: 100 // 100 MB for verifying
    };
  }
  
  // Estimate memory requirements based on constraints
  // These are rough estimates and would be refined based on real measurements
  const constraints = circuit.constraints || 0;
  
  return {
    proving: Math.max(100, Math.ceil(constraints * 0.05)),  // 0.05 MB per constraint, minimum 100MB
    verifying: Math.max(50, Math.ceil(constraints * 0.01))  // 0.01 MB per constraint, minimum 50MB
  };
}

export {
  CIRCUIT_TYPES,
  loadRegistry,
  getCircuitVersions,
  getLatestCircuitVersion,
  getCircuitVersion,
  areCircuitsCompatible,
  getCircuitArtifactPaths,
  findCompatibleCircuit,
  getCircuitMemoryRequirements
};

export default {
  CIRCUIT_TYPES,
  loadRegistry,
  getCircuitVersions,
  getLatestCircuitVersion,
  getCircuitVersion,
  areCircuitsCompatible,
  getCircuitArtifactPaths,
  findCompatibleCircuit,
  getCircuitMemoryRequirements
};