/**
 * zkCircuitRegistry.js - Circuit versioning registry for the ZK Proof of Funds system
 * 
 * This module provides a centralized registry of all circuit versions, their compatibility
 * relationships, and access to their artifacts (wasm, zkey, vkey files). It ensures
 * that proofs generated with specific circuit versions can be correctly verified.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module works like a library catalog system for our privacy-protecting mathematical formulas.
 * Just as a library keeps track of different editions of books, this system:
 * 
 * 1. CATALOG MANAGEMENT: Maintains a central directory of all available verification formulas
 *    (circuits), similar to how a library catalog tracks all available books.
 * 
 * 2. VERSION CONTROL: Tracks different versions of each formula, like how libraries
 *    track different editions of the same book, ensuring we can use the right version.
 * 
 * 3. COMPATIBILITY CHECKING: Determines whether older verifications can work with
 *    newer systems, similar to checking if a DVD will play in different DVD players.
 * 
 * 4. RESOURCE FINDER: Locates all the necessary files needed for a verification,
 *    like a librarian who can find all associated materials for a particular topic.
 * 
 * Business value: Ensures that financial verifications remain valid over time even as
 * the system evolves, prevents compatibility issues that could invalidate user proofs,
 * and simplifies the technical complexity of managing different verification methods.
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
 * Used to identify which circuit implementation to use for each proof type
 */
const CIRCUIT_TYPES = {
  STANDARD: 'standard',
  THRESHOLD: 'threshold',
  MAXIMUM: 'maximum'
};

/**
 * Default circuit registry data structure
 * Used when no registry file exists or when resetting the registry
 */
const DEFAULT_REGISTRY = {
  buildTimestamp: null,
  circuits: []
};

/**
 * Load the circuit registry from disk
 * Reads the registry JSON file or returns the default registry if not found
 * 
 * @returns {Object} The circuit registry object containing all circuit metadata
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
 * Returns an array of circuit metadata sorted by version (newest first)
 * 
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
 * Returns the most recent version based on semantic versioning
 * 
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @returns {Object|null} Circuit metadata or null if not found
 */
function getLatestCircuitVersion(circuitType) {
  const versions = getCircuitVersions(circuitType);
  return versions.length > 0 ? versions[0] : null;
}

/**
 * Get a specific circuit version
 * Retrieves the exact circuit version requested
 * 
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
 * Determines if proofs generated with one circuit version can be verified with another
 * 
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
 * Returns paths to the wasm, zkey, vkey, and metadata files for a circuit
 * 
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
 * Useful when trying to verify proofs generated with older circuit versions
 * 
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
 * Estimates the memory needed for proof generation and verification
 * 
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

  // If we have metadata with constraints, use that for a better estimate
  if (circuit.constraints) {
    // Approximate memory usage based on constraint count
    // This is a simplified estimate and would need calibration
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