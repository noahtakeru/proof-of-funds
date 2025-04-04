/**
 * Verification Key Registry
 * 
 * Manages the storage, retrieval, and validation of verification keys used
 * for zero-knowledge proof verification.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as a central directory for all the verification keys used
 * to check zero-knowledge proofs. Think of it like a secure database of public
 * certificates - applications can look up the correct verification key for a
 * specific circuit, ensure it's authentic, and use it to verify proofs. The
 * registry tracks version compatibility, ensures consistency, and provides
 * a trusted source of verification keys.
 * 
 * Business value: Provides a single source of truth for verification keys,
 * eliminating inconsistencies and ensuring all applications use the correct,
 * secure parameters for proof verification.
 */

import { keccak256, sha256 } from 'js-sha3';
import TamperDetection from './TamperDetection.js';
import { stringifyBigInts, parseBigInts } from './zkUtils.js';

/**
 * Semantic versioning pattern for circuit versions
 */
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Key status enumeration
 */
export const KEY_STATUS = {
  ACTIVE: 'active',           // Key is current and should be used
  DEPRECATED: 'deprecated',   // Key works but is being phased out
  REVOKED: 'revoked',         // Key should not be used (security or other issues)
  TESTING: 'testing',         // Key is for testing only, not production
};

/**
 * Verification Key Registry class
 * Manages versioned verification keys with comprehensive metadata
 */
class VerificationKeyRegistry {
  constructor() {
    // Primary storage for verification keys
    this.keys = new Map();
    
    // Circuit version registry
    this.circuitVersions = new Map();
    
    // Compatibility matrices
    this.compatibilityMatrix = new Map();
    
    // Tamper detection
    this.tamperDetection = new TamperDetection();
    
    // Default validity timestamp (1 year)
    this.defaultValidityDuration = 365 * 24 * 60 * 60 * 1000;
    
    // Registry of canonical file paths
    this.artifactPaths = new Map();
  }
  
  /**
   * Register a new verification key
   * 
   * @param {Object} params - Registration parameters
   * @param {string} params.circuitId - Unique circuit identifier
   * @param {string} params.version - Semantic version of the circuit
   * @param {Object} params.verificationKey - The verification key object
   * @param {string} params.ceremonyId - ID of the ceremony that generated the key
   * @param {string} params.status - Status of the key (from KEY_STATUS)
   * @returns {string} Generated key ID
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function registers a new verification key in the central registry,
   * making it available for applications to use when verifying proofs. Each
   * key is associated with a specific circuit and version, allowing for proper
   * versioning and compatibility tracking. This ensures that applications
   * always use the correct key for the specific circuit version they're working with.
   */
  registerKey(params) {
    const { circuitId, version, verificationKey, ceremonyId, status = KEY_STATUS.ACTIVE } = params;
    
    // Validate required parameters
    if (!circuitId || !version || !verificationKey) {
      throw new Error('Circuit ID, version, and verification key are required');
    }
    
    // Validate version format
    if (!VERSION_PATTERN.test(version)) {
      throw new Error(`Invalid version format: ${version}. Must be in format X.Y.Z`);
    }
    
    // Validate status
    if (!Object.values(KEY_STATUS).includes(status)) {
      throw new Error(`Invalid key status: ${status}`);
    }
    
    // Generate a unique key ID
    const keyId = this.generateKeyId(circuitId, version);
    
    // Check if key already exists
    if (this.keys.has(keyId)) {
      throw new Error(`Verification key already exists for ${circuitId} v${version}`);
    }
    
    // Generate hash of the verification key
    const keyHash = this.hashVerificationKey(verificationKey);
    
    // Add metadata for the key
    const keyEntry = {
      id: keyId,
      circuitId,
      version,
      hash: keyHash,
      ceremonyId: ceremonyId || null,
      registrationTime: Date.now(),
      validUntil: Date.now() + this.defaultValidityDuration,
      status,
      key: verificationKey,
    };
    
    // Register the key
    this.keys.set(keyId, keyEntry);
    
    // Update circuit version registry
    this.registerCircuitVersion(circuitId, version, keyId);
    
    console.log(`Registered verification key ${keyId} for ${circuitId} v${version}`);
    
    return keyId;
  }
  
