/**
 * Zero-Knowledge Proof Utility Functions (ESM Version)
 * 
 * This is an ES Module version of zkUtils.js specifically for use with ES module imports.
 * It provides the same functionality as the CommonJS version but supports ES module imports.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This file is like the engine room of our privacy system, but formatted for newer JavaScript.
 * It contains the same tools as zkUtils.js but is packaged in a way that works with modern
 * JavaScript's import/export system. Think of it as the same toolkit but with a different
 * type of carrying case that works better with newer equipment.
 * 
 * /* #ESM-FORMAT */

// Import dependencies
import { getEthers } from '../utils/ethersUtils.js';
import pkg from 'js-sha3';
import * as snarkjsModule from 'snarkjs';
import { Buffer } from 'buffer';
import { zkErrorLogger } from '../error-handling/zkErrorLogger.mjs';
// Conditionally import Node.js modules
let fs = null;
let path = null;
let fileURLToPath = null;
if (typeof window === 'undefined') {
  try {
    const fsModule = await import('fs');
    const pathModule = await import('path');
    const urlModule = await import('url');
    fs = fsModule.default || fsModule;
    path = pathModule.default || pathModule;
    fileURLToPath = urlModule.fileURLToPath;
  } catch (err) {
    console.error("Error importing Node.js modules:", err.message);
  }
}

// Import resource management system
import { ResourceMonitor, ResourceType, SamplingStrategy } from '../resources/ResourceMonitor.js';
import { ResourceAllocator } from '../resources/ResourceAllocator.js';
import AdaptiveComputation from '../resources/AdaptiveComputation.js';
import { COMPUTATION_STRATEGIES } from '../resources/ComputationStrategies.js';

// Utility functions for isomorphic file handling
const isServer = typeof window === 'undefined';

// Safe file system operations that check if running on server
const safeFileOps = {
  readFile: (filepath) => {
    if (!isServer) {
      console.warn('File operations are not available in browser context');
      return null;
    }
    try {
      return fs.readFileSync(filepath, 'utf8');
    } catch (err) {
      console.error(`Error reading file ${filepath}:`, err);
      return null;
    }
  },

  fileExists: (filepath) => {
    if (!isServer) return false;
    try {
      return fs.existsSync(filepath);
    } catch (err) {
      return false;
    }
  },

  getDirname: (importMetaUrl) => {
    if (!isServer) return '';
    try {
      const __filename = fileURLToPath(importMetaUrl);
      return path.dirname(__filename);
    } catch (err) {
      console.error('Error getting dirname:', err);
      return '';
    }
  }
};

// Import error handling system - import directly from zkErrorHandler.mjs 
// to ensure we get the actual classes and not promises
import {
  ZKErrorCode,
  createZKError,
  ErrorSeverity,
  InputError,
  ProofError,
  VerificationError,
  ProofSerializationError,
  SystemError,
  NetworkError,
  SecurityError,
  isZKError
} from '../error-handling/zkErrorHandler.mjs';

// Set variables from imports
const keccak256 = pkg.keccak256;
const sha256 = pkg.sha3_256;
const snarkjs = snarkjsModule;

// Import config for circuit paths
import zkConfigModule from '../config/real-zk-config.js';
const zkConfig = zkConfigModule;

// Initialize resource management system
const resourceMonitor = new ResourceMonitor({
  resources: [ResourceType.CPU, ResourceType.MEMORY],
  samplingIntervalMs: 2000,
  samplingStrategy: SamplingStrategy.ADAPTIVE,
  detailedMetrics: true
});

const resourceAllocator = new ResourceAllocator(resourceMonitor);

const adaptiveComputation = new AdaptiveComputation(
  resourceMonitor,
  resourceAllocator,
  {
    enabledStrategies: [
      COMPUTATION_STRATEGIES.FULL_COMPUTATION,
      COMPUTATION_STRATEGIES.PROGRESSIVE_COMPUTATION,
      COMPUTATION_STRATEGIES.FALLBACK_COMPUTATION
    ],
    maxMemoryUsagePercent: 80,
    maxCpuUsagePercent: 85
  }
);

// Start resource monitoring
resourceMonitor.startMonitoring().catch(error => {
  zkErrorLogger.logError(error, {
    context: 'zkUtils.resourceMonitoring',
    details: { operation: 'startMonitoring' }
  });
});

/**
 * Specialized error class for ZK utilities operations
 * @class ZKUtilsError
 * @extends SystemError
 */
class ZKUtilsError extends SystemError {
  /**
   * Create a new ZKUtilsError
   * @param {string} message - Error message
   * @param {Object} options - Additional error options
   */
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ZKErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      severity: options.severity || ErrorSeverity.ERROR,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'ZKUtils',
        operation: options.operation || 'unknown',
        operationId: options.operationId || `zk_utils_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`
      }
    });

    this.name = 'ZKUtilsError';

    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ZKUtilsError);
    }
  }
}

/**
 * Constants for the snark field - maximum value in the prime field used by ZK circuits
 * @type {bigint}
 */
export const SNARK_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Converts a number to the field element representation used in zk circuits
 * @param {number|string|BigInt} value - The number to convert
 * @returns {string} Field element representation
 */
/**
 * Converts a number to the field element representation used in zk circuits
 * @param {number|string|BigInt} value - The number to convert
 * @returns {string} Field element representation as a string
 * @throws {ZKError} If the input value has an invalid type
 */
