/**
 * zkCircuitRegistry.cjs - CommonJS wrapper for Circuit versioning registry
 * 
 * This module provides compatibility for CommonJS environments.
 */

const fs = require('fs');
const path = require('path');

// Set up constants
const BUILD_DIR = path.resolve(__dirname, '../build');
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
 */
function getLatestCircuitVersion(circuitType) {
  const versions = getCircuitVersions(circuitType);
  return versions.length > 0 ? versions[0] : null;
}

/**
 * Get a specific circuit version
 */
function getCircuitVersion(circuitType, version) {
  const registry = loadRegistry();

  return registry.circuits.find(circuit =>
    circuit.type === circuitType && circuit.version === version
  ) || null;
}

/**
 * Check if two circuit versions are compatible
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
  return true;
}

/**
 * Get the file paths for circuit artifacts
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

  // If we have metadata with constraints, use that for a better estimate
  if (circuit.constraints) {
    return {
      proving: Math.max(200, Math.ceil(circuit.constraints / 1000) * 50),
      verifying: Math.max(50, Math.ceil(circuit.constraints / 5000) * 50)
    };
  }

  // Fallback to type-based estimates if no constraint info
  switch (circuitType) {
    case CIRCUIT_TYPES.STANDARD:
      return { proving: 300, verifying: 80 };
    case CIRCUIT_TYPES.THRESHOLD:
      return { proving: 400, verifying: 90 };
    case CIRCUIT_TYPES.MAXIMUM:
      return { proving: 400, verifying: 90 };
    default:
      return { proving: 500, verifying: 100 };
  }
}

module.exports = {
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