  /**
   * Register a circuit version in the registry
   * 
   * @param {string} circuitId - Circuit identifier
   * @param {string} version - Semantic version
   * @param {string} keyId - Associated key ID
   * @private
   */
  registerCircuitVersion(circuitId, version, keyId) {
    if (!this.circuitVersions.has(circuitId)) {
      this.circuitVersions.set(circuitId, new Map());
    }
    
    const circuitVersions = this.circuitVersions.get(circuitId);
    
    // Add version entry
    circuitVersions.set(version, {
      keyId,
      releaseDate: Date.now(),
      major: parseInt(version.split('.')[0]),
      minor: parseInt(version.split('.')[1]),
      patch: parseInt(version.split('.')[2]),
    });
    
    // Update compatibility matrix
    this.updateCompatibilityMatrix(circuitId, version);
  }
  
  /**
   * Update the compatibility matrix for a circuit
   * 
   * @param {string} circuitId - Circuit identifier
   * @param {string} version - Version to update matrix for
   * @private
   */
  updateCompatibilityMatrix(circuitId, version) {
    if (!this.compatibilityMatrix.has(circuitId)) {
      this.compatibilityMatrix.set(circuitId, new Map());
    }
    
    const matrix = this.compatibilityMatrix.get(circuitId);
    const circuitVersions = this.circuitVersions.get(circuitId);
    
    // Parse version components
    const currentVersion = circuitVersions.get(version);
    const currentMajor = currentVersion.major;
    const currentMinor = currentVersion.minor;
    
    // Create compatibility entry
    const compatibility = {
      compatibleWith: [],
      incompatibleWith: [],
    };
    
    // Determine compatibility with other versions
    // General rule: Same major version is compatible, different major version is not
    for (const [otherVersion, versionInfo] of circuitVersions.entries()) {
      if (version === otherVersion) continue;
      
      if (versionInfo.major === currentMajor) {
        // Same major version - compatible
        compatibility.compatibleWith.push(otherVersion);
      } else {
        // Different major version - incompatible
        compatibility.incompatibleWith.push(otherVersion);
      }
    }
    
    // Store in compatibility matrix
    matrix.set(version, compatibility);
  }
  