export const toFieldElement = async (value) => {
  try {
    // Ensure we're working with a BigInt
    let bigIntValue;

    if (typeof value === 'bigint') {
      bigIntValue = value;
    } else if (typeof value === 'number' || typeof value === 'string') {
      bigIntValue = BigInt(value);
    } else {
      throw createZKError(
        ZKErrorCode.INVALID_INPUT_TYPE,
        `Invalid value type for field element conversion: ${typeof value}`,
        {
          severity: ErrorSeverity.ERROR,
          details: { valueType: typeof value },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Use modulo to ensure value is within field
    const fieldElement = ((bigIntValue % SNARK_FIELD_SIZE) + SNARK_FIELD_SIZE) % SNARK_FIELD_SIZE;

    return fieldElement.toString();
  } catch (error) {
    // Log error and re-throw
    zkErrorLogger.logError(error, {
      context: 'toFieldElement',
      input: typeof value
    });
    throw error;
  }
};

/**
 * Pads an array to the specified length with the provided padding value
 * @param {Array} arr - Array to pad
 * @param {number} length - Target length
 * @param {any} padValue - Value to use for padding (defaults to 0)
 * @returns {Array} Padded array with exactly the specified length
 * @throws {ZKError} If the input is not an array
 */
export const padArray = (arr, length, padValue = 0) => {
  try {
    // Validate inputs
    if (!Array.isArray(arr)) {
      throw createZKError(
        ZKErrorCode.INVALID_INPUT_TYPE,
        'padArray requires an array as input',
        {
          severity: ErrorSeverity.ERROR,
          details: { valueType: typeof arr },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // If array is already >= target length, slice it
    if (arr.length >= length) return arr.slice(0, length);

    // Otherwise pad the array
    return [...arr, ...Array(length - arr.length).fill(padValue)];
  } catch (error) {
    // Log error and re-throw
    zkErrorLogger.logError(error, {
      context: 'padArray',
      details: {
        inputType: typeof arr,
        isArray: Array.isArray(arr),
        targetLength: length
      }
    });
    throw error;
  }
};

/**
 * Serializes a ZK proof for transmission or storage by converting BigInt values to strings
 * @param {Object} proof - The ZK proof object with pi_a, pi_b, pi_c components
 * @param {Array} publicSignals - Public signals array that may contain BigInt values
 * @returns {Object} Serialized proof with stringified components ready for JSON serialization
 * @throws {ZKError} If inputs are invalid or serialization fails
 */
export const serializeZKProof = (proof, publicSignals) => {
  try {
    // Validate inputs
    if (!proof || typeof proof !== 'object') {
      throw createZKError(
        ZKErrorCode.INVALID_PROOF_FORMAT,
        'Invalid proof object provided for serialization',
        {
          severity: ErrorSeverity.ERROR,
          details: { proofType: typeof proof },
          recoverable: false,
          userFixable: true
        }
      );
    }

    if (!Array.isArray(publicSignals)) {
      throw createZKError(
        ZKErrorCode.INVALID_PUBLIC_SIGNALS,
        'Public signals must be an array',
        {
          severity: ErrorSeverity.ERROR,
          details: { signalsType: typeof publicSignals },
          recoverable: false,
          userFixable: true
        }
      );
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
    // Log error and re-throw
    zkErrorLogger.logError(error, {
      context: 'serializeZKProof',
      details: {
        hasProof: !!proof,
        proofType: typeof proof,
        hasPublicSignals: !!publicSignals,
        publicSignalsType: typeof publicSignals
      }
    });
    throw error;
  }
};

/**
 * Deserializes a ZK proof from its string format by converting string values back to BigInt
 * @param {Object} serializedProof - The serialized proof object with string components
 * @param {Array<string>} serializedPublicSignals - Serialized public signals array as strings
 * @returns {Object} The deserialized proof and signals with BigInt values
 * @throws {ZKError} If inputs are invalid or deserialization fails
 */
export const deserializeZKProof = (serializedProof, serializedPublicSignals) => {
  try {
    // Validate inputs
    if (!serializedProof || typeof serializedProof !== 'object') {
      throw createZKError(
        ZKErrorCode.INVALID_PROOF_FORMAT,
        'Invalid serialized proof provided',
        {
          severity: ErrorSeverity.ERROR,
          details: { proofType: typeof serializedProof },
          recoverable: false,
          userFixable: true
        }
      );
    }

    if (!Array.isArray(serializedPublicSignals)) {
      throw createZKError(
        ZKErrorCode.INVALID_PUBLIC_SIGNALS,
        'Serialized public signals must be an array',
        {
          severity: ErrorSeverity.ERROR,
          details: { signalsType: typeof serializedPublicSignals },
          recoverable: false,
          userFixable: true
        }
      );
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
    // Check if this is a BigInt conversion error
    if (error.name === 'SyntaxError' && error.message.includes('BigInt')) {
      // More specific error for BigInt conversion failures
      const zkError = createZKError(
        ZKErrorCode.BIGINT_CONVERSION_ERROR,
        'Failed to convert string to BigInt during proof deserialization',
        {
          severity: ErrorSeverity.ERROR,
          details: { originalError: error.message },
          recoverable: false,
          userFixable: true
        }
      );

      zkErrorLogger.logError(zkError, {
        context: 'deserializeZKProof',
        operation: 'BigInt conversion'
      });

      throw zkError;
    }

    // Log and re-throw other errors
    zkErrorLogger.logError(error, {
      context: 'deserializeZKProof',
      details: {
        hasSerializedProof: !!serializedProof,
        serializedProofType: typeof serializedProof,
        hasSerializedSignals: !!serializedPublicSignals,
        serializedSignalsType: typeof serializedPublicSignals
      }
    });

    throw error;
  }
};

/**
 * Generates a hash of a ZK proof for verification and identification purposes
 * @param {Object} proof - The ZK proof object with pi_a, pi_b, pi_c components
 * @param {Array} publicSignals - Public signals array
 * @returns {string} Hex-encoded SHA3-256 hash of the serialized proof
 * @throws {ZKError} If hashing fails or inputs are invalid
 */
export const generateZKProofHash = (proof, publicSignals) => {
  const operationId = `generateZKProofHash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  try {
    // Input validation with specific error messages
    if (!proof || typeof proof !== 'object') {
      throw createZKError(
        ZKErrorCode.INVALID_PROOF_FORMAT,
        'Cannot generate hash: Invalid proof object',
        {
          severity: ErrorSeverity.ERROR,
          recoverable: false,
          userFixable: true,
          details: {
            proofType: typeof proof,
            isNull: proof === null,
            operationId,
            timestamp: new Date().toISOString()
          }
        }
      );
    }

    if (!Array.isArray(publicSignals)) {
      throw createZKError(
        ZKErrorCode.INVALID_PUBLIC_SIGNALS,
        'Cannot generate hash: Public signals must be an array',
        {
          severity: ErrorSeverity.ERROR,
          recoverable: false,
          userFixable: true,
          details: {
            signalsType: typeof publicSignals,
            isNull: publicSignals === null,
            operationId,
            timestamp: new Date().toISOString()
          }
        }
      );
    }

    // Log start of hash generation
    zkErrorLogger.log('DEBUG', 'Generating proof hash', {
      operationId,
      context: 'zkUtils.generateZKProofHash',
      details: {
        hasProofComponents: {
          pi_a: Array.isArray(proof.pi_a),
          pi_b: Array.isArray(proof.pi_b),
          pi_c: Array.isArray(proof.pi_c)
        },
        publicSignalsLength: publicSignals.length
      }
    });

    // Try to serialize the proof
    let serializedData;
    try {
      const serialized = serializeZKProof(proof, publicSignals);
      serializedData = JSON.stringify(serialized);
    } catch (error) {
      // Handle serialization errors specifically
      const serializationError = createZKError(
        ZKErrorCode.PROOF_SERIALIZATION_FAILED,
        `Failed to serialize proof for hashing: ${error.message}`,
        {
          severity: ErrorSeverity.ERROR,
          recoverable: false,
          userFixable: false,
          details: {
            originalError: error.message,
            hasProof: !!proof,
            hasProofComponents: {
              pi_a: Array.isArray(proof.pi_a),
              pi_b: Array.isArray(proof.pi_b),
              pi_c: Array.isArray(proof.pi_c)
            },
            publicSignalsLength: publicSignals.length,
            operationId,
            timestamp: new Date().toISOString()
          }
        }
      );

      zkErrorLogger.logError(serializationError, {
        context: 'zkUtils.generateZKProofHash',
        operation: 'proof serialization',
        operationId
      });

      throw serializationError;
    }

    // Try to generate the hash
    try {
      const hashResult = '0x' + sha256(serializedData);

      // Validate hash format
      if (!hashResult || typeof hashResult !== 'string' || !hashResult.startsWith('0x') || hashResult.length !== 66) {
        throw new Error('Generated hash has invalid format');
      }

      return hashResult;
    } catch (error) {
      // Handle hashing errors specifically
      const hashingError = createZKError(
        ZKErrorCode.PROOF_HASH_GENERATION_FAILED,
        `SHA3-256 hashing operation failed: ${error.message}`,
        {
          severity: ErrorSeverity.ERROR,
          recoverable: false,
          userFixable: false,
          details: {
            originalError: error.message,
            serializedDataSize: serializedData ? serializedData.length : 0,
            operationId,
            timestamp: new Date().toISOString()
          }
        }
      );

      zkErrorLogger.logError(hashingError, {
        context: 'zkUtils.generateZKProofHash',
        operation: 'sha3-256 hashing',
        operationId
      });

      throw hashingError;
    }
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'zkUtils.generateZKProofHash',
        operationId,
        details: {
          hasProof: !!proof,
          hasPublicSignals: !!publicSignals
        }
      });
      throw error;
    }

    // Otherwise create a generic error
    const genericError = createZKError(
      ZKErrorCode.PROOF_HASH_GENERATION_FAILED,
      `Failed to generate proof hash: ${error.message}`,
      {
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        userFixable: false,
        details: {
          originalError: error.message,
          hasProof: !!proof,
          hasPublicSignals: !!publicSignals,
          operationId,
          timestamp: new Date().toISOString(),
          stack: error.stack
        }
      }
    );

    zkErrorLogger.logError(genericError, {
      context: 'zkUtils.generateZKProofHash',
      operation: 'hash generation',
      operationId
    });

    throw genericError;
  }
};

/**
 * Converts a buffer or hex string to a field element array
 * @param {Buffer|string} buffer - The buffer or hex string to convert
 * @returns {Array<string>} Array of field elements
 * @throws {InputError} If the input is not a buffer or hex string
 */
export const bufferToFieldArray = async (buffer) => {
  const operationId = `bufferToFieldArray_${Date.now()}`;

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
        code: ZKErrorCode.INPUT_TYPE_ERROR,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          providedType: typeof buffer,
          isBuffer: Buffer.isBuffer(buffer)
        }
      });
    }

    // Convert each 31-byte chunk to a field element
    const elements = [];
    for (let i = 0; i < buffer.length; i += 31) {
      const chunk = buffer.slice(i, i + 31);
      const hex = '0x' + chunk.toString('hex');
      const fieldElement = await toFieldElement(hex);
      elements.push(fieldElement);
    }

    return elements;
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'zkUtils.bufferToFieldArray' });
      throw error;
    }

    // Otherwise, wrap with appropriate error
    const inputError = new InputError(`Failed to convert buffer to field array: ${error.message}`, {
      code: ZKErrorCode.INPUT_TYPE_ERROR,
      operationId,
      recoverable: false,
      userFixable: true,
      details: {
        inputType: typeof buffer,
        isBuffer: Buffer.isBuffer(buffer),
        originalError: error.message
      }
    });

    zkErrorLogger.logError(inputError, { context: 'zkUtils.bufferToFieldArray' });
    throw inputError;
  }
};

/**
 * Normalizes an Ethereum address to a checksummed format
 * @param {string} address - Ethereum address to normalize
 * @returns {string} Normalized address
 * @throws {InputError} If the address is invalid
 */
export const normalizeAddress = async (address) => {
  const operationId = `normalizeAddress_${Date.now()}`;

  try {
    if (!address || typeof address !== 'string') {
      throw new InputError('Invalid address', {
        code: ZKErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          providedType: typeof address,
          isEmpty: !address
        }
      });
    }

    // Ensure address has 0x prefix
    const prefixedAddress = address.startsWith('0x') ? address : '0x' + address;

    try {
      // Use ethers to format as checksum address
      const { ethers } = await getEthers();
      return ethers.utils.getAddress(prefixedAddress);
    } catch (error) {
      throw new InputError(`Invalid Ethereum address: ${error.message}`, {
        code: ZKErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: {
          address: prefixedAddress,
          originalError: error.message
        }
      });
    }
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'zkUtils.normalizeAddress' });
      throw error;
    }

    // Otherwise, wrap with appropriate error
    const inputError = new InputError(`Address normalization failed: ${error.message}`, {
      code: ZKErrorCode.INPUT_VALIDATION_FAILED,
      operationId,
      recoverable: false,
      userFixable: true,
      details: {
        providedAddress: address,
        originalError: error.message
      }
    });

    zkErrorLogger.logError(inputError, { context: 'zkUtils.normalizeAddress' });
    throw inputError;
  }
};

/**
 * Stringifies a BigInt value for JSON compatibility
 * @param {any} obj - Object that may contain BigInt values
 * @returns {any} Object with BigInt values converted to strings
 * @throws {InputError} If stringification fails
 */
export const stringifyBigInts = (obj) => {
  const operationId = `stringifyBigInts_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  try {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => {
        try {
          return stringifyBigInts(item);
        } catch (error) {
          // Create specific error for array item conversion failures
          const conversionError = createZKError(
            ZKErrorCode.BIGINT_CONVERSION_ERROR,
            `Failed to stringify BigInt in array at index ${index}: ${error.message}`,
            {
              severity: ErrorSeverity.WARNING,
              recoverable: true, // We'll continue with other items
              userFixable: false,
              details: {
                index,
                valueType: typeof item,
                isArray: Array.isArray(item),
                isObject: typeof item === 'object' && !Array.isArray(item) && item !== null,
                operationId,
                timestamp: new Date().toISOString()
              }
            }
          );

          // Log error but continue processing
          zkErrorLogger.logError(conversionError, {
            context: 'zkUtils.stringifyBigInts',
            operation: 'array item conversion',
            operationId,
            details: { index }
          });

          // Return string representation as fallback
          return String(item);
        }
      });
    }

    if (typeof obj === 'object') {
      const result = {};
      const failedKeys = [];

      for (const key in obj) {
        try {
          result[key] = stringifyBigInts(obj[key]);
        } catch (error) {
          failedKeys.push(key);

          // Create specific error for object property conversion failures
          const propertyError = createZKError(
            ZKErrorCode.BIGINT_CONVERSION_ERROR,
            `Failed to stringify BigInt in object property '${key}': ${error.message}`,
            {
              severity: ErrorSeverity.WARNING,
              recoverable: true, // We'll continue with other properties
              userFixable: false,
              details: {
                property: key,
                valueType: typeof obj[key],
                isArray: Array.isArray(obj[key]),
                isObject: typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null,
                operationId,
                timestamp: new Date().toISOString()
              }
            }
          );

          // Log error but continue processing
          zkErrorLogger.logError(propertyError, {
            context: 'zkUtils.stringifyBigInts',
            operation: 'object property conversion',
            operationId,
            details: { property: key }
          });

          // Use string representation as fallback
          result[key] = String(obj[key]);
        }
      }

      // If there were failures, log a summary
      if (failedKeys.length > 0) {
        zkErrorLogger.log('WARNING', 'Some object properties could not be properly stringified', {
          operationId,
          context: 'zkUtils.stringifyBigInts',
          details: {
            failedKeysCount: failedKeys.length,
            failedKeys: failedKeys.length <= 5 ? failedKeys : failedKeys.slice(0, 5).concat(['...and more']),
            totalKeys: Object.keys(obj).length
          }
        });
      }

      return result;
    }

    return obj;
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'zkUtils.stringifyBigInts',
        operationId,
        details: {
          valueType: typeof obj,
          isArray: Array.isArray(obj),
          objectSize: typeof obj === 'object' && obj !== null ? Object.keys(obj).length : 'n/a'
        }
      });
      throw error;
    }

    // Otherwise wrap in an appropriate error with rich context
    const inputError = createZKError(
      ZKErrorCode.BIGINT_CONVERSION_ERROR,
      `Failed to stringify BigInt values: ${error.message}`,
      {
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        userFixable: false,
        details: {
          valueType: typeof obj,
          isArray: Array.isArray(obj),
          isObject: typeof obj === 'object' && !Array.isArray(obj) && obj !== null,
          objectSize: typeof obj === 'object' && obj !== null ? Object.keys(obj).length : 'n/a',
          originalError: error.message,
          operationId,
          timestamp: new Date().toISOString(),
          stack: error.stack
        }
      }
    );

    zkErrorLogger.logError(inputError, {
      context: 'zkUtils.stringifyBigInts',
      operation: 'root conversion',
      operationId
    });
    throw inputError;
  }
};

/**
 * Parses stringified BigInt values back to BigInt type
 * @param {any} obj - Object with stringified BigInt values
 * @returns {any} Object with restored BigInt values
 * @throws {InputError} If parsing fails
 */
export const parseBigInts = (obj) => {
  const operationId = `parseBigInts_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  try {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string' && /^[0-9]+$/.test(obj)) {
      try {
        return BigInt(obj);
      } catch (error) {
        // Create specific error for string-to-BigInt conversion failures
        const conversionError = createZKError(
          ZKErrorCode.BIGINT_CONVERSION_ERROR,
          `Failed to convert string to BigInt: ${error.message}`,
          {
            severity: ErrorSeverity.WARNING,
            recoverable: true, // Return original as fallback
            userFixable: true,
            details: {
              value: obj.length > 50 ? `${obj.substring(0, 25)}...${obj.substring(obj.length - 25)}` : obj,
              valueLength: obj.length,
              exceedsMaxSafeInteger: obj.length > 16, // Roughly max safe integer length
              operationId,
              timestamp: new Date().toISOString()
            }
          }
        );

        zkErrorLogger.logError(conversionError, {
          context: 'zkUtils.parseBigInts',
          operation: 'string to BigInt conversion',
          operationId
        });

        // Return original string if conversion fails
        return obj;
      }
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => {
        try {
          return parseBigInts(item);
        } catch (error) {
          // Create specific error for array item conversion failures
          const conversionError = createZKError(
            ZKErrorCode.BIGINT_CONVERSION_ERROR,
            `Failed to parse BigInt in array at index ${index}: ${error.message}`,
            {
              severity: ErrorSeverity.WARNING,
              recoverable: true, // We'll continue with other items
              userFixable: false,
              details: {
                index,
                valueType: typeof item,
                isArray: Array.isArray(item),
                isObject: typeof item === 'object' && !Array.isArray(item) && item !== null,
                operationId,
                timestamp: new Date().toISOString()
              }
            }
          );

          // Log error but continue processing
          zkErrorLogger.logError(conversionError, {
            context: 'zkUtils.parseBigInts',
            operation: 'array item conversion',
            operationId,
            details: { index }
          });

          // Return original item as fallback
          return item;
        }
      });
    }

    if (typeof obj === 'object') {
      const result = {};
      const failedKeys = [];

      for (const key in obj) {
        try {
          result[key] = parseBigInts(obj[key]);
        } catch (error) {
          failedKeys.push(key);

          // Create specific error for object property conversion failures
          const propertyError = createZKError(
            ZKErrorCode.BIGINT_CONVERSION_ERROR,
            `Failed to parse BigInt in object property '${key}': ${error.message}`,
            {
              severity: ErrorSeverity.WARNING,
              recoverable: true, // We'll continue with other properties
              userFixable: false,
              details: {
                property: key,
                valueType: typeof obj[key],
                isArray: Array.isArray(obj[key]),
                isObject: typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null,
                operationId,
                timestamp: new Date().toISOString()
              }
            }
          );

          // Log error but continue processing
          zkErrorLogger.logError(propertyError, {
            context: 'zkUtils.parseBigInts',
            operation: 'object property conversion',
            operationId,
            details: { property: key }
          });

          // Use original value as fallback
          result[key] = obj[key];
        }
      }

      // If there were failures, log a summary
      if (failedKeys.length > 0) {
        zkErrorLogger.log('WARNING', 'Some object properties could not be properly parsed to BigInt', {
          operationId,
          context: 'zkUtils.parseBigInts',
          details: {
            failedKeysCount: failedKeys.length,
            failedKeys: failedKeys.length <= 5 ? failedKeys : failedKeys.slice(0, 5).concat(['...and more']),
            totalKeys: Object.keys(obj).length
          }
        });
      }

      return result;
    }

    return obj;
  } catch (error) {
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'zkUtils.parseBigInts',
        operationId,
        details: {
          valueType: typeof obj,
          isArray: Array.isArray(obj),
          objectSize: typeof obj === 'object' && obj !== null ? Object.keys(obj).length : 'n/a'
        }
      });
      throw error;
    }

    // Otherwise wrap in an appropriate error with rich context
    const inputError = createZKError(
      ZKErrorCode.BIGINT_CONVERSION_ERROR,
      `Failed to parse BigInt values: ${error.message}`,
      {
        severity: ErrorSeverity.ERROR,
        recoverable: false,
        userFixable: false,
        details: {
          valueType: typeof obj,
          isArray: Array.isArray(obj),
          isObject: typeof obj === 'object' && !Array.isArray(obj) && obj !== null,
          objectSize: typeof obj === 'object' && obj !== null ? Object.keys(obj).length : 'n/a',
          originalError: error.message,
          operationId,
          timestamp: new Date().toISOString(),
          stack: error.stack
        }
      }
    );

    zkErrorLogger.logError(inputError, {
      context: 'zkUtils.parseBigInts',
      operation: 'root conversion',
      operationId
    });
    throw inputError;
  }
};

/**
 * Formats a number to a user-friendly string with appropriate units
 * @param {number|string|BigInt} value - Value to format
 * @param {Object} options - Formatting options
 * @param {number} [options.precision=2] - Number of decimal places
 * @param {boolean} [options.currency=false] - Whether to format as currency
 * @param {boolean} [options.compact=false] - Whether to use compact notation
 * @returns {string} Formatted value
 * @throws {InputError} If value cannot be converted to a number
 * @throws {SystemError} If number formatting fails
 */
export const formatNumber = (value, options = {}) => {
  const operationId = `formatNumber_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const {
    precision = 2,
    currency = false,
    compact = false
  } = options;

  let numValue;
  try {
    // Convert to number
    numValue = typeof value === 'bigint' ? Number(value) : Number(value);

    // Check for NaN immediately after conversion
    if (isNaN(numValue)) {
      throw createZKError(
        ZKErrorCode.INPUT_CONVERSION_FAILED,
        `Value cannot be converted to a number: ${value}`,
        {
          severity: ErrorSeverity.WARNING,
          recoverable: true, // We'll provide a fallback
          userFixable: true,
          details: {
            originalValue: String(value),
            valueType: typeof value,
            operation: 'NaN check',
            operationId
          }
        }
      );
    }
  } catch (error) {
    // Avoid nested errors - if it's already a ZKError, just log and re-throw
    if (isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'zkUtils.formatNumber',
        operation: 'number conversion',
        operationId,
        details: {
          input: typeof value === 'object' ? 'object' : String(value),
          options
        }
      });
      throw error;
    }

    // Create a specialized error for conversion failures
    const conversionError = createZKError(
      ZKErrorCode.INPUT_CONVERSION_FAILED,
      `Failed to convert value to number: ${error.message}`,
      {
        severity: ErrorSeverity.WARNING,
        recoverable: true, // We provide a fallback
        userFixable: true,
        details: {
          valueType: typeof value,
          value: typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value),
          originalError: error.message,
          operationId,
          timestamp: new Date().toISOString()
        }
      }
    );

    zkErrorLogger.logError(conversionError, {
      context: 'zkUtils.formatNumber',
      operation: 'number conversion',
      operationId
    });

    return String(value); // Return original value if conversion fails
  }

  try {
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
    // Log error if number formatting fails
    const formattingError = createZKError(
      ZKErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      `Number formatting failed: ${error.message}`,
      {
        severity: ErrorSeverity.WARNING,
        recoverable: true, // We provide a fallback
        userFixable: false, // This is usually a system/browser issue
        details: {
          value: numValue,
          options,
          originalError: error.message,
          operationId,
          formatType: currency ? 'currency' : (compact ? 'compact' : 'standard'),
          precision,
          browserLocale: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
          timestamp: new Date().toISOString()
        }
      }
    );

    zkErrorLogger.logError(formattingError, {
      context: 'zkUtils.formatNumber',
      operation: 'Intl.NumberFormat',
      operationId
    });

    // Use a simpler fallback formatting approach
    if (currency) {
      return `$${numValue.toFixed(precision)}`;
    }
    return numValue.toFixed(precision);
  }
};

