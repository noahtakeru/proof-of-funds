/**
 * zkProofSerializer.js - Serialization utilities for ZK proofs
 * 
 * This module provides functions to serialize and deserialize zero-knowledge proofs
 * with proper versioning metadata to ensure compatibility across different versions
 * of the ZK infrastructure.
 * 
 * Version: 1.0.0
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as the "packaging system" for our privacy-protecting proofs.
 * Think of it like the process of converting a complex document into a secure,
 * portable format:
 * 
 * 1. PACKAGING: It takes complex mathematical proofs and packages them into
 *    a format that can be easily stored, transmitted, and later unpacked.
 * 
 * 2. VERSION CONTROL: It adds important information like version numbers and
 *    timestamps (similar to adding "Created with Word 2023" to a document), which
 *    ensures we can properly interpret the proof even as our systems evolve.
 * 
 * 3. COMPATIBILITY CHECKING: It verifies that a proof package created with an older
 *    version can still be understood by newer systems, similar to how newer software
 *    can often open files created with older versions.
 * 
 * Business value: Enables proofs to be reliably stored, shared between different
 * systems, and verified at different times while maintaining their integrity and
 * ensuring backward compatibility as the platform evolves.
 */

// Current proof format version
const PROOF_FORMAT_VERSION = '1.0.0';

// Get library version from package.json if available
let LIBRARY_VERSION = '1.0.0';
try {
  const packageJson = require('../../package.json');
  LIBRARY_VERSION = packageJson.version || LIBRARY_VERSION;
} catch (e) {
  // Ignore errors in package.json loading
}

/**
 * ZK Proof types
 */
const PROOF_TYPES = {
  STANDARD: 'standard',
  THRESHOLD: 'threshold',
  MAXIMUM: 'maximum'
};

/**
 * Serialize a ZK proof with metadata
 * @param {Object} proof - The ZK proof data from snarkjs
 * @param {Array} publicSignals - The public signals for verification
 * @param {Object} options - Serialization options
 * @param {string} options.type - Type of proof (standard, threshold, maximum)
 * @param {string} options.version - Circuit version that generated the proof
 * @param {string} [options.walletAddress] - Wallet address associated with the proof
 * @param {string|number} [options.amount] - Amount associated with the proof
 * @param {Object} [options.extra] - Additional metadata to include
 * @returns {string} Base64-encoded serialized proof
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function packages a financial proof into a secure, portable format.
 * Think of it like carefully boxing up a fragile item for shipping:
 * 
 * 1. It takes the mathematical proof (a complex object) and converts it into a standard,
 *    text-based format that can be easily stored or transmitted
 * 
 * 2. It adds important shipping labels (metadata) like:
 *    - What type of proof this is (standard, threshold, maximum)
 *    - When it was created
 *    - What version of our system created it
 *    - Which wallet address it relates to
 * 
 * 3. It then applies a final encoding (like sealing the box) to ensure
 *    the proof arrives intact at its destination
 * 
 * This ensures the proof can be safely stored, sent over networks, or saved
 * to files without losing any critical information.
 */
function serializeProof(proof, publicSignals, options) {
  if (!proof || !publicSignals) {
    throw new Error('Invalid proof data: proof and publicSignals are required');
  }

  if (!options || !options.type || !options.version) {
    throw new Error('Invalid options: type and version are required');
  }

  // Validate proof type
  if (!Object.values(PROOF_TYPES).includes(options.type)) {
    throw new Error(`Invalid proof type: ${options.type}`);
  }

  // Create proof container with metadata
  const container = {
    format: {
      version: PROOF_FORMAT_VERSION,
      type: 'zk-proof-of-funds'
    },
    circuit: {
      type: options.type,
      version: options.version
    },
    proof: {
      data: proof,
      publicSignals: publicSignals
    },
    metadata: {
      createdAt: Date.now(),
      libraryVersion: LIBRARY_VERSION,
      walletAddress: options.walletAddress || null,
      amount: options.amount || null,
      environment: detectEnvironment()
    }
  };

  // Add extra metadata if provided
  if (options.extra && typeof options.extra === 'object') {
    container.metadata = {
      ...container.metadata,
      ...options.extra
    };
  }

  // Serialize to JSON and encode as Base64
  const json = JSON.stringify(container);
  return base64Encode(json);
}

