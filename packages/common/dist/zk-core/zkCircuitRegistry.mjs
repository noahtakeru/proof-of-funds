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
import { fileURLToPath } from 'url';
// Import error handling modules
import * as zkErrorHandler from '../error-handling/zkErrorHandler.mjs';
import { zkErrorLogger } from '../error-handling/zkErrorLogger.mjs';
// Destructure error classes and related utilities
const { ErrorCode, SystemError, InputError, CircuitVersionError } = zkErrorHandler;
// Base paths
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
 * @throws {SystemError} If registry exists but cannot be read or parsed
 */
function loadRegistry() {
    const operationId = `loadRegistry_${Date.now()}`;
    try {
        if (fs.existsSync(REGISTRY_PATH)) {
            try {
                const content = fs.readFileSync(REGISTRY_PATH, 'utf8');
                try {
                    return JSON.parse(content);
                }
                catch (parseError) {
                    const zkError = new SystemError(`Failed to parse circuit registry: ${parseError.message}`, {
                        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
                        operationId,
                        recoverable: true,
                        details: {
                            path: REGISTRY_PATH,
                            originalError: parseError.message
                        }
                    });
                    zkErrorLogger.logError(zkError, { context: 'loadRegistry.parse' });
                    throw zkError;
                }
            }
            catch (readError) {
                const zkError = new SystemError(`Failed to read circuit registry: ${readError.message}`, {
                    code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
                    operationId,
                    recoverable: true,
                    details: {
                        path: REGISTRY_PATH,
                        originalError: readError.message
                    }
                });
                zkErrorLogger.logError(zkError, { context: 'loadRegistry.read' });
                throw zkError;
            }
        }
    }
    catch (error) {
        // If the error is already a ZKError, just log and re-throw it
        if (zkErrorHandler.isZKError(error)) {
            zkErrorLogger.logError(error, { context: 'loadRegistry' });
            throw error;
        }
        // Otherwise, create a new SystemError
        const zkError = new SystemError(`Error accessing circuit registry: ${error.message}`, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            recoverable: true,
            details: {
                path: REGISTRY_PATH,
                originalError: error.message
            }
        });
        zkErrorLogger.logError(zkError, { context: 'loadRegistry' });
        throw zkError;
    }
    // Return default registry if no registry file exists
    return { ...DEFAULT_REGISTRY };
}
/**
 * Get all available circuit versions for a given circuit type
 * Returns an array of circuit metadata sorted by version (newest first)
 *
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @returns {Array<Object>} Array of circuit metadata objects
 * @throws {InputError} If circuit type is invalid
 * @throws {SystemError} If registry cannot be loaded
 */
function getCircuitVersions(circuitType) {
    const operationId = `getCircuitVersions_${Date.now()}`;
    try {
        // Validate input
        if (!circuitType || !Object.values(CIRCUIT_TYPES).includes(circuitType)) {
            const zkError = new InputError(`Invalid circuit type: ${circuitType}`, {
                code: ErrorCode.INPUT_VALIDATION_FAILED,
                operationId,
                recoverable: true,
                userFixable: true,
                details: {
                    circuitType,
                    validTypes: Object.values(CIRCUIT_TYPES)
                }
            });
            zkErrorLogger.logError(zkError, { context: 'getCircuitVersions.validation' });
            throw zkError;
        }
        const registry = loadRegistry();
        return registry.circuits
            .filter(circuit => circuit.type === circuitType)
            .sort((a, b) => {
            try {
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
            }
            catch (sortError) {
                const zkError = new SystemError(`Failed to sort circuit versions: ${sortError.message}`, {
                    code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
                    operationId,
                    recoverable: true,
                    details: {
                        versions: [a.version, b.version],
                        originalError: sortError.message
                    }
                });
                zkErrorLogger.logError(zkError, { context: 'getCircuitVersions.sort' });
                throw zkError;
            }
        });
    }
    catch (error) {
        // If the error is already a ZKError, just log and re-throw it
        if (zkErrorHandler.isZKError(error)) {
            zkErrorLogger.logError(error, { context: 'getCircuitVersions' });
            throw error;
        }
        // Otherwise, create a new SystemError
        const zkError = new SystemError(`Error retrieving circuit versions: ${error.message}`, {
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
            operationId,
            recoverable: true,
            details: {
                circuitType,
                originalError: error.message
            }
        });
        zkErrorLogger.logError(zkError, { context: 'getCircuitVersions' });
        throw zkError;
    }
}
/**
 * Get the latest circuit version for a given circuit type
 * Returns the most recent version based on semantic versioning
 *
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @returns {Object|null} Circuit metadata or null if not found
 * @throws {InputError} If circuit type is invalid
 */