/**
 * Generates a zero-knowledge proof using the appropriate circuit
 * @param {Object} inputs - Inputs for the circuit
 * @param {string} proofType - Type of proof to generate
 * @param {Object} options - Additional options for proof generation
 * @returns {Promise<Object>} Generated proof and public signals
 * @throws {ZKError} If proof generation fails
 */
export const generateZKProof = async (inputs, incomingProofType, options = {}) => {
  const operationId = options.operationId || `proof_gen_${Date.now()}`;

  // Convert proofType to string at the entry point
  let proofType = typeof incomingProofType === 'string' 
    ? incomingProofType 
    : String(incomingProofType);
  
  console.log('ZK Core - generateZKProof entry point:', {
    originalProofType: incomingProofType,
    convertedProofType: proofType,
    convertedTypeOf: typeof proofType
  });

  try {
    // Register operation start with resource monitor
    await resourceMonitor.markOperationStart(operationId);

    // Define a computation profile for proof generation
    const computationProfile = {
      circuitSize: zkConfig.circuitConfig[proofType]?.constraints || 100000,
      expectedWitnessDuration: 500,
      expectedProvingDuration: 3000,
      circuitMemoryRequirements: 100 * 1024 * 1024, // 100 MB
      witnessMemoryRequirements: 300 * 1024 * 1024, // 300 MB
      provingMemoryRequirements: 500 * 1024 * 1024, // 500 MB
      canSplitComputation: true,
      supportsFallbackMode: true,
      supportsPartialResults: false,
      supportsCachedResults: true,
      cacheTTL: 30 * 60 * 1000 // 30 minutes
    };

    // Use adaptive computation to execute the proof generation
    const computationResult = await adaptiveComputation.executeComputation(
      operationId,
      async (resources) => {
        // Validate inputs to prevent GIGO
        if (!inputs || typeof inputs !== 'object') {
          throw createZKError(
            ZKErrorCode.INVALID_INPUT,
            'Invalid inputs: inputs must be an object',
            {
              severity: ErrorSeverity.ERROR,
              details: { input: typeof inputs },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Debug the proof type to understand what's being passed
        console.log('ZK Core - proofType debug:', {
          proofType,
          typeofProofType: typeof proofType,
          isString: typeof proofType === 'string',
          proofTypeAsString: String(proofType),
          proofTypeAsJSON: JSON.stringify(proofType),
          valueEquality: proofType === String(proofType)
        });
        
        // Force proofType to be a string
        proofType = String(proofType);

        // Debug the proof type after forcing it to string
        console.log('ZK Core - proofType after string conversion:', {
          proofType,
          typeofProofType: typeof proofType,
          isString: typeof proofType === 'string'
        });
        
        // New validation that only checks if it's empty
        if (!proofType) {
          throw createZKError(
            ZKErrorCode.INVALID_PROOF_TYPE,
            'Empty proof type',
            {
              severity: ErrorSeverity.ERROR,
              details: { 
                proofType: typeof proofType,
                value: proofType
              },
              recoverable: false,
              userFixable: true
            }
          );
        }

        // Determine circuit from proof type
        const circuitName = zkConfig.proofTypes[proofType] || 'standardProof';

        // Get circuit paths
        const circuitPath = zkConfig.circuitPaths.wasmPath(circuitName);
        const zkeyPath = zkConfig.circuitPaths.zkeyPath(circuitName);

        try {
          if (!isServer) {
            // Client-side (browser): Use fetch API to get the WASM and zkey files
            // Implementation would need to properly handle WASM/zkey fetching in browser

            // Placeholder for browser implementation - this should be replaced with actual fetch logic
            // This would send proof generation to a server endpoint 
            try {
              const response = await fetch('/api/zk/generateProof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs, proofType })
              });

              if (!response.ok) {
                throw new Error(`Server proof generation failed: ${response.statusText}`);
              }

              return await response.json();
            } catch (error) {
              throw createZKError(
                ZKErrorCode.BROWSER_PROVING_ERROR,
                `Browser proof generation failed: ${error.message}`,
                {
                  severity: ErrorSeverity.ERROR,
                  details: { inputs, proofType, error: error.message },
                  recoverable: false,
                  userFixable: false
                }
              );
            }
          } else {
            // Server-side: Use snarkjs directly with file paths
            const currentDir = safeFileOps.getDirname(import.meta.url);
            const wasmFile = path.resolve(currentDir, circuitPath);
            const zkeyFile = path.resolve(currentDir, zkeyPath);

            // Check if WASM file exists
            if (!safeFileOps.fileExists(wasmFile)) {
              throw createZKError(
                ZKErrorCode.CIRCUIT_FILE_NOT_FOUND,
                `Circuit WASM file not found: ${circuitPath}`,
                {
                  severity: ErrorSeverity.ERROR,
                  details: { path: circuitPath },
                  recoverable: false
                }
              );
            }

            // Check if zkey file exists
            if (!safeFileOps.fileExists(zkeyFile)) {
              throw createZKError(
                ZKErrorCode.ZKEY_FILE_NOT_FOUND,
                `Circuit zkey file not found: ${zkeyPath}`,
                {
                  severity: ErrorSeverity.ERROR,
                  details: { path: zkeyPath },
                  recoverable: false
                }
              );
            }

            try {
              // Generate witness first (this step generates the inputs for the proof)
              const { witness, wtnsFile } = await snarkjs.wtns.calculate(
                inputs,
                wasmFile,
                // For this implementation we won't use a temporary file
                { noSanityCheck: false, logPrefix: '[ZKP]', logging: options.logging || false }
              );

              // Generate full proof (most computationally intensive step)
              const { proof, publicSignals } = await snarkjs.groth16.prove(
                zkeyFile,
                witness,
                // Extra options for proving
                { logPrefix: '[ZKP]', logging: options.logging || false }
              );

              // Return proof and publicSignals
              return { proof, publicSignals };
            } catch (snarkError) {
              throw createZKError(
                ZKErrorCode.PROOF_GENERATION_FAILED,
                `Snarkjs proof generation failed: ${snarkError.message}`,
                {
                  severity: ErrorSeverity.ERROR,
                  details: { inputs, proofType, error: snarkError.message },
                  recoverable: false
                }
              );
            }
          }
        } catch (error) {
          // Catch errors from the outer try block
          // If it's already a ZKError, just log it and rethrow
          if (isZKError(error)) {
            throw error;
          }

          // Otherwise wrap in a ProofError
          throw new ProofError(`ZK proof generation failed: ${error.message}`, {
            code: ZKErrorCode.PROOF_GENERATION_FAILED,
            operationId,
            recoverable: false,
            details: {
              originalError: error.message,
              inputs: redactInputs(inputs), // Don't log raw inputs for privacy/security
              proofType
            }
          });
        }
      },
      computationProfile
    );

    // Handle computation result
    if (!computationResult.success) {
      throw new ProofError(
        `Adaptive proof generation failed: ${computationResult.error?.message || 'Unknown error'}`,
        {
          code: ZKErrorCode.PROOF_GENERATION_FAILED,
          operationId,
          recoverable: false,
          details: {
            strategy: computationResult.strategy,
            elapsedTime: computationResult.elapsedTime,
            resourcesUsed: computationResult.resourcesUsed
          }
        }
      );
    }

    // Record operation end with resource monitor
    await resourceMonitor.markOperationEnd(operationId);

    // Return the proof
    return computationResult.result;
  } catch (error) {
    // Handle any uncaught errors from the outer try block
    // Record operation end even if operation failed
    try {
      await resourceMonitor.markOperationEnd(operationId);
    } catch (monitorError) {
      // Just log this error but continue with the original error
      zkErrorLogger.logError(monitorError, {
        context: 'zkUtils.generateZKProof.cleanup',
        details: { operationId }
      });
    }

    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'zkUtils.generateZKProof' });
      throw error;
    }

    // Otherwise wrap in a ProofError
    const proofError = new ProofError(`ZK proof generation failed: ${error.message}`, {
      code: ZKErrorCode.PROOF_GENERATION_FAILED,
      operationId,
      recoverable: false,
      details: {
        originalError: error.message,
        inputs: redactInputs(inputs), // Don't log raw inputs for privacy/security
        proofType
      }
    });

    zkErrorLogger.logError(proofError, { context: 'zkUtils.generateZKProof' });
    throw proofError;
  }
};

