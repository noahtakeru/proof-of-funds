/**
 * Real Zero-Knowledge Proof Utility Functions
 * 
 * Replaces the mock implementations in zkUtils.js with real, functional
 * implementations that perform actual cryptographic operations.
 * 
 * @module realZkUtils
 */

import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import { Buffer } from 'buffer';

// Use SHA3-256 for consistent hash function
import { keccak256, sha3_256 as sha256 } from 'js-sha3';

// Import error handling utilities with proper .mjs extensions
import {
  ErrorCode,
  SystemError,
  InputError,
  ProofError,
  VerificationError,
  ProofSerializationError,
  isZKError
} from './zkErrorHandler.mjs';

import zkErrorLogger from './zkErrorLogger.mjs';

/**
 * Helper function to get fs.promises in Node.js or a mock implementation in browser
 * Using this avoids dynamic imports for the fs module
 * 
 * @returns {Object} An object with readFile and other fs.promises methods
 */
/**
 * Mock filesystem module for ESM compatibility
 * This creates error objects using our ZK error system for consistent error handling
 */
const mockFsPromises = {
  readFile: () => Promise.reject(new SystemError('File system not available in ESM/browser environment', {
    code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
    operationId: `fsRead_${Date.now()}`,
    recoverable: false,
    details: { environment: 'browser' }
  })),
  writeFile: () => Promise.reject(new SystemError('File system not available in ESM/browser environment', {
    code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
    operationId: `fsWrite_${Date.now()}`,
    recoverable: false,
    details: { environment: 'browser' }
  })),
  access: () => Promise.reject(new SystemError('File system not available in ESM/browser environment', {
    code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
    operationId: `fsAccess_${Date.now()}`,
    recoverable: false,
    details: { environment: 'browser' }
  }))
};

/**
 * Get filesystem promises in a way that doesn't mix module systems
 * This completely avoids any CommonJS requires in an ESM context
 */
async function getFsPromises() {
  // In browser environments, always return the mock
  if (typeof window !== 'undefined') {
    return mockFsPromises;
  }

  // In Node.js environments, use dynamic import for fs module
  try {
    // Using globalThis.process ensures we're in a Node.js environment
    if (globalThis.process && globalThis.process.versions && globalThis.process.versions.node) {
      // Use dynamic import to load fs module (ESM compatible)
      const fsModule = await import('fs/promises');
      return fsModule;
    }
  } catch (e) {
    // Failure means we're not in Node.js or dynamic import failed
    zkErrorLogger.logError(new SystemError('Failed to import fs module', {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId: `fsImport_${Date.now()}`,
      recoverable: false,
      details: { error: e.message }
    }));
  }

  // Default fallback
  return mockFsPromises;
}

/**
 * SNARK field size constant used in ZK proofs
 * 
 * This is the prime number that defines the finite field for the BN254 (alt_bn128) curve
 * commonly used in Ethereum zk-SNARKs. All values in the circuit must be elements of this field.
 * 
 * @constant
 * @type {BigInt}
 */
const SNARK_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Converts a number to the field element representation used in zk circuits
 * @param {number|string|BigInt} value - The number to convert
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {string} Field element representation
 * @throws {InputError} If the input value is of invalid type
 */
export const toFieldElement = (value, options = {}) => {
  const operationId = options.operationId || `toFieldElement_${Date.now()}`;

  try {
    // Ensure we're working with a BigInt
    let bigIntValue;

    if (typeof value === 'bigint') {
      bigIntValue = value;
    } else if (typeof value === 'number' || typeof value === 'string') {
      bigIntValue = BigInt(value);
    } else {
      throw new InputError('Invalid value type for field element conversion', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { valueType: typeof value }
      });
    }

    // Use modulo to ensure value is within field
    const fieldElement = ((bigIntValue % SNARK_FIELD_SIZE) + SNARK_FIELD_SIZE) % SNARK_FIELD_SIZE;

    return fieldElement.toString();
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'realZkUtils.toFieldElement' });
      throw error;
    }

    // Otherwise, wrap with appropriate error
    const inputError = new InputError(`Failed to convert value to field element: ${error.message}`, {
      code: ErrorCode.INPUT_TYPE_ERROR,
      operationId,
      recoverable: false,
      userFixable: true,
      details: { valueType: typeof value, originalError: error.message }
    });

    zkErrorLogger.logError(inputError, { context: 'realZkUtils.toFieldElement' });
    throw inputError;
  }
};