  /**
   * Get a verification key by ID
   * 
   * @param {string} keyId - ID of the verification key
   * @returns {Object} Verification key and metadata
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function retrieves a specific verification key from the registry
   * for use in verifying zero-knowledge proofs. Applications need the correct
   * verification key to validate proofs, and this function provides that key
   * along with metadata about its status and validity. This is a core function
   * used whenever a proof needs to be verified.
   */
  getKey(keyId) {
    // Get key from registry
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Verification key ${keyId} not found`);
    }
    
    // Check if key is revoked
    if (key.status === KEY_STATUS.REVOKED) {
      console.warn(`Warning: Key ${keyId} has been revoked and should not be used`);
    }
    
    // Check if key is expired
    if (Date.now() > key.validUntil) {
      console.warn(`Warning: Key ${keyId} has expired`);
    }
    
    return {
      id: key.id,
      circuitId: key.circuitId,
      version: key.version,
      hash: key.hash,
      status: key.status,
      validUntil: new Date(key.validUntil).toISOString(),
      key: key.key,
    };
  }
  
  /**
   * Get the latest verification key for a circuit
   * 
   * @param {string} circuitId - Circuit identifier
   * @param {Object} options - Options for key retrieval
   * @param {boolean} options.onlyActive - Only return active keys
   * @returns {Object} Latest verification key and metadata
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function simplifies key management by automatically retrieving the latest
   * active verification key for a circuit. Applications can use this function to
   * always get the most up-to-date key without needing to track version numbers.
   * This ensures that applications stay current with the latest security updates
   * and improvements to the verification keys.
   */
  getLatestKey(circuitId, options = { onlyActive: true }) {
    // Check if circuit exists
    if (!this.circuitVersions.has(circuitId)) {
      throw new Error(`Circuit ${circuitId} not found in registry`);
    }
    
    const circuitVersions = this.circuitVersions.get(circuitId);
    
    // Find latest version using semantic versioning rules
    let latestVersion = null;
    let latestMajor = -1;
    let latestMinor = -1;
    let latestPatch = -1;
    
    for (const [version, versionInfo] of circuitVersions.entries()) {
      // Get the key for this version
      const key = this.keys.get(versionInfo.keyId);
      
      // Skip revoked keys if onlyActive is true
      if (options.onlyActive && key.status !== KEY_STATUS.ACTIVE) {
        continue;
      }
      
      // Check if this is a newer version
      if (versionInfo.major > latestMajor ||
          (versionInfo.major === latestMajor && versionInfo.minor > latestMinor) ||
          (versionInfo.major === latestMajor && versionInfo.minor === latestMinor && versionInfo.patch > latestPatch)) {
        latestVersion = version;
        latestMajor = versionInfo.major;
        latestMinor = versionInfo.minor;
        latestPatch = versionInfo.patch;
      }
    }
    
    if (!latestVersion) {
      throw new Error(`No ${options.onlyActive ? 'active ' : ''}version found for circuit ${circuitId}`);
    }
    
    // Get the key ID for the latest version
    const keyId = circuitVersions.get(latestVersion).keyId;
    
    // Return the key
    return this.getKey(keyId);
  }
  
  /**
   * Check if two circuit versions are compatible
   * 
   * @param {string} circuitId - Circuit identifier
   * @param {string} versionA - First version
   * @param {string} versionB - Second version
   * @returns {boolean} Whether the versions are compatible
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function helps applications determine if proofs generated with one
   * circuit version can be verified with another version's verification key.
   * Compatible versions have the same cryptographic structure despite potentially
   * having different optimizations or minor changes. This enables smoother
   * upgrading of systems by clarifying which versions work together.
   */
  areVersionsCompatible(circuitId, versionA, versionB) {
    // Check if circuit exists
    if (!this.circuitVersions.has(circuitId)) {
      throw new Error(`Circuit ${circuitId} not found in registry`);
    }
    
    // Same version is always compatible
    if (versionA === versionB) return true;
    
    // Check if versions exist
    const circuitVersions = this.circuitVersions.get(circuitId);
    if (!circuitVersions.has(versionA) || !circuitVersions.has(versionB)) {
      throw new Error(`One or both versions not found for circuit ${circuitId}`);
    }
    
    // Check compatibility matrix
    const matrix = this.compatibilityMatrix.get(circuitId);
    const compatA = matrix.get(versionA);
    
    return compatA.compatibleWith.includes(versionB);
  }
  
  /**
   * Register circuit artifact file paths
   * 
   * @param {string} circuitId - Circuit identifier
   * @param {string} version - Circuit version
   * @param {Object} artifacts - File paths to circuit artifacts
   * @returns {boolean} Registration success
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function maps file paths to the cryptographic artifacts needed for
   * proof generation and verification. It creates standardized paths to WASM
   * files, zkey files, and verification keys based on circuit ID and version.
   * This helps applications locate the correct files within the standard
   * directory structure, ensuring they use the right artifacts for each circuit.
   */
  registerArtifactPaths(circuitId, version, artifacts) {
    // Validate required parameters
    if (!circuitId || !version) {
      throw new Error('Circuit ID and version are required');
    }
    
    // Generate artifact path key
    const pathKey = `${circuitId}-${version}`;
    
    // Validate required artifact paths
    const requiredArtifacts = ['wasmFile', 'zkeyFile', 'verificationKeyFile'];
    for (const artifact of requiredArtifacts) {
      if (!artifacts[artifact]) {
        throw new Error(`Missing required artifact path: ${artifact}`);
      }
    }
    
    // Register paths
    this.artifactPaths.set(pathKey, {
      circuitId,
      version,
      paths: {
        wasmFile: artifacts.wasmFile,
        zkeyFile: artifacts.zkeyFile,
        verificationKeyFile: artifacts.verificationKeyFile,
        r1csFile: artifacts.r1csFile || null,
        symbolsFile: artifacts.symbolsFile || null,
      },
      registrationTime: Date.now(),
    });
    
    console.log(`Registered artifact paths for ${circuitId} v${version}`);
    
    return true;
  }
  
  /**
   * Get artifact paths for a circuit version
   * 
   * @param {string} circuitId - Circuit identifier
   * @param {string} version - Circuit version
   * @returns {Object} Artifact file paths
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function provides the canonical file paths to the artifacts needed
   * for proof generation and verification for a specific circuit version.
   * Applications use this to locate the correct files within the standardized
   * directory structure, ensuring consistency across the system. This is
   * particularly important during proof generation, which requires specific
   * circuit artifacts.
   */
  getArtifactPaths(circuitId, version) {
    const pathKey = `${circuitId}-${version}`;
    
    // Check if paths are registered
    if (!this.artifactPaths.has(pathKey)) {
      throw new Error(`No artifact paths registered for ${circuitId} v${version}`);
    }
    
    return this.artifactPaths.get(pathKey).paths;
  }
  
  /**
   * Update the status of a verification key
   * 
   * @param {string} keyId - Key identifier
   * @param {string} newStatus - New status from KEY_STATUS
   * @param {string} reason - Reason for the status change
   * @returns {Object} Updated key information
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function updates the status of a verification key, which affects how
   * it's used in the system. For example, keys can be marked as deprecated
   * when they're being phased out, or revoked if security issues are discovered.
   * This helps maintain the security of the system by controlling which keys
   * are considered valid for use in production environments.
   */
  updateKeyStatus(keyId, newStatus, reason) {
    // Validate key exists
    if (!this.keys.has(keyId)) {
      throw new Error(`Verification key ${keyId} not found`);
    }
    
    // Validate status
    if (!Object.values(KEY_STATUS).includes(newStatus)) {
      throw new Error(`Invalid key status: ${newStatus}`);
    }
    
    // Get key
    const key = this.keys.get(keyId);
    
    // Update status
    const oldStatus = key.status;
    key.status = newStatus;
    key.statusUpdateTime = Date.now();
    key.statusUpdateReason = reason || null;
    
    console.log(`Updated status of key ${keyId} from ${oldStatus} to ${newStatus}`);
    
    return {
      id: key.id,
      circuitId: key.circuitId,
      version: key.version,
      newStatus,
      oldStatus,
      updateTime: new Date(key.statusUpdateTime).toISOString(),
    };
  }
  
  /**
   * List all verification keys for a circuit
   * 
   * @param {string} circuitId - Circuit identifier
   * @param {Object} filters - Optional filters
   * @returns {Array<Object>} List of verification keys
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function provides a comprehensive view of all verification keys
   * available for a specific circuit, including their versions and statuses.
   * This is useful for administrators and developers who need to understand
   * the full history of verification keys for a circuit, or who need to
   * select a specific version for compatibility reasons.
   */
  listKeysForCircuit(circuitId, filters = {}) {
    // Check if circuit exists
    if (!this.circuitVersions.has(circuitId)) {
      throw new Error(`Circuit ${circuitId} not found in registry`);
    }
    
    const circuitVersions = this.circuitVersions.get(circuitId);
    const keys = [];
    
    // Collect keys for each version
    for (const [version, versionInfo] of circuitVersions.entries()) {
      const keyId = versionInfo.keyId;
      const key = this.keys.get(keyId);
      
      // Apply filters if specified
      if (filters.status && key.status !== filters.status) {
        continue;
      }
      
      if (filters.validOnly && Date.now() > key.validUntil) {
        continue;
      }
      
      // Add to result
      keys.push({
        id: key.id,
        circuitId: key.circuitId,
        version,
        hash: key.hash,
        status: key.status,
        validUntil: new Date(key.validUntil).toISOString(),
        registrationTime: new Date(key.registrationTime).toISOString(),
      });
    }
    
    return keys;
  }
  
  /**
   * Verify a key's integrity by checking its hash
   * 
   * @param {string} keyId - Key identifier
   * @param {Object} providedKey - Key to verify
   * @returns {boolean} Whether the key is valid
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function verifies the integrity of a verification key by comparing
   * its hash to the registered hash in the registry. This is essential for
   * security, as it ensures that the verification key hasn't been tampered
   * with since it was registered. Applications can use this function to
   * validate keys before using them to verify proofs.
   */
  verifyKeyIntegrity(keyId, providedKey) {
    // Validate key exists
    if (!this.keys.has(keyId)) {
      throw new Error(`Verification key ${keyId} not found`);
    }
    
    // Get registered key information
    const registeredKey = this.keys.get(keyId);
    
    // Calculate hash of provided key
    const providedHash = this.hashVerificationKey(providedKey);
    
    // Compare hashes
    return providedHash === registeredKey.hash;
  }
  
  /**
   * Export the entire registry for backup or synchronization
   * 
   * @returns {Object} Serialized registry data
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function exports the entire verification key registry, which is
   * useful for backups, synchronization between environments, or migration
   * to new systems. The exported registry includes all verification keys,
   * their metadata, and the complete compatibility matrix, ensuring that
   * the entire state of the registry can be recreated elsewhere.
   */
  exportRegistry() {
    // Prepare data structures for serialization
    const exportData = {
      keys: Array.from(this.keys.entries()).map(([id, key]) => ({
        id,
        circuitId: key.circuitId,
        version: key.version,
        hash: key.hash,
        ceremonyId: key.ceremonyId,
        registrationTime: key.registrationTime,
        validUntil: key.validUntil,
        status: key.status,
        key: stringifyBigInts(key.key),
      })),
      circuitVersions: Array.from(this.circuitVersions.entries()).map(([circuitId, versions]) => ({
        circuitId,
        versions: Array.from(versions.entries()).map(([version, info]) => ({
          version,
          keyId: info.keyId,
          releaseDate: info.releaseDate,
          major: info.major,
          minor: info.minor,
          patch: info.patch,
        })),
      })),
      compatibilityMatrix: Array.from(this.compatibilityMatrix.entries()).map(([circuitId, matrix]) => ({
        circuitId,
        compatibility: Array.from(matrix.entries()).map(([version, compat]) => ({
          version,
          compatibleWith: compat.compatibleWith,
          incompatibleWith: compat.incompatibleWith,
        })),
      })),
      artifactPaths: Array.from(this.artifactPaths.entries()).map(([key, pathInfo]) => ({
        key,
        circuitId: pathInfo.circuitId,
        version: pathInfo.version,
        paths: pathInfo.paths,
        registrationTime: pathInfo.registrationTime,
      })),
      exportTime: Date.now(),
    };
    
    // Add tamper protection
    return this.tamperDetection.protect(exportData);
  }
  
  /**
   * Import registry data from a previous export
   * 
   * @param {Object} exportData - Data from exportRegistry
   * @returns {Object} Import results
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function imports a previously exported registry, allowing the
   * complete state to be restored or synchronized. This is particularly
   * useful when setting up new environments or recovering from backups.
   * The import process validates the integrity of the data using tamper
   * detection to ensure the registry hasn't been modified since export.
   */
  importRegistry(exportData) {
    // Verify data integrity
    if (!this.tamperDetection.verify(exportData)) {
      throw new Error('Registry data integrity check failed');
    }
    
    const data = exportData.data;
    
    // Import keys
    const importedKeys = [];
    data.keys.forEach(keyData => {
      // Don't overwrite existing keys
      if (this.keys.has(keyData.id)) {
        console.warn(`Skipping existing key: ${keyData.id}`);
        return;
      }
      
      // Parse BigInt values in key
      keyData.key = parseBigInts(keyData.key);
      
      // Add to registry
      this.keys.set(keyData.id, keyData);
      importedKeys.push(keyData.id);
    });
    
    // Import circuit versions
    const importedCircuits = [];
    data.circuitVersions.forEach(circuitData => {
      const circuitId = circuitData.circuitId;
      
      if (!this.circuitVersions.has(circuitId)) {
        this.circuitVersions.set(circuitId, new Map());
        importedCircuits.push(circuitId);
      }
      
      const versionMap = this.circuitVersions.get(circuitId);
      circuitData.versions.forEach(versionData => {
        versionMap.set(versionData.version, versionData);
      });
    });
    
    // Import compatibility matrix
    data.compatibilityMatrix.forEach(matrixData => {
      const circuitId = matrixData.circuitId;
      
      if (!this.compatibilityMatrix.has(circuitId)) {
        this.compatibilityMatrix.set(circuitId, new Map());
      }
      
      const matrix = this.compatibilityMatrix.get(circuitId);
      matrixData.compatibility.forEach(compatData => {
        matrix.set(compatData.version, {
          compatibleWith: compatData.compatibleWith,
          incompatibleWith: compatData.incompatibleWith,
        });
      });
    });
    
    // Import artifact paths
    const importedPaths = [];
    data.artifactPaths.forEach(pathData => {
      if (!this.artifactPaths.has(pathData.key)) {
        this.artifactPaths.set(pathData.key, pathData);
        importedPaths.push(pathData.key);
      }
    });
    
    return {
      keysImported: importedKeys.length,
      circuitsImported: importedCircuits.length,
      pathsImported: importedPaths.length,
      importTime: Date.now(),
    };
  }
  
  /**
   * Generate a key ID based on circuit and version
   * 
   * @private
   * @param {string} circuitId - Circuit identifier
   * @param {string} version - Circuit version
   * @returns {string} Generated key ID
   */
  generateKeyId(circuitId, version) {
    // Create a deterministic but unique ID
    const baseString = `${circuitId}-${version}-${Date.now()}`;
    return 'vk-' + sha256(baseString).substring(0, 16);
  }
  
  /**
   * Hash a verification key for integrity checking
   * 
   * @private
   * @param {Object} verificationKey - Verification key object
   * @returns {string} Key hash
   */
  hashVerificationKey(verificationKey) {
    // Convert to string for consistent hashing
    const serialized = JSON.stringify(stringifyBigInts(verificationKey));
    
    // Use SHA-256 for hashing
    return '0x' + sha256(serialized);
  }
}

// Export as singleton
const verificationKeyRegistry = new VerificationKeyRegistry();
export default verificationKeyRegistry;