/**
 * Deserialize a ZK proof
 * @param {string} serialized - Base64-encoded serialized proof
 * @returns {Object} Deserialized proof data
 * @throws {Error} If the serialized data is invalid
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function unpacks a proof that was previously packaged for transport.
 * It's like carefully opening a delivery box to retrieve the valuable item inside:
 * 
 * 1. It breaks the seal (decodes the Base64) to access the packed content
 * 
 * 2. It carefully unpacks the proof and all its labeled components
 *    (like removing bubble wrap and reading attached instruction manuals)
 * 
 * 3. It checks that nothing is damaged or missing by verifying all
 *    required parts are present
 * 
 * 4. It ensures the proof format is compatible with our current system
 *    (like checking if a received file can be opened by your software version)
 * 
 * If anything is wrong with the packaged proof (missing parts, wrong format),
 * this function will raise an error rather than return incomplete data.
 */
function deserializeProof(serialized) {
  if (!serialized) {
    throw new Error('Invalid serialized proof: input is empty');
  }

  try {
    // Decode Base64 and parse JSON
    const json = base64Decode(serialized);
    const container = JSON.parse(json);

    // Validate proof container
    if (!container.format ||
      !container.format.version ||
      !container.format.type ||
      container.format.type !== 'zk-proof-of-funds') {
      throw new Error('Invalid proof format');
    }

    if (!container.circuit ||
      !container.circuit.type ||
      !container.circuit.version) {
      throw new Error('Invalid proof circuit metadata');
    }

    if (!container.proof ||
      !container.proof.data ||
      !container.proof.publicSignals) {
      throw new Error('Invalid proof data');
    }

    // Check version compatibility
    checkVersionCompatibility(container.format.version);

    return container;
  } catch (error) {
    throw new Error(`Failed to deserialize proof: ${error.message}`);
  }
}

/**
 * Extract proof data for verification
 * @param {Object|string} proofContainer - Proof container or serialized proof
 * @returns {Object} Object with proof and publicSignals
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function extracts just the essential verification information from a proof.
 * It's like removing just the signed document from a folder full of paperwork:
 * 
 * 1. If given a sealed package (serialized string), it first unpacks it
 * 
 * 2. It locates and extracts only the specific components needed for verification:
 *    - The proof itself (the mathematical evidence)
 *    - The public signals (information that doesn't need to be kept private)
 *    - Information about what type of proof it is and what version
 * 
 * This function is useful when we just want to verify if a proof is valid
 * without needing all the extra metadata and packaging information.
 */
function extractProofForVerification(proofContainer) {
  // Deserialize if string
  const container = typeof proofContainer === 'string'
    ? deserializeProof(proofContainer)
    : proofContainer;

  // Validate container
  if (!container || !container.proof || !container.proof.data || !container.proof.publicSignals) {
    throw new Error('Invalid proof container');
  }

  return {
    proof: container.proof.data,
    publicSignals: container.proof.publicSignals,
    circuitType: container.circuit.type,
    circuitVersion: container.circuit.version
  };
}

/**
 * Check if a proof container is valid
 * @param {Object|string} proofContainer - Proof container or serialized proof
 * @returns {boolean} True if valid
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function quickly checks if a proof package appears to be valid.
 * It's like inspecting a delivered package to make sure it's not damaged:
 * 
 * 1. If it's still sealed (a serialized string), it carefully opens it
 * 
 * 2. It checks that all required sections are present:
 *    - Format information
 *    - Circuit details
 *    - The actual proof data
 *    - Required metadata
 * 
 * 3. It verifies the version is compatible with our current system
 * 
 * Unlike other functions that throw errors when problems are found,
 * this function simply returns true or false, making it ideal for
 * quick validation checks before attempting to use a proof.
 */