/**
 * Pads an array to the specified length with the provided padding value
 * @param {Array} arr - Array to pad
 * @param {number} length - Target length
 * @param {any} padValue - Value to use for padding
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {Array} Padded array
 * @throws {InputError} If the input array is invalid or length is negative
 */
export const padArray = (arr, length, padValue = 0, options = {}) => {
  const operationId = options.operationId || `padArray_${Date.now()}`;

  try {
    // Validate inputs
    if (!Array.isArray(arr)) {
      throw new InputError('Input must be an array', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { valueType: typeof arr }
      });
    }

    if (typeof length !== 'number' || length < 0) {
      throw new InputError('Length must be a non-negative number', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { length }
      });
    }

    // If array is already long enough, return a slice of the correct length
    if (arr.length >= length) return arr.slice(0, length);

    // Otherwise pad the array
    return [...arr, ...Array(length - arr.length).fill(padValue)];
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'realZkUtils.padArray' });
      throw error;
    }

    // Otherwise, wrap with appropriate error
    const inputError = new InputError(`Failed to pad array: ${error.message}`, {
      code: ErrorCode.INPUT_VALIDATION_FAILED,
      operationId,
      recoverable: false,
      userFixable: true,
      details: {
        arrayLength: Array.isArray(arr) ? arr.length : 'not an array',
        targetLength: length,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(inputError, { context: 'realZkUtils.padArray' });
    throw inputError;
  }
};

/**
 * Serializes a ZK proof for transmission or storage
 * @param {Object} proof - The ZK proof object
 * @param {Array} publicSignals - Public signals array
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {Object} Serialized proof with stringified components
 * @throws {ProofSerializationError} If the proof is invalid or serialization fails
 */
export const serializeZKProof = (proof, publicSignals, options = {}) => {
  const operationId = options.operationId || `serializeProof_${Date.now()}`;

  try {
    // Validate inputs
    if (!proof || typeof proof !== 'object') {
      throw new ProofSerializationError('Invalid proof object provided for serialization', {
        code: ErrorCode.PROOF_SERIALIZATION_ERROR,
        operationId,
        recoverable: false,
        userFixable: false,
        details: { proofType: typeof proof }
      });
    }

    if (!Array.isArray(publicSignals)) {
      throw new ProofSerializationError('Public signals must be an array', {
        code: ErrorCode.PROOF_SERIALIZATION_ERROR,
        operationId,
        recoverable: false,
        userFixable: false,
        details: { publicSignalsType: typeof publicSignals }
      });
    }

    // Convert proof components to strings
    const serializedProof = {
      pi_a: Array.isArray(proof.pi_a) ? proof.pi_a.map(x => x.toString()) : [],
      pi_b: Array.isArray(proof.pi_b) ? proof.pi_b.map(arr => arr.map(x => x.toString())) : [],
      pi_c: Array.isArray(proof.pi_c) ? proof.pi_c.map(x => x.toString()) : [],
      protocol: proof.protocol || 'groth16'
    };

    // Convert signals to strings
    const serializedSignals = publicSignals.map(x => x.toString());

    // Return serialized data
    return {
      proof: serializedProof,
      publicSignals: serializedSignals
    };
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'realZkUtils.serializeZKProof' });
      throw error;
    }

    // Log and wrap with appropriate error
    const serializationError = new ProofSerializationError(`Failed to serialize proof: ${error.message}`, {
      code: ErrorCode.PROOF_SERIALIZATION_ERROR,
      operationId,
      recoverable: true,
      userFixable: false,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(serializationError, { context: 'realZkUtils.serializeZKProof' });
    throw serializationError;
  }
};

/**
 * Deserializes a ZK proof from its string format
 * @param {Object} serializedProof - The serialized proof object
 * @param {Array} serializedPublicSignals - Serialized public signals array
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {Object} The deserialized proof and signals
 * @throws {ProofSerializationError} If deserialization fails or input is invalid
 */
