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

// Import error handling components using CommonJS
const { 
  InputError, 
  ProofError, 
  ProofSerializationError,
  SecurityError
} = require('./zkErrorHandler.cjs');
const { zkErrorLogger } = require('./zkErrorLogger.cjs');

// Current proof format version
const PROOF_FORMAT_VERSION = '1.0.0';

// Get library version from package.json if available
let LIBRARY_VERSION = '1.0.0';
try {
  // We'll use a static version for now to avoid require/import inconsistency
  // This will be replaced with a dynamic import in a future update
  LIBRARY_VERSION = '1.0.0';
} catch (e) {
  // Log error but continue with default version
  zkErrorLogger.log('WARNING', 'Failed to load package.json for version info', { 
    details: { error: e.message }
  });
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
  // Validate required inputs
  if (!proof || !publicSignals) {
    throw new InputError('Invalid proof data: proof and publicSignals are required', {
      code: 7001, // INPUT_VALIDATION_FAILED
      recoverable: false,
      userFixable: true,
      recommendedAction: 'Provide both proof and publicSignals arguments'
    });
  }

  if (!options || !options.type || !options.version) {
    throw new InputError('Invalid options: type and version are required', {
      code: 7002, // INPUT_MISSING_REQUIRED
      recoverable: false,
      userFixable: true,
      recommendedAction: 'Provide options with type and version properties'
    });
  }

  // Validate proof type
  if (!Object.values(PROOF_TYPES).includes(options.type)) {
    throw new InputError(`Invalid proof type: ${options.type}`, {
      code: 7003, // INPUT_TYPE_ERROR
      recoverable: false,
      userFixable: true,
      recommendedAction: `Use one of the valid proof types: ${Object.values(PROOF_TYPES).join(', ')}`
    });
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
    throw new InputError('Invalid serialized proof: input is empty', {
      code: 7002, // INPUT_MISSING_REQUIRED
      recoverable: false,
      userFixable: true,
      recommendedAction: 'Provide a non-empty serialized proof string'
    });
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
      throw new ProofError('Invalid proof format', {
        code: 2003, // PROOF_SERIALIZATION_ERROR
        recoverable: false, 
        details: { container }
      });
    }

    if (!container.circuit ||
      !container.circuit.type ||
      !container.circuit.version) {
      throw new ProofError('Invalid proof circuit metadata', {
        code: 2003, // PROOF_SERIALIZATION_ERROR
        recoverable: false,
        details: { container }
      });
    }

    if (!container.proof ||
      !container.proof.data ||
      !container.proof.publicSignals) {
      throw new ProofError('Invalid proof data', {
        code: 2003, // PROOF_SERIALIZATION_ERROR
        recoverable: false,
        details: { container }
      });
    }

    // Check version compatibility
    checkVersionCompatibility(container.format.version);

    return container;
  } catch (error) {
    // Log the error with context
    zkErrorLogger.logError(error, {
      operation: 'deserializeProof',
      context: { serializedLength: serialized.length }
    });
    
    // Re-throw as a ProofSerializationError if it's not already a custom error
    if (error.name === 'Error') {
      throw new ProofSerializationError(`Failed to deserialize proof: ${error.message}`, {
        code: 2003, // PROOF_SERIALIZATION_ERROR
        recoverable: false,
        details: { originalError: error.message }
      });
    }
    
    // Otherwise just re-throw the existing error
    throw error;
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
  try {
    // Deserialize if string
    const container = typeof proofContainer === 'string'
      ? deserializeProof(proofContainer)
      : proofContainer;

    // Validate container
    if (!container || !container.proof || !container.proof.data || !container.proof.publicSignals) {
      throw new ProofError('Invalid proof container', {
        code: 2004, // PROOF_INPUT_INVALID
        recoverable: false,
        details: { container }
      });
    }

    return {
      proof: container.proof.data,
      publicSignals: container.proof.publicSignals,
      circuitType: container.circuit.type,
      circuitVersion: container.circuit.version
    };
  } catch (error) {
    // Log the error
    zkErrorLogger.logError(error, {
      operation: 'extractProofForVerification',
      context: { 
        containerType: typeof proofContainer,
        isString: typeof proofContainer === 'string'
      }
    });
    
    // Re-throw the existing error if it's already a custom error type
    if (error.name !== 'Error') {
      throw error;
    }
    
    // Otherwise wrap in a ProofError
    throw new ProofError(`Failed to extract proof for verification: ${error.message}`, {
      code: 2004, // PROOF_INPUT_INVALID
      recoverable: false,
      details: { originalError: error.message }
    });
  }
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
  try {
    // Deserialize if string
    const container = typeof proofContainer === 'string'
      ? deserializeProof(proofContainer)
      : proofContainer;

    // Validate container
    if (!container || !container.metadata) {
      throw new ProofError('Invalid proof container or missing metadata', {
        code: 2004, // PROOF_INPUT_INVALID
        recoverable: false,
        details: { container }
      });
    }

    return {
      ...container.metadata,
      circuitType: container.circuit.type,
      circuitVersion: container.circuit.version,
      formatVersion: container.format.version
    };
  } catch (error) {
    // Log the error
    zkErrorLogger.logError(error, {
      operation: 'getProofMetadata',
      context: { 
        containerType: typeof proofContainer,
        isString: typeof proofContainer === 'string'
      }
    });
    
    // Re-throw the existing error if it's already a custom error type
    if (error.name !== 'Error') {
      throw error;
    }
    
    // Otherwise wrap in a ProofError
    throw new ProofError(`Failed to extract proof metadata: ${error.message}`, {
      code: 2004, // PROOF_INPUT_INVALID
      recoverable: false,
      details: { originalError: error.message }
    });
  }
}