function isValidProof(proofContainer) {
  try {
    // Deserialize if string
    const container = typeof proofContainer === 'string'
      ? deserializeProof(proofContainer)
      : proofContainer;

    // Check for required fields
    if (!container ||
      !container.format ||
      !container.circuit ||
      !container.proof ||
      !container.metadata) {
      return false;
    }

    // Check for required proof data
    if (!container.proof.data || !container.proof.publicSignals) {
      return false;
    }

    // Check version compatibility
    checkVersionCompatibility(container.format.version);

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get metadata from a proof container
 * @param {Object|string} proofContainer - Proof container or serialized proof
 * @returns {Object} Proof metadata
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function extracts just the descriptive information about a proof.
 * It's like reading the label on a package without opening it:
 * 
 * 1. If given a sealed package (serialized string), it first unpacks it
 * 
 * 2. It extracts all the descriptive information such as:
 *    - When the proof was created
 *    - What wallet address it relates to
 *    - What amount of funds it verifies
 *    - What type of proof it is (standard, threshold, maximum)
 *    - What version of our system created it
 * 
 * This function is useful when we want to know what a proof is about
 * without processing the actual mathematical components, similar to reading
 * the summary of a document instead of the entire content.
 */
function getProofMetadata(proofContainer) {
  // Deserialize if string
  const container = typeof proofContainer === 'string'
    ? deserializeProof(proofContainer)
    : proofContainer;

  // Validate container
  if (!container || !container.metadata) {
    throw new Error('Invalid proof container or missing metadata');
  }

  return {
    ...container.metadata,
    circuitType: container.circuit.type,
    circuitVersion: container.circuit.version,
    formatVersion: container.format.version
  };
}

/**
 * Check if the proof format version is compatible with the current library
 * @param {string} version - Proof format version to check
 * @throws {Error} If the version is incompatible
 * @private
 */
function checkVersionCompatibility(version) {
  // Parse semantic versions
  const currentVersion = PROOF_FORMAT_VERSION.split('.').map(Number);
  const proofVersion = version.split('.').map(Number);

  // Major version must match for compatibility
  if (proofVersion[0] !== currentVersion[0]) {
    throw new Error(
      `Incompatible proof format version: ${version} is not compatible with current version ${PROOF_FORMAT_VERSION}`
    );
  }

  // If the proof's minor version is greater than our library's, we may not support all features
  if (proofVersion[1] > currentVersion[1]) {
    console.warn(
      `Proof format version ${version} is newer than the current library version ${PROOF_FORMAT_VERSION}. Some features may not be supported.`
    );
  }
}

/**
 * Detect the current environment
 * @returns {string} Environment type ('browser', 'node', 'unknown')
 * @private
 */
function detectEnvironment() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }

  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }

  return 'unknown';
}

/**
 * Encode a string as Base64
 * @param {string} str - String to encode
 * @returns {string} Base64-encoded string
 * @private
 */
function base64Encode(str) {
  // In browser
  if (typeof window !== 'undefined' && window.btoa) {
    return window.btoa(unescape(encodeURIComponent(str)));
  }

  // In Node.js
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64');
  }

  throw new Error('Base64 encoding not supported in this environment');
}

/**
 * Decode a Base64 string
 * @param {string} base64 - Base64-encoded string
 * @returns {string} Decoded string
 * @private
 */
function base64Decode(base64) {
  // In browser
  if (typeof window !== 'undefined' && window.atob) {
    return decodeURIComponent(escape(window.atob(base64)));
  }

  // In Node.js
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  throw new Error('Base64 decoding not supported in this environment');
}

export {
  PROOF_TYPES,
  PROOF_FORMAT_VERSION,
  serializeProof,
  deserializeProof,
  extractProofForVerification,
  isValidProof,
  getProofMetadata
};

export default {
  PROOF_TYPES,
  PROOF_FORMAT_VERSION,
  serializeProof,
  deserializeProof,
  extractProofForVerification,
  isValidProof,
  getProofMetadata
};