export const deserializeZKProof = (serializedProof, serializedPublicSignals, options = {}) => {
  const operationId = options.operationId || `deserializeProof_${Date.now()}`;

  try {
    // Validate inputs
    if (!serializedProof || typeof serializedProof !== 'object') {
      throw new ProofSerializationError('Invalid serialized proof provided', {
        code: ErrorCode.PROOF_SERIALIZATION_ERROR,
        operationId,
        recoverable: false,
        userFixable: false,
        details: { proofType: typeof serializedProof }
      });
    }

    if (!Array.isArray(serializedPublicSignals)) {
      throw new ProofSerializationError('Serialized public signals must be an array', {
        code: ErrorCode.PROOF_SERIALIZATION_ERROR,
        operationId,
        recoverable: false,
        userFixable: false,
        details: { signalsType: typeof serializedPublicSignals }
      });
    }

    // Convert proof components to BigInts
    const proof = {
      pi_a: Array.isArray(serializedProof.pi_a) ? serializedProof.pi_a.map(x => BigInt(x)) : [],
      pi_b: Array.isArray(serializedProof.pi_b) ? serializedProof.pi_b.map(arr => arr.map(x => BigInt(x))) : [],
      pi_c: Array.isArray(serializedProof.pi_c) ? serializedProof.pi_c.map(x => BigInt(x)) : [],
      protocol: serializedProof.protocol || 'groth16'
    };

    // Convert signals to BigInts
    const publicSignals = serializedPublicSignals.map(x => BigInt(x));

    // Return deserialized data
    return {
      proof,
      publicSignals
    };
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'realZkUtils.deserializeZKProof' });
      throw error;
    }

    // Log and wrap with appropriate error
    const serializationError = new ProofSerializationError(`Failed to deserialize proof: ${error.message}`, {
      code: ErrorCode.PROOF_SERIALIZATION_ERROR,
      operationId,
      recoverable: true,
      userFixable: false,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(serializationError, { context: 'realZkUtils.deserializeZKProof' });
    throw serializationError;
  }
};

/**
 * Generates a hash of a ZK proof for verification purposes
 * @param {Object} proof - The ZK proof object
 * @param {Array} publicSignals - Public signals array
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {string} Hex-encoded hash of the proof
 * @throws {ProofError} If hash generation fails
 */
export const generateZKProofHash = (proof, publicSignals, options = {}) => {
  const operationId = options.operationId || `proofHash_${Date.now()}`;

  try {
    // Serialize the proof and signals for consistent hashing
    const serialized = JSON.stringify(serializeZKProof(proof, publicSignals, { operationId }));

    // Generate SHA3-256 hash
    return '0x' + sha256(serialized);
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'realZkUtils.generateZKProofHash' });
      throw error;
    }

    // Log and wrap with appropriate error
    const proofError = new ProofError(`Failed to generate proof hash: ${error.message}`, {
      code: ErrorCode.PROOF_SERIALIZATION_ERROR,
      operationId,
      recoverable: false,
      userFixable: false,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(proofError, { context: 'realZkUtils.generateZKProofHash' });
    throw proofError;
  }
};

/**
 * Converts a buffer or hex string to a field element array
 * @param {Buffer|string} buffer - The buffer or hex string to convert
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {Promise<Array<string>>} Array of field elements
 * @throws {InputError} If input is invalid or conversion fails
 */