function getLatestCircuitVersion(circuitType) {
    const operationId = `getLatestCircuitVersion_${Date.now()}`;
    try {
        // Validate input
        if (!circuitType || !Object.values(CIRCUIT_TYPES).includes(circuitType)) {
            const zkError = new InputError(`Invalid circuit type: ${circuitType}`, {
                code: ErrorCode.INPUT_VALIDATION_FAILED,
                operationId,
                recoverable: true,
                userFixable: true,
                details: {
                    circuitType,
                    validTypes: Object.values(CIRCUIT_TYPES)
                }
            });
            zkErrorLogger.logError(zkError, { context: 'getLatestCircuitVersion.validation' });
            throw zkError;
        }
        const versions = getCircuitVersions(circuitType);
        return versions.length > 0 ? versions[0] : null;
    }
    catch (error) {
        // If the error is already a ZKError, just log and re-throw it
        if (zkErrorHandler.isZKError(error)) {
            zkErrorLogger.logError(error, { context: 'getLatestCircuitVersion' });
            throw error;
        }
        // Otherwise, create a new SystemError
        const zkError = new SystemError(`Error retrieving latest circuit version: ${error.message}`, {
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
            operationId,
            recoverable: true,
            details: {
                circuitType,
                originalError: error.message
            }
        });
        zkErrorLogger.logError(zkError, { context: 'getLatestCircuitVersion' });
        throw zkError;
    }
}
/**
 * Get a specific circuit version
 * Retrieves the exact circuit version requested
 *
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} version - The version string (e.g. "v1.0.0")
 * @returns {Object|null} Circuit metadata or null if not found
 * @throws {InputError} If circuit type or version format is invalid
 */
function getCircuitVersion(circuitType, version) {
    const operationId = `getCircuitVersion_${Date.now()}`;
    try {
        // Validate inputs
        if (!circuitType || !Object.values(CIRCUIT_TYPES).includes(circuitType)) {
            const zkError = new InputError(`Invalid circuit type: ${circuitType}`, {
                code: ErrorCode.INPUT_VALIDATION_FAILED,
                operationId,
                recoverable: true,
                userFixable: true,
                details: {
                    circuitType,
                    validTypes: Object.values(CIRCUIT_TYPES)
                }
            });
            zkErrorLogger.logError(zkError, { context: 'getCircuitVersion.typeValidation' });
            throw zkError;
        }
        if (!version || typeof version !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(version)) {
            const zkError = new InputError(`Invalid version format: ${version}`, {
                code: ErrorCode.INPUT_VALIDATION_FAILED,
                operationId,
                recoverable: true,
                userFixable: true,
                details: {
                    version,
                    expectedFormat: 'v1.0.0'
                }
            });
            zkErrorLogger.logError(zkError, { context: 'getCircuitVersion.versionValidation' });
            throw zkError;
        }
        const registry = loadRegistry();
        return registry.circuits.find(circuit => circuit.type === circuitType && circuit.version === version) || null;
    }
    catch (error) {
        // If the error is already a ZKError, just log and re-throw it
        if (zkErrorHandler.isZKError(error)) {
            zkErrorLogger.logError(error, { context: 'getCircuitVersion' });
            throw error;
        }
        // Otherwise, create a new SystemError
        const zkError = new SystemError(`Error retrieving circuit version: ${error.message}`, {
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
            operationId,
            recoverable: true,
            details: {
                circuitType,
                version,
                originalError: error.message
            }
        });
        zkErrorLogger.logError(zkError, { context: 'getCircuitVersion' });
        throw zkError;
    }
}
/**
 * Check if two circuit versions are compatible
 * Determines if proofs generated with one circuit version can be verified with another
 *
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} version1 - First circuit version
 * @param {string} version2 - Second circuit version
 * @returns {boolean} True if compatible, false otherwise
 * @throws {InputError} If circuit type or version format is invalid
 * @throws {CircuitVersionError} If versions cannot be compared
 */