/**
 * Helper function to redact sensitive input data for logging
 * Only keeps structure and type information for debugging
 * @param {Object} inputs - Original input data
 * @returns {Object} Redacted version of inputs
 * @private
 */
function redactInputs(inputs) {
  if (!inputs) return null;

  // Create a structure-only copy that doesn't include actual values
  const redacted = {};

  for (const key in inputs) {
    if (typeof inputs[key] === 'object' && inputs[key] !== null) {
      redacted[key] = Array.isArray(inputs[key])
        ? `[Array(${inputs[key].length})]`
        : '{Object}';
    } else {
      redacted[key] = `(${typeof inputs[key]})`;
    }
  }

  return redacted;
}

/**
 * Verifies a zero-knowledge proof against the appropriate circuit
 * @param {Object} proof - The proof to verify
 * @param {Array} publicSignals - Public signals for verification
 * @param {string} proofType - Type of proof to verify
 * @param {Object} options - Additional options for verification
 * @returns {Promise<boolean>} Whether the proof is valid
 * @throws {ZKError} If verification fails
 */
export const verifyZKProof = async (proof, publicSignals, proofType, options = {}) => {
  const operationId = options.operationId || `verify_${Date.now()}`;

  try {
    // Register operation start with resource monitor
    await resourceMonitor.markOperationStart(operationId);

    // Use resource monitoring to track verification resources
    const resourceSnapshot = await resourceMonitor.sampleResources();

    const verificationResult = await verifyZKProofInternal(proof, publicSignals, proofType, operationId, options);

    // Record operation end with resource monitor
    await resourceMonitor.markOperationEnd(operationId);

    return verificationResult;
  } catch (error) {
    // Handle any errors from verification
    try {
      await resourceMonitor.markOperationEnd(operationId);
    } catch (monitorError) {
      // Just log this error but continue with the original error
      zkErrorLogger.logError(monitorError, {
        context: 'zkUtils.verifyZKProof.cleanup',
        details: { operationId }
      });
    }

    // Rethrow the original error
    throw error;
  }
};