export const bufferToFieldArray = async (buffer, options = {}) => {
  const operationId = options.operationId || `bufferToField_${Date.now()}`;

  try {
    // Convert hex string to buffer if needed
    if (typeof buffer === 'string') {
      // Remove '0x' prefix if present
      const hexString = buffer.startsWith('0x') ? buffer.slice(2) : buffer;

      // Ensure even length
      const paddedHex = hexString.length % 2 === 0 ? hexString : '0' + hexString;

      // Create buffer from hex
      buffer = Buffer.from(paddedHex, 'hex');
    }

    if (!Buffer.isBuffer(buffer)) {
      throw new InputError('Input must be a buffer or hex string', {
        code: ErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { inputType: typeof buffer }
      });
    }

    // Convert each 31-byte chunk to a field element
    const elements = [];
    for (let i = 0; i < buffer.length; i += 31) {
      const chunk = buffer.slice(i, i + 31);
      const hex = '0x' + chunk.toString('hex');
      const fieldElement = toFieldElement(hex, { operationId });
      elements.push(fieldElement);
    }

    return elements;
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'realZkUtils.bufferToFieldArray' });
      throw error;
    }

    // Log and wrap with appropriate error
    const inputError = new InputError(`Failed to convert buffer to field array: ${error.message}`, {
      code: ErrorCode.INPUT_TYPE_ERROR,
      operationId,
      recoverable: false,
      userFixable: true,
      details: {
        inputType: typeof buffer,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(inputError, { context: 'realZkUtils.bufferToFieldArray' });
    throw inputError;
  }
};

/**
 * Normalizes an Ethereum address to a checksummed format
 * @param {string} address - Ethereum address to normalize
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {string} Normalized address
 * @throws {InputError} If address is invalid
 */
export const normalizeAddress = (address, options = {}) => {
  const operationId = options.operationId || `normalizeAddr_${Date.now()}`;

  try {
    if (!address || typeof address !== 'string') {
      throw new InputError('Invalid address', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { addressType: typeof address }
      });
    }

    // Ensure address has 0x prefix
    const prefixedAddress = address.startsWith('0x') ? address : '0x' + address;

    try {
      // Use ethers to format as checksum address
      return ethers.utils.getAddress(prefixedAddress);
    } catch (error) {
      throw new InputError(`Invalid Ethereum address format: ${error.message}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { address: prefixedAddress }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'realZkUtils.normalizeAddress' });
      throw error;
    }

    // Log and wrap with appropriate error
    const inputError = new InputError(`Failed to normalize address: ${error.message}`, {
      code: ErrorCode.INPUT_VALIDATION_FAILED,
      operationId,
      recoverable: false,
      userFixable: true,
      details: {
        address: typeof address === 'string' ? address.substring(0, 8) + '...' : typeof address,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(inputError, { context: 'realZkUtils.normalizeAddress' });
    throw inputError;
  }
};

/**
 * Stringifies a BigInt value for JSON compatibility
 * @param {any} obj - Object that may contain BigInt values
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {any} Object with BigInt values converted to strings
 */
export const stringifyBigInts = (obj, options = {}) => {
  const operationId = options.operationId || `stringifyBigInts_${Date.now()}`;

  try {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map(item => stringifyBigInts(item, { operationId }));
    }

    if (typeof obj === 'object') {
      const result = {};
      for (const key in obj) {
        result[key] = stringifyBigInts(obj[key], { operationId });
      }
      return result;
    }

    return obj;
  } catch (error) {
    // Log error but don't throw (to maintain compatibility with existing code)
    zkErrorLogger.logError(
      new SystemError(`Error in stringifyBigInts: ${error.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: true,
        details: { originalError: error.message }
      }),
      { context: 'realZkUtils.stringifyBigInts' }
    );

    // Return original object in case of error
    return obj;
  }
};

/**
 * Parses stringified BigInt values back to BigInt type
 * @param {any} obj - Object with stringified BigInt values
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {any} Object with restored BigInt values
 */
export const parseBigInts = (obj, options = {}) => {
  const operationId = options.operationId || `parseBigInts_${Date.now()}`;

  try {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string' && /^[0-9]+$/.test(obj)) {
      return BigInt(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => parseBigInts(item, { operationId }));
    }

    if (typeof obj === 'object') {
      const result = {};
      for (const key in obj) {
        result[key] = parseBigInts(obj[key], { operationId });
      }
      return result;
    }

    return obj;
  } catch (error) {
    // Log error but don't throw (to maintain compatibility with existing code)
    zkErrorLogger.logError(
      new SystemError(`Error in parseBigInts: ${error.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: true,
        details: { originalError: error.message }
      }),
      { context: 'realZkUtils.parseBigInts' }
    );

    // Return original object in case of error
    return obj;
  }
};

/**
 * Formats a number to a user-friendly string with appropriate units
 * @param {number|string|BigInt} value - Value to format
 * @param {Object} options - Formatting options
 * @param {number} options.precision - Number of decimal places (default: 2)
 * @param {boolean} options.currency - Format as currency (default: false)
 * @param {boolean} options.compact - Use compact notation (default: false)
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {string} Formatted value
 */
export const formatNumber = (value, options = {}) => {
  const {
    precision = 2,
    currency = false,
    compact = false,
    operationId = `formatNum_${Date.now()}`
  } = options;

  try {
    let numValue;
    try {
      // Convert to number
      numValue = typeof value === 'bigint' ? Number(value) : Number(value);
    } catch (e) {
      return String(value); // Return original value if conversion fails
    }

    if (isNaN(numValue)) {
      return String(value);
    }

    // Format based on options
    if (currency) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      }).format(numValue);
    }

    if (compact && Math.abs(numValue) >= 1000) {
      return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        minimumFractionDigits: precision > 1 ? 1 : 0,
        maximumFractionDigits: precision > 1 ? 1 : 0
      }).format(numValue);
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: precision
    }).format(numValue);
  } catch (error) {
    // Log error but don't throw (formatting is non-critical)
    zkErrorLogger.logError(
      new SystemError(`Error in formatNumber: ${error.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId,
        recoverable: true,
        details: { originalError: error.message }
      }),
      { context: 'realZkUtils.formatNumber' }
    );

    // Return string representation in case of error
    return String(value);
  }
};