function areCircuitsCompatible(circuitType, version1, version2) {
    const operationId = `areCircuitsCompatible_${Date.now()}`;
    try {
        // Validate inputs
        if (!circuitType || !Object.values(CIRCUIT_TYPES).includes(circuitType)) {
            const zkError = new InputError(`Invalid circuit type: ${circuitType}`, {
                code: ErrorCode.INPUT_VALIDATION_FAILED,
                operationId,
                recoverable: true,
                userFixable: true,
                details: {
                    circuitType,
                    validTypes: Object.values(CIRCUIT_TYPES)
                }
            });
            zkErrorLogger.logError(zkError, { context: 'areCircuitsCompatible.typeValidation' });
            throw zkError;
        }
        if (!version1 || typeof version1 !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(version1)) {
            const zkError = new InputError(`Invalid version1 format: ${version1}`, {
                code: ErrorCode.INPUT_VALIDATION_FAILED,
                operationId,
                recoverable: true,
                userFixable: true,
                details: {
                    version: version1,
                    expectedFormat: 'v1.0.0'
                }
            });
            zkErrorLogger.logError(zkError, { context: 'areCircuitsCompatible.version1Validation' });
            throw zkError;
        }
        if (!version2 || typeof version2 !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(version2)) {
            const zkError = new InputError(`Invalid version2 format: ${version2}`, {
                code: ErrorCode.INPUT_VALIDATION_FAILED,
                operationId,
                recoverable: true,
                userFixable: true,
                details: {
                    version: version2,
                    expectedFormat: 'v1.0.0'
                }
            });
            zkErrorLogger.logError(zkError, { context: 'areCircuitsCompatible.version2Validation' });
            throw zkError;
        }
        // If versions are identical, they are compatible
        if (version1 === version2) {
            return true;
        }
        try {
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
        catch (parseError) {
            const zkError = new CircuitVersionError(`Failed to parse and compare versions: ${parseError.message}`, {
                code: ErrorCode.CIRCUIT_VERSION_MISMATCH,
                operationId,
                recoverable: false,
                details: {
                    version1,
                    version2,
                    originalError: parseError.message
                }
            });
            zkErrorLogger.logError(zkError, { context: 'areCircuitsCompatible.parse' });
            throw zkError;
        }
    }
    catch (error) {
        // If the error is already a ZKError, just log and re-throw it
        if (zkErrorHandler.isZKError(error)) {
            zkErrorLogger.logError(error, { context: 'areCircuitsCompatible' });
            throw error;
        }
        // Otherwise, create a new SystemError
        const zkError = new SystemError(`Error checking circuit compatibility: ${error.message}`, {
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
            operationId,
            recoverable: true,
            details: {
                circuitType,
                version1,
                version2,
                originalError: error.message
            }
        });
        zkErrorLogger.logError(zkError, { context: 'areCircuitsCompatible' });
        throw zkError;
    }
}
/**
 * Get the file paths for circuit artifacts
 * Returns paths to the wasm, zkey, vkey, and metadata files for a circuit
 *
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} version - The version string (e.g. "v1.0.0")
 * @returns {Object|null} Object with paths to circuit artifacts or null if not found
 * @throws {InputError} If circuit type or version format is invalid
 * @throws {SystemError} If file paths cannot be resolved
 */
function getCircuitArtifactPaths(circuitType, version) {
    const operationId = `getCircuitArtifactPaths_${Date.now()}`;
    try {
        // Use getCircuitVersion which includes input validation
        const circuit = getCircuitVersion(circuitType, version);
        if (!circuit) {
            return null;
        }
        try {
            const basePath = path.join(BUILD_DIR, circuit.path);
            const circuitName = circuit.name;
            return {
                wasmPath: path.join(basePath, `${circuitName}.wasm`),
                zkeyPath: path.join(basePath, `${circuitName}.zkey`),
                vkeyPath: path.join(basePath, `${circuitName}.vkey.json`),
                metadataPath: path.join(basePath, `${circuitName}.metadata.json`)
            };
        }
        catch (pathError) {
            const zkError = new SystemError(`Failed to resolve circuit artifact paths: ${pathError.message}`, {
                code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
                operationId,
                recoverable: false,
                details: {
                    circuit,
                    buildDir: BUILD_DIR,
                    originalError: pathError.message
                }
            });
            zkErrorLogger.logError(zkError, { context: 'getCircuitArtifactPaths.resolve' });
            throw zkError;
        }
    }
    catch (error) {
        // If the error is already a ZKError, just log and re-throw it
        if (zkErrorHandler.isZKError(error)) {
            zkErrorLogger.logError(error, { context: 'getCircuitArtifactPaths' });
            throw error;
        }
        // Otherwise, create a new SystemError
        const zkError = new SystemError(`Error retrieving circuit artifact paths: ${error.message}`, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId,
            recoverable: false,
            details: {
                circuitType,
                version,
                originalError: error.message
            }
        });
        zkErrorLogger.logError(zkError, { context: 'getCircuitArtifactPaths' });
        throw zkError;
    }
}
/**
 * Find a compatible circuit version for a proof generated with a specific version
 * Useful when trying to verify proofs generated with older circuit versions
 *
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} proofVersion - The version string of the circuit that generated the proof
 * @returns {Object|null} Compatible circuit metadata or null if not found
 * @throws {InputError} If circuit type or version format is invalid
 * @throws {CircuitVersionError} If versions cannot be compared
 */