/**
 * Check if the proof format version is compatible with the current library
 * @param {string} version - Proof format version to check
 * @throws {Error} If the version is incompatible
 * @private
 */
function checkVersionCompatibility(version) {
  try {
    // Parse semantic versions
    const currentVersion = PROOF_FORMAT_VERSION.split('.').map(Number);
    const proofVersion = version.split('.').map(Number);

    // Major version must match for compatibility
    if (proofVersion[0] !== currentVersion[0]) {
      throw new ProofError(
        `Incompatible proof format version: ${version} is not compatible with current version ${PROOF_FORMAT_VERSION}`,
        {
          code: 2005, // PROOF_TYPE_UNSUPPORTED
          recoverable: false,
          userFixable: false,
          details: { 
            proofVersion: version, 
            currentVersion: PROOF_FORMAT_VERSION 
          },
          recommendedAction: `Use proofs generated with version ${currentVersion[0]}.x.x`
        }
      );
    }

    // If the proof's minor version is greater than our library's, we may not support all features
    if (proofVersion[1] > currentVersion[1]) {
      // Log warning instead of console.warn
      zkErrorLogger.log('WARNING', 
        `Proof format version ${version} is newer than the current library version ${PROOF_FORMAT_VERSION}. Some features may not be supported.`,
        {
          details: { 
            proofVersion: version, 
            currentVersion: PROOF_FORMAT_VERSION 
          }
        }
      );
    }
  } catch (error) {
    // Handle non-ProofError errors (like parsing errors)
    if (error.name !== 'ProofError') {
      zkErrorLogger.logError(error, {
        operation: 'checkVersionCompatibility',
        context: { version }
      });
      
      throw new ProofError(`Version compatibility check failed: ${error.message}`, {
        code: 2003, // PROOF_SERIALIZATION_ERROR
        recoverable: false,
        details: { version, originalError: error.message }
      });
    }
    
    // Re-throw ProofErrors
    throw error;
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
  try {
    // In browser
    if (typeof window !== 'undefined' && window.btoa) {
      return window.btoa(unescape(encodeURIComponent(str)));
    }

    // In Node.js
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str).toString('base64');
    }

    throw new SecurityError('Base64 encoding not supported in this environment', {
      code: 6001, // SECURITY_PERMISSION_DENIED
      recoverable: false,
      userFixable: false,
      recommendedAction: 'Use a modern browser or Node.js environment'
    });
  } catch (error) {
    // Log the error
    zkErrorLogger.logError(error, {
      operation: 'base64Encode',
      context: { inputLength: str.length }
    });
    
    // Re-throw with proper context
    throw new ProofSerializationError(`Failed to encode proof data: ${error.message}`, {
      code: 2003, // PROOF_SERIALIZATION_ERROR
      recoverable: false,
      details: { originalError: error.message }
    });
  }
}

/**
 * Decode a Base64 string
 * @param {string} base64 - Base64-encoded string
 * @returns {string} Decoded string
 * @private
 */
function base64Decode(base64) {
  try {
    // In browser
    if (typeof window !== 'undefined' && window.atob) {
      return decodeURIComponent(escape(window.atob(base64)));
    }

    // In Node.js
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf8');
    }

    throw new SecurityError('Base64 decoding not supported in this environment', {
      code: 6001, // SECURITY_PERMISSION_DENIED
      recoverable: false,
      userFixable: false,
      recommendedAction: 'Use a modern browser or Node.js environment'
    });
  } catch (error) {
    // Log the error
    zkErrorLogger.logError(error, {
      operation: 'base64Decode',
      context: { inputLength: base64.length }
    });
    
    // Re-throw with proper context
    throw new ProofSerializationError(`Failed to decode proof data: ${error.message}`, {
      code: 2003, // PROOF_SERIALIZATION_ERROR
      recoverable: false,
      details: { originalError: error.message }
    });
  }
}

/**
 * Export ZK Proof constants and serialization functions
 */
// CommonJS exports
/**
 * Export ZK Proof constants and serialization functions
 * For CommonJS compatibility, we expose all exports from the ESM version
 * in both named and default export formats
 */
const combinedExports = {
  PROOF_TYPES,
  PROOF_FORMAT_VERSION, 
  serializeProof, 
  deserializeProof,
  extractProofForVerification,
  isValidProof,
  getProofMetadata
};

// Export as a single object for CommonJS consumers
module.exports = combinedExports;