/**
 * Real ZK proof generation implementation using snarkjs
 * @param {Object} input - The input parameters for proof generation
 * @param {string} circuitName - The name of the circuit to use
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {Promise<Object>} A real ZK proof
 * @throws {ProofError} If proof generation fails
 */
export const generateZKProof = async (input, circuitName = 'standardProof', options = {}) => {
  const operationId = options.operationId || `genProof_${Date.now()}`;

  // Check that required inputs are available
  if (!input) {
    const inputError = new InputError('Input parameters are required for proof generation', {
      code: ErrorCode.INPUT_MISSING_REQUIRED,
      operationId,
      recoverable: false,
      userFixable: true
    });

    zkErrorLogger.logError(inputError, { context: 'realZkUtils.generateZKProof' });
    throw inputError;
  }

  try {
    // Determine circuit paths based on circuit name
    const wasmPath = `./build/wasm/${circuitName}_js/${circuitName}.wasm`;
    const zkeyPath = `./build/zkey/${circuitName}.zkey`;

    // Use snarkjs to generate the witness with proper validation
    if (!input) {
      throw new InputError('Missing input for witness generation', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true
      });
    }

    try {
      // Attempt to access circuit files to provide better error messages
      const fs = await getFsPromises();
      try {
        await fs.access(wasmPath);
      } catch (e) {
        throw new ProofError(`WASM file not found: ${wasmPath}`, {
          code: ErrorCode.FILE_NOT_FOUND,
          operationId,
          recoverable: false,
          details: { wasmPath }
        });
      }

      try {
        await fs.access(zkeyPath);
      } catch (e) {
        throw new ProofError(`zKey file not found: ${zkeyPath}`, {
          code: ErrorCode.FILE_NOT_FOUND,
          operationId,
          recoverable: false,
          details: { zkeyPath }
        });
      }
    } catch (fsError) {
      // File system access may fail in browser environments - continue anyway
      console.warn('File access check failed:', fsError.message);
    }

    // Generate witness with detailed error tracking
    let witness;
    try {
      const result = await snarkjs.wtns.calculate(input, wasmPath);
      witness = result.witness;

      if (!witness) {
        throw new ProofError('Witness generation failed: empty witness returned', {
          code: ErrorCode.PROOF_GENERATION_FAILED,
          operationId,
          recoverable: false,
          details: { circuitName }
        });
      }
    } catch (witnessError) {
      throw new ProofError(`Witness generation failed: ${witnessError.message}`, {
        code: ErrorCode.PROOF_GENERATION_FAILED,
        operationId,
        recoverable: false,
        details: {
          circuitName,
          witnessError: witnessError.message
        }
      });
    }

    // Generate proof from witness
    try {
      const result = await snarkjs.groth16.prove(zkeyPath, witness);

      if (!result || !result.proof || !result.publicSignals) {
        throw new ProofError('Proof generation failed: incomplete result returned', {
          code: ErrorCode.PROOF_GENERATION_FAILED,
          operationId,
          recoverable: false,
          details: { circuitName }
        });
      }

      // Validate proof structure
      const { proof, publicSignals } = result;
      if (!proof.pi_a || !proof.pi_b || !proof.pi_c ||
        !Array.isArray(proof.pi_a) || proof.pi_a.length < 2 ||
        !Array.isArray(proof.pi_b) || proof.pi_b.length < 2 ||
        !Array.isArray(proof.pi_c) || proof.pi_c.length < 2) {
        throw new ProofError('Proof generation failed: invalid proof structure', {
          code: ErrorCode.PROOF_STRUCTURE_INVALID,
          operationId,
          recoverable: false,
          details: { circuitName, proofStructure: Object.keys(proof) }
        });
      }

      return { proof, publicSignals };
    } catch (proveError) {
      throw new ProofError(`Proof generation failed: ${proveError.message}`, {
        code: ErrorCode.PROOF_GENERATION_FAILED,
        operationId,
        recoverable: false,
        details: {
          circuitName,
          proveError: proveError.message
        }
      });
    }
  } catch (error) {
    // Log the error
    zkErrorLogger.logError(
      error instanceof ProofError ? error :
        new ProofError(`Failed to generate proof: ${error.message}`, {
          code: ErrorCode.PROOF_GENERATION_FAILED,
          operationId,
          recoverable: false,
          details: { circuitName, originalError: error.message }
        }),
      { context: 'realZkUtils.generateZKProof' }
    );

    // No fallbacks - throw the error to be handled properly by the caller
    throw error;
  }
};