function findCompatibleCircuit(circuitType, proofVersion) {
    const operationId = `findCompatibleCircuit_${Date.now()}`;
    try {
        // Use getCircuitVersion which includes input validation
        // First try to find the exact version
        const exactMatch = getCircuitVersion(circuitType, proofVersion);
        if (exactMatch) {
            return exactMatch;
        }
        // If no exact match, look for a compatible version
        try {
            const versions = getCircuitVersions(circuitType);
            for (const circuit of versions) {
                if (areCircuitsCompatible(circuitType, circuit.version, proofVersion)) {
                    return circuit;
                }
            }
        }
        catch (compatError) {
            const zkError = new CircuitVersionError(`Failed to find compatible circuit: ${compatError.message}`, {
                code: ErrorCode.CIRCUIT_VERSION_MISMATCH,
                operationId,
                recoverable: false,
                details: {
                    circuitType,
                    proofVersion,
                    originalError: compatError.message
                }
            });
            zkErrorLogger.logError(zkError, { context: 'findCompatibleCircuit.compat' });
            throw zkError;
        }
        return null;
    }
    catch (error) {
        // If the error is already a ZKError, just log and re-throw it
        if (zkErrorHandler.isZKError(error)) {
            zkErrorLogger.logError(error, { context: 'findCompatibleCircuit' });
            throw error;
        }
        // Otherwise, create a new SystemError
        const zkError = new SystemError(`Error finding compatible circuit: ${error.message}`, {
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
            operationId,
            recoverable: false,
            details: {
                circuitType,
                proofVersion,
                originalError: error.message
            }
        });
        zkErrorLogger.logError(zkError, { context: 'findCompatibleCircuit' });
        throw zkError;
    }
}
/**
 * Get memory requirements for a circuit
 * Estimates the memory needed for proof generation and verification
 *
 * @param {string} circuitType - One of the CIRCUIT_TYPES values
 * @param {string} version - The version string (e.g. "v1.0.0")
 * @returns {Object} Object with memory requirements (in MB)
 * @throws {InputError} If circuit type or version format is invalid
 */
function getCircuitMemoryRequirements(circuitType, version) {
    const operationId = `getCircuitMemoryRequirements_${Date.now()}`;
    try {
        // Use getCircuitVersion which includes input validation
        const circuit = getCircuitVersion(circuitType, version);
        if (!circuit) {
            // Default values if circuit not found
            return {
                proving: 500, // 500 MB for proving
                verifying: 100 // 100 MB for verifying
            };
        }
        try {
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
        catch (calcError) {
            const zkError = new SystemError(`Failed to calculate memory requirements: ${calcError.message}`, {
                code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
                operationId,
                recoverable: true,
                details: {
                    circuit,
                    originalError: calcError.message
                }
            });
            zkErrorLogger.logError(zkError, { context: 'getCircuitMemoryRequirements.calc' });
            throw zkError;
        }
    }
    catch (error) {
        // If the error is already a ZKError, just log and re-throw it
        if (zkErrorHandler.isZKError(error)) {
            zkErrorLogger.logError(error, { context: 'getCircuitMemoryRequirements' });
            throw error;
        }
        // Otherwise, create a new SystemError
        const zkError = new SystemError(`Error retrieving circuit memory requirements: ${error.message}`, {
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
            operationId,
            recoverable: true,
            details: {
                circuitType,
                version,
                originalError: error.message
            }
        });
        zkErrorLogger.logError(zkError, { context: 'getCircuitMemoryRequirements' });
        throw zkError;
    }
}
export { CIRCUIT_TYPES, loadRegistry, getCircuitVersions, getLatestCircuitVersion, getCircuitVersion, areCircuitsCompatible, getCircuitArtifactPaths, findCompatibleCircuit, getCircuitMemoryRequirements };
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
