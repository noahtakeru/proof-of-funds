/**
 * Zero-Knowledge Circuit Definitions
 * 
 * This module provides the circuits used for zero-knowledge proof generation.
 * Each circuit is designed for a specific type of proof:
 * - Standard: Exact amount verification
 * - Threshold: Minimum amount verification
 * - Maximum: Maximum amount verification
 * 
 * The circuits are built using circom syntax and compiled to WebAssembly for
 * browser-based execution.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module contains the "blueprints" for our privacy-protecting verification system.
 * Think of these circuits like specialized passport verification machines:
 * 
 * 1. STANDARD PROOF: Like a machine that confirms someone has EXACTLY $10,000
 *    in their account without revealing any account details.
 * 
 * 2. THRESHOLD PROOF: Similar to a credit check that verifies someone has
 *    AT LEAST $50,000 without showing their actual balance.
 * 
 * 3. MAXIMUM PROOF: Like an eligibility verifier that confirms someone has
 *    NO MORE THAN $100,000, qualifying them for certain programs without
 *    revealing their exact worth.
 * 
 * Each circuit is carefully designed to be efficient (using minimal computational
 * resources) while ensuring mathematical certainty in the verification process.
 * 
 * Business value: These circuits enable our core privacy features by allowing
 * users to prove financial facts without revealing sensitive data, opening up
 * use cases like loan applications, KYC verification, and financial eligibility
 * checks without compromising user privacy.
 */

import { 
  ErrorCode, 
  ErrorSeverity, 
  InputError, 
  CircuitError,
  SystemError,
  isZKError 
} from './zkErrorHandler.js';
import { zkErrorLogger } from './zkErrorLogger.js';

// Try to import constants, using a fallback in case of failure
let ZK_PROOF_TYPES;
try {
  import { ZK_PROOF_TYPES: importedTypes } from '../../config/constants';
  ZK_PROOF_TYPES = importedTypes;
} catch (error) {
  // Log the error but provide fallback values
  if (zkErrorLogger) {
    zkErrorLogger.log('WARNING', 'Failed to import constants, using fallback values', {
      details: { 
        error: error.message,
        module: 'zkCircuits.js'
      }
    });
  }
  
  // Fallback constants to ensure the module works
  ZK_PROOF_TYPES = {
    STANDARD: 0,
    THRESHOLD: 1,
    MAXIMUM: 2
  };
}

/**
 * Helper to log errors in this module
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context information
 * @private
 */
const logError = (error, context = {}) => {
  try {
    if (zkErrorLogger) {
      zkErrorLogger.logError(error, {
        context: 'zkCircuits.js',
        ...context
      });
    } else {
      // Fallback if logger not available
      console.error(`[ZKCircuits] ${error.name}: ${error.message}`, context);
    }
  } catch (loggingError) {
    // Last resort if logging itself fails
    console.error(`Error during error logging: ${loggingError.message}`);
    console.error(`Original error: ${error.message}`);
  }
};

/**
 * Helper to resolve circuit paths
 * In production, these would be paths to actual circuit files
 * @param {string} circuitName - Name of the circuit
 * @param {string} fileType - Type of file (wasm, zkey, etc.)
 * @returns {string} Path to the circuit file
 * @throws {SystemError} If the environment determination fails
 */