/**
 * Real ZK proof verification implementation using snarkjs
 * @param {Object} params - Parameters for proof verification
 * @param {Object} params.proof - The ZK proof to verify
 * @param {Array} params.publicSignals - Public signals for the proof
 * @param {number} params.proofType - The type of proof
 * @param {string} params.circuitName - The name of the circuit used
 * @param {Object} options - Optional parameters
 * @param {string} options.operationId - Unique operation identifier for tracking and debugging
 * @returns {Promise<boolean>} Whether the proof is valid
 * @throws {VerificationError} If verification fails due to system error
 */
export const verifyZKProof = async (params, options = {}) => {
  const operationId = options.operationId || `verifyProof_${Date.now()}`;

  try {
    const { proof, publicSignals, proofType, circuitName = null } = params;

    // Validation
    if (!proof || !publicSignals) {
      const inputError = new InputError('Missing proof or public signals', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          hasProof: !!proof,
          hasPublicSignals: !!publicSignals
        }
      });

      zkErrorLogger.logError(inputError, { context: 'realZkUtils.verifyZKProof' });
      throw inputError;
    }

    // Determine the circuit name if not specified
    const actualCircuitName = circuitName ||
      proofType === 0 ? 'standardProof' :
      proofType === 1 ? 'thresholdProof' :
        proofType === 2 ? 'maximumProof' : 'standardProof';

    try {
      // Get verification key path
      const vkeyPath = `./build/verification_key/${actualCircuitName}.json`;

      // Try to load verification key with robust error handling
      let verificationKey;
      try {
        // Load verification key using fs
        const fs = await getFsPromises();
        const vkeyData = await fs.readFile(vkeyPath, 'utf8');
        verificationKey = JSON.parse(vkeyData);

        if (!verificationKey) {
          throw new Error(`Failed to load verification key: Empty or null result`);
        }

        // Basic validation of verification key structure
        if (!verificationKey.protocol ||
          !verificationKey.curve ||
          !verificationKey.alpha1 ||
          !verificationKey.beta2 ||
          !verificationKey.gamma2 ||
          !verificationKey.delta2) {
          throw new Error('Invalid verification key format: missing required fields');
        }
      } catch (vkError) {
        throw new VerificationError(`Failed to load verification key: ${vkError.message}`, {
          code: ErrorCode.VERIFICATION_KEY_ERROR,
          operationId,
          recoverable: false,
          details: {
            circuitName: actualCircuitName,
            vkeyPath,
            error: vkError.message
          }
        });
      }

      // Validate proof structure before verification
      if (!proof || !proof.pi_a || !proof.pi_b || !proof.pi_c ||
        !Array.isArray(proof.pi_a) || !Array.isArray(proof.pi_b) || !Array.isArray(proof.pi_c)) {
        throw new VerificationError('Invalid proof structure', {
          code: ErrorCode.PROOF_STRUCTURE_INVALID,
          operationId,
          recoverable: false,
          details: {
            proofFormat: proof ? Object.keys(proof) : 'null',
            circuitName: actualCircuitName
          }
        });
      }

      // Validate public signals
      if (!Array.isArray(publicSignals) || publicSignals.length === 0) {
        throw new VerificationError('Invalid public signals', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          details: {
            signalsType: typeof publicSignals,
            signalsLength: Array.isArray(publicSignals) ? publicSignals.length : 'not an array',
            circuitName: actualCircuitName
          }
        });
      }

      // Perform the actual cryptographic verification
      const isValid = await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
      );

      // Log the verification result
      zkErrorLogger.log(
        isValid ? 'INFO' : 'WARNING',
        isValid ? 'Proof verification succeeded' : 'Proof verification failed',
        {
          operationId,
          context: 'realZkUtils.verifyZKProof',
          details: {
            circuitName: actualCircuitName,
            isValid,
            proofType
          }
        }
      );

      return isValid;
    } catch (error) {
      // Log the verification error
      zkErrorLogger.logError(
        error instanceof VerificationError ? error :
          new VerificationError(`Error during proof verification: ${error.message}`, {
            code: ErrorCode.VERIFICATION_FAILED,
            operationId,
            recoverable: false,
            details: { circuitName: actualCircuitName, originalError: error.message }
          }),
        { context: 'realZkUtils.verifyZKProof' }
      );

      // No fallbacks - propagate the actual error
      throw error;
    }
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'realZkUtils.verifyZKProof' });
      throw error;
    }

    // Otherwise wrap with verification error
    const verificationError = new VerificationError(`Failed to verify ZK proof: ${error.message}`, {
      code: ErrorCode.VERIFICATION_FAILED,
      operationId,
      recoverable: false,
      details: { originalError: error.message }
    });

    zkErrorLogger.logError(verificationError, { context: 'realZkUtils.verifyZKProof' });
    throw verificationError;
  }
};