/**
 * Internal implementation of proof verification
 * @private
 */
async function verifyZKProofInternal(proof, publicSignals, proofType, operationId, options = {}) {
  try {
    // Validate inputs
    if (!proof || typeof proof !== 'object') {
      throw createZKError(
        ZKErrorCode.INVALID_PROOF_FORMAT,
        'Invalid proof: proof must be an object with pi_a, pi_b, pi_c components',
        {
          severity: ErrorSeverity.ERROR,
          details: { proofType: typeof proof },
          recoverable: false,
          userFixable: true
        }
      );
    }

    if (!Array.isArray(publicSignals)) {
      throw createZKError(
        ZKErrorCode.INVALID_PUBLIC_SIGNALS,
        'Invalid public signals: must be an array',
        {
          severity: ErrorSeverity.ERROR,
          details: { publicSignalsType: typeof publicSignals },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Force proofType to be a string
    proofType = String(proofType);
    
    // Only validate if it's empty
    if (!proofType) {
      throw createZKError(
        ZKErrorCode.INVALID_PROOF_TYPE,
        'Empty proof type',
        {
          severity: ErrorSeverity.ERROR,
          details: { proofType: typeof proofType },
          recoverable: false,
          userFixable: true
        }
      );
    }

    // Get verification key for this proof type
    const vKey = await getVerificationKey(proofType);

    try {
      // Verify the proof using snarkjs
      const isValid = await snarkjs.groth16.verify(
        vKey,
        publicSignals,
        proof,
        // Extra options for verification
        { logPrefix: '[ZKV]', logging: options.logging || false }
      );

      if (!isValid) {
        zkErrorLogger.log('WARNING', 'ZK proof verification failed: Invalid proof', {
          category: 'proof_verification',
          userFixable: false,
          recoverable: true,
          details: { proofType, operationId }
        });
      }

      return isValid;
    } catch (error) {
      // Handle verification errors from snarkjs
      const verificationError = new VerificationError(
        `Proof verification failed: ${error.message}`,
        {
          code: ZKErrorCode.VERIFICATION_FAILED,
          operationId,
          recoverable: false,
          details: {
            originalError: error.message,
            proofType
          }
        }
      );

      zkErrorLogger.logError(verificationError, { context: 'zkUtils.verifyZKProof.snarkjs' });
      throw verificationError;
    }

    // This part handles cases where the circuit is not available for verification
    // and we need to rely on pure Javascript verification.
    // In a real world scenario, this would be replaced with proper verification logic.
    if (options.allowMock) {
      // This is a simplified mock for testing - proof is considered valid
      // IMPORTANT: This should never be used in production code!
      console.warn('Using mock verification. This should NEVER happen in production!');

      // Some basic sanity checks on the proof format at least
      if (!proof.pi_a || !proof.pi_b || !proof.pi_c) {
        return false;
      }

      // Add verification logic based on proof type
      if (proofType === 'standard') {
        // For standard proof, check if the last public signal is non-zero (simplified)
        const lastSignal = publicSignals[publicSignals.length - 1];
        if (lastSignal === '0') {
          return false;
        }
      } else {
        // For threshold/maximum proofs, check the proof type against the last signal
        const lastSignal = publicSignals[publicSignals.length - 1];

        // Very simplified checks that would never be used in production
        if (proofType === 0 && lastSignal === 'standard_less') {
          return false;
        }
        if (proofType === 1 && lastSignal === 'threshold_less') {
          return false;
        }
        if (proofType === 2 && lastSignal === 'maximum_more') {
          return false;
        }
      }

      // Default to valid for testing
      return true;
    }
  } catch (error) {
    // Handle any errors from the outer try block
    // If it's already a ZKError, just log it and rethrow
    if (isZKError(error)) {
      zkErrorLogger.logError(error, { context: 'zkUtils.verifyZKProof' });
      throw error;
    }

    // Otherwise wrap in a VerificationError
    const verificationError = new VerificationError(`ZK proof verification failed: ${error.message}`, {
      code: ZKErrorCode.VERIFICATION_FAILED,
      operationId,
      recoverable: false,
      details: {
        originalError: error.message
      }
    });

    zkErrorLogger.logError(verificationError, { context: 'zkUtils.verifyZKProof' });
    throw verificationError;
  }
}

/**
 * Get verification key for zero knowledge proof verification
 * This function works in both Node.js and browser environments
 * 
 * @param {string} proofType - Type of proof (standard, threshold, maximum)
 * @param {string} circuitName - Custom circuit name (if provided)
 * @returns {Promise<Object>} Verification key object
 * @throws {ZKError} If verification key cannot be loaded
 */
export const getVerificationKey = async (proofType, circuitName) => {
  try {
    // Derive circuit name from proof type if not explicitly provided
    const actualCircuitName = circuitName || zkConfig.proofTypes[proofType] || 'standardProof';

    // Get verification key path
    const vkeyPath = zkConfig.circuitPaths.vkeyPath(actualCircuitName);

    // Handle path differently based on environment
    let verificationKey;

    if (isServer) {
      // Server-side: Use Node.js file system
      const currentDir = safeFileOps.getDirname(import.meta.url) || '';
      const filePath = path ? path.resolve(currentDir, vkeyPath) : vkeyPath;

      if (!safeFileOps.fileExists(filePath)) {
        throw createZKError(
          ZKErrorCode.VERIFICATION_KEY_NOT_FOUND,
          `Could not load verification key from ${vkeyPath}`,
          {
            severity: ErrorSeverity.ERROR,
            details: { path: vkeyPath },
            recoverable: false,
            userFixable: false
          }
        );
      }

      const fileContent = safeFileOps.readFile(filePath);
      verificationKey = JSON.parse(fileContent);
    } else {
      // Client-side: Fetch from API
      try {
        // In browser, fetch the verification key from our API endpoint
        const response = await fetch(`/api/zk/verificationKey?proofType=${proofType}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch verification key: ${response.statusText}`);
        }
        verificationKey = await response.json();
      } catch (fetchError) {
        throw createZKError(
          ZKErrorCode.VERIFICATION_KEY_NOT_FOUND,
          `Failed to fetch verification key: ${fetchError.message}`,
          {
            severity: ErrorSeverity.ERROR,
            details: { path: vkeyPath, error: fetchError.message },
            recoverable: false,
            userFixable: false
          }
        );
      }
    }

    return verificationKey;
  } catch (error) {
    // Log and re-throw
    zkErrorLogger.logError(error, {
      context: 'getVerificationKey',
      details: { proofType, circuitName }
    });
    throw error;
  }
};

/**
 * Package exports for both named and default exports
 * This creates a consistent API regardless of whether the consumer uses named or default imports
 * 
 * /* #ESM-COMPAT */
const zkUtils = {
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
  SNARK_FIELD_SIZE,

  // Export resource management integration
  resourceMonitor,
  resourceAllocator,
  adaptiveComputation
};

export default zkUtils;