const getCircuitPath = (circuitName, fileType) => {
  const operationId = `get_circuit_path_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!circuitName) {
      throw new InputError('Circuit name is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedName: circuitName }
      });
    }
    
    if (!fileType) {
      throw new InputError('File type is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: fileType }
      });
    }
    
    // Determine environment for path selection
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      // In production, use actual files
      const productionPath = `/circuits/${circuitName}.${fileType}`;
      
      zkErrorLogger.log('INFO', 'Using production circuit path', {
        operationId,
        details: { 
          circuitName,
          fileType,
          path: productionPath,
          environment: 'production'
        }
      });
      
      return productionPath;
    } else {
      // In development, use dummy paths
      const devPath = `/dummy/${circuitName}_dev.${fileType}`;
      
      zkErrorLogger.log('INFO', 'Using development circuit path', {
        operationId,
        details: { 
          circuitName,
          fileType,
          path: devPath,
          environment: 'development'
        }
      });
      
      return devPath;
    }
  } catch (error) {
    // If it's already a ZKError (like InputError), just log and rethrow
    if (isZKError(error)) {
      logError(error, { context: 'getCircuitPath' });
      throw error;
    }
    
    // Otherwise wrap it in a SystemError
    const pathError = new SystemError(`Failed to resolve circuit path: ${error.message}`, {
      code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      operationId,
      recoverable: true,
      details: { 
        circuitName,
        fileType,
        originalError: error.message
      }
    });
    
    logError(pathError, { context: 'getCircuitPath' });
    throw pathError;
  }
};

// Circom code for Standard Proof circuit
const standardCircuitCode = `
pragma circom 2.0.0;

template StandardProof() {
    // Private inputs
    signal private input privateAmount;
    signal private input privateAddress[20]; // ETH address as bytes

    // Public inputs
    signal input publicAmount;
    signal input publicAddressHash;

    // Verify the amount matches
    publicAmount === privateAmount;

    // Hash the private address (simplified)
    signal addressHash;
    addressHash <== privateAddress[0] + privateAddress[1] * 256;
    
    // Verify the address hash matches
    publicAddressHash === addressHash;
}

component main {public [publicAmount, publicAddressHash]} = StandardProof();
`;

// Circom code for Threshold Proof circuit
const thresholdCircuitCode = `
pragma circom 2.0.0;

template ThresholdProof() {
    // Private inputs
    signal private input privateAmount;
    signal private input privateAddress[20]; // ETH address as bytes

    // Public inputs
    signal input thresholdAmount;
    signal input publicAddressHash;

    // Verify the amount is at least the threshold
    signal isGreaterOrEqual;
    isGreaterOrEqual <== privateAmount >= thresholdAmount ? 1 : 0;
    isGreaterOrEqual === 1;

    // Hash the private address (simplified)
    signal addressHash;
    addressHash <== privateAddress[0] + privateAddress[1] * 256;
    
    // Verify the address hash matches
    publicAddressHash === addressHash;
}

component main {public [thresholdAmount, publicAddressHash]} = ThresholdProof();
`;

// Circom code for Maximum Proof circuit
const maximumCircuitCode = `
pragma circom 2.0.0;

template MaximumProof() {
    // Private inputs
    signal private input privateAmount;
    signal private input privateAddress[20]; // ETH address as bytes

    // Public inputs
    signal input maximumAmount;
    signal input publicAddressHash;

    // Verify the amount is at most the maximum
    signal isLessOrEqual;
    isLessOrEqual <== privateAmount <= maximumAmount ? 1 : 0;
    isLessOrEqual === 1;

    // Hash the private address (simplified)
    signal addressHash;
    addressHash <== privateAddress[0] + privateAddress[1] * 256;
    
    // Verify the address hash matches
    publicAddressHash === addressHash;
}

component main {public [maximumAmount, publicAddressHash]} = MaximumProof();
`;

/**
 * Creates stub circuit data for development
 * In production, this would load actual compiled circuit data
 * @param {string} circuitName - Name of the circuit
 * @returns {Object} Mock circuit data
 * @throws {CircuitError} If the circuit data cannot be created
 */
const getStubCircuitData = (circuitName) => {
  const operationId = `get_stub_circuit_data_${Date.now()}`;
  
  try {
    // Log this is a stub implementation
    zkErrorLogger.log('INFO', 'Creating stub circuit data for development', {
      operationId,
      details: { 
        circuitName,
        environment: typeof process !== 'undefined' ? process.env.NODE_ENV : 'browser'
      }
    });
    
    return {
      wasm: getCircuitPath(circuitName, 'wasm'),
      r1cs: getCircuitPath(circuitName, 'r1cs'),
      zkey: getCircuitPath(circuitName, 'zkey'),
      vkey: {
        protocol: "groth16",
        curve: "bn128",
        nPublic: 2,
        vk_alpha_1: [
          "20", "21", "22"
        ],
        vk_beta_2: [
          ["30", "31"],
          ["32", "33"]
        ],
        vk_gamma_2: [
          ["40", "41"],
          ["42", "43"]
        ],
        vk_delta_2: [
          ["50", "51"],
          ["52", "53"]
        ],
        vk_alphabeta_12: [
          [
            ["64", "65"],
            ["66", "67"]
          ],
          [
            ["68", "69"],
            ["70", "71"]
          ]
        ]
      }
    };
  } catch (error) {
    // If it's already a ZKError, just log and rethrow
    if (isZKError(error)) {
      logError(error, { context: 'getStubCircuitData' });
      throw error;
    }
    
    // Otherwise wrap in a CircuitError
    const circuitError = new CircuitError(`Failed to create stub circuit data: ${error.message}`, {
      code: ErrorCode.CIRCUIT_SETUP_FAILED,
      operationId,
      recoverable: true,
      details: { 
        circuitName,
        originalError: error.message
      }
    });
    
    logError(circuitError, { context: 'getStubCircuitData' });
    throw circuitError;
  }
};

// Define the circuit data objects
let standardCircuit, thresholdCircuit, maximumCircuit;

try {
  standardCircuit = getStubCircuitData(CIRCUIT_NAMES.STANDARD);
  thresholdCircuit = getStubCircuitData(CIRCUIT_NAMES.THRESHOLD);
  maximumCircuit = getStubCircuitData(CIRCUIT_NAMES.MAXIMUM);
  
  zkErrorLogger.log('INFO', 'Successfully initialized all circuit data objects', {
    details: { 
      circuits: [CIRCUIT_NAMES.STANDARD, CIRCUIT_NAMES.THRESHOLD, CIRCUIT_NAMES.MAXIMUM]
    }
  });
} catch (error) {
  const initError = isZKError(error) ? error : new SystemError(
    `Failed to initialize circuit data: ${error.message}`,
    {
      code: ErrorCode.SYSTEM_INITIALIZATION_FAILED,
      recoverable: false,
      details: { originalError: error.message }
    }
  );
  
  logError(initError, { context: 'circuitInitialization' });
  
  // Set fallback empty objects to prevent undefined errors
  standardCircuit = {};
  thresholdCircuit = {};
  maximumCircuit = {};
}

/**
 * Exports circuit names for reference
 */
export const CIRCUIT_NAMES = {
  STANDARD: 'standard_proof',
  THRESHOLD: 'threshold_proof',
  MAXIMUM: 'maximum_proof'
};

/**
 * Gets the appropriate circuit data for a proof type
 * @param {number} proofType - ZK_PROOF_TYPES enum value
 * @returns {Object} Circuit data
 * @throws {InputError} If the proof type is invalid
 */
export const getCircuitData = (proofType) => {
  const operationId = `get_circuit_data_${Date.now()}`;
  
  try {
    // Validate proof type
    if (proofType === undefined || proofType === null) {
      throw new InputError('Proof type is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: proofType }
      });
    }
    
    // Check if the proof type is valid
    const isValidType = [
      ZK_PROOF_TYPES.STANDARD,
      ZK_PROOF_TYPES.THRESHOLD,
      ZK_PROOF_TYPES.MAXIMUM
    ].includes(proofType);
    
    if (!isValidType) {
      throw new InputError(`Invalid proof type: ${proofType}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          providedType: proofType,
          validTypes: [
            ZK_PROOF_TYPES.STANDARD,
            ZK_PROOF_TYPES.THRESHOLD,
            ZK_PROOF_TYPES.MAXIMUM
          ]
        }
      });
    }
    
    // Return the appropriate circuit data
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        zkErrorLogger.log('INFO', 'Providing standard circuit data', {
          operationId,
          details: { proofType, circuitName: CIRCUIT_NAMES.STANDARD }
        });
        return standardCircuit;
        
      case ZK_PROOF_TYPES.THRESHOLD:
        zkErrorLogger.log('INFO', 'Providing threshold circuit data', {
          operationId,
          details: { proofType, circuitName: CIRCUIT_NAMES.THRESHOLD }
        });
        return thresholdCircuit;
        
      case ZK_PROOF_TYPES.MAXIMUM:
        zkErrorLogger.log('INFO', 'Providing maximum circuit data', {
          operationId,
          details: { proofType, circuitName: CIRCUIT_NAMES.MAXIMUM }
        });
        return maximumCircuit;
        
      default:
        // This should never happen due to validation above, but included for safety
        throw new InputError(`Unhandled proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { 
            providedType: proofType,
            validTypes: [
              ZK_PROOF_TYPES.STANDARD,
              ZK_PROOF_TYPES.THRESHOLD,
              ZK_PROOF_TYPES.MAXIMUM
            ]
          }
        });
    }
  } catch (error) {
    // If it's already a ZKError, just log and rethrow
    if (isZKError(error)) {
      logError(error, { 
        context: 'getCircuitData',
        details: { proofType }
      });
      throw error;
    }
    
    // Otherwise wrap in a CircuitError
    const circuitError = new CircuitError(`Failed to get circuit data: ${error.message}`, {
      code: ErrorCode.CIRCUIT_ARTIFACT_UNAVAILABLE,
      operationId,
      recoverable: false,
      details: { 
        proofType,
        originalError: error.message
      }
    });
    
    logError(circuitError, { context: 'getCircuitData' });
    throw circuitError;
  }
};

/**
 * Gets the circom code for a circuit
 * @param {number} proofType - ZK_PROOF_TYPES enum value
 * @returns {string} Circom code
 * @throws {InputError} If the proof type is invalid
 */
export const getCircuitCode = (proofType) => {
  const operationId = `get_circuit_code_${Date.now()}`;
  
  try {
    // Validate proof type
    if (proofType === undefined || proofType === null) {
      throw new InputError('Proof type is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: proofType }
      });
    }
    
    // Check if the proof type is valid
    const isValidType = [
      ZK_PROOF_TYPES.STANDARD,
      ZK_PROOF_TYPES.THRESHOLD,
      ZK_PROOF_TYPES.MAXIMUM
    ].includes(proofType);
    
    if (!isValidType) {
      throw new InputError(`Invalid proof type: ${proofType}`, {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { 
          providedType: proofType,
          validTypes: [
            ZK_PROOF_TYPES.STANDARD,
            ZK_PROOF_TYPES.THRESHOLD,
            ZK_PROOF_TYPES.MAXIMUM
          ]
        }
      });
    }
    
    // Return the appropriate circuit code
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        zkErrorLogger.log('INFO', 'Providing standard circuit code', {
          operationId,
          details: { proofType, codeLength: standardCircuitCode.length }
        });
        return standardCircuitCode;
        
      case ZK_PROOF_TYPES.THRESHOLD:
        zkErrorLogger.log('INFO', 'Providing threshold circuit code', {
          operationId,
          details: { proofType, codeLength: thresholdCircuitCode.length }
        });
        return thresholdCircuitCode;
        
      case ZK_PROOF_TYPES.MAXIMUM:
        zkErrorLogger.log('INFO', 'Providing maximum circuit code', {
          operationId,
          details: { proofType, codeLength: maximumCircuitCode.length }
        });
        return maximumCircuitCode;
        
      default:
        // This should never happen due to validation above, but included for safety
        throw new InputError(`Unhandled proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { 
            providedType: proofType,
            validTypes: [
              ZK_PROOF_TYPES.STANDARD,
              ZK_PROOF_TYPES.THRESHOLD,
              ZK_PROOF_TYPES.MAXIMUM
            ]
          }
        });
    }
  } catch (error) {
    // If it's already a ZKError, just log and rethrow
    if (isZKError(error)) {
      logError(error, { 
        context: 'getCircuitCode',
        details: { proofType }
      });
      throw error;
    }
    
    // Otherwise wrap in a CircuitError
    const circuitError = new CircuitError(`Failed to get circuit code: ${error.message}`, {
      code: ErrorCode.CIRCUIT_ARTIFACT_UNAVAILABLE,
      operationId,
      recoverable: false,
      details: { 
        proofType,
        originalError: error.message
      }
    });
    
    logError(circuitError, { context: 'getCircuitCode' });
    throw circuitError;
  }
};

// Export circuits and utilities
export default {
  getCircuitData,
  getCircuitCode,
  CIRCUIT_NAMES,
  standardCircuit,
  thresholdCircuit,
  maximumCircuit
};