/**
 * Constants used in ZK proof operations
 * 
 * @constant
 * @type {Object}
 * @property {BigInt} SNARK_FIELD_SIZE - The prime field size for BN254 curve
 */
export const CONSTANTS = {
  SNARK_FIELD_SIZE
};

/**
 * Named export for SNARK field size constant
 * 
 * @constant
 * @type {BigInt}
 */
export {
  SNARK_FIELD_SIZE
};

/**
 * Default export providing all real ZK utilities as a single object
 * 
 * This export supports CommonJS interoperability and provides all functions
 * and constants in a single object. For ESM, you can use named imports instead.
 * 
 * @type {Object}
 * @property {function} toFieldElement - Converts a value to field element representation
 * @property {function} padArray - Pads an array to specified length
 * @property {function} serializeZKProof - Serializes a ZK proof for transmission
 * @property {function} deserializeZKProof - Deserializes a ZK proof from string format
 * @property {function} generateZKProofHash - Generates a hash of a ZK proof
 * @property {function} bufferToFieldArray - Converts a buffer to field element array
 * @property {function} normalizeAddress - Normalizes an Ethereum address
 * @property {function} stringifyBigInts - Converts BigInt values to strings
 * @property {function} parseBigInts - Parses string values back to BigInt
 * @property {function} formatNumber - Formats a number to user-friendly string
 * @property {function} generateZKProof - Generates a real ZK proof
 * @property {function} verifyZKProof - Verifies a ZK proof
 * @property {BigInt} SNARK_FIELD_SIZE - The prime field size for BN254 curve
 * @example
 * // In Node.js ESM:
 * import realZkUtils from './realZkUtils.mjs';
 * const proof = await realZkUtils.generateZKProof(input, 'standardProof');
 * 
 * // Using named imports:
 * import { generateZKProof, verifyZKProof } from './realZkUtils.mjs';
 * const proof = await generateZKProof(input, 'standardProof');
 */
export default {
  toFieldElement,
  padArray,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  bufferToFieldArray,
  normalizeAddress,
  stringifyBigInts,
  parseBigInts,
  formatNumber,
  generateZKProof,
  verifyZKProof,
  SNARK_FIELD_SIZE
};