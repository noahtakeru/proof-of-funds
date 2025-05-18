/**
 * ZK Proof Specific Error Handlers
 * 
 * This module provides specialized error handling for Zero-Knowledge proof operations.
 * It extends the base error system with ZK-specific functionality.
 */

import {
  ErrorCategory,
  ErrorCode,
  ErrorSeverity,
  ZkError,
  handleClientError
} from './ErrorSystem';

/**
 * ZK Error types with specific handling
 */
export const ZkErrorType = {
  CIRCUIT_ERROR: 'circuit_error',
  PROOF_GENERATION: 'proof_generation',
  PROOF_VERIFICATION: 'proof_verification',
  WITNESS_ERROR: 'witness_error',
  WASM_ERROR: 'wasm_error'
};

/**
 * Create a specialized ZK error with appropriate codes and details
 * @param {string} message - Error message
 * @param {Object} options - Error options
 * @returns {ZkError} ZK-specific error
 */
export function createZkError(message, options = {}) {
  const zkErrorType = options.zkErrorType || ZkErrorType.PROOF_GENERATION;
  let code = ErrorCode.ZK_PROOF_GENERATION_FAILED;
  let statusCode = 400;
  
  // Map error type to appropriate code
  switch (zkErrorType) {
    case ZkErrorType.PROOF_VERIFICATION:
      code = ErrorCode.ZK_VERIFICATION_FAILED;
      break;
    case ZkErrorType.WITNESS_ERROR:
      code = ErrorCode.ZK_INVALID_WITNESS;
      break;
    case ZkErrorType.CIRCUIT_ERROR:
    case ZkErrorType.WASM_ERROR:
      code = ErrorCode.ZK_CIRCUIT_ERROR;
      statusCode = 500; // Server-side issue
      break;
  }
  
  return new ZkError(message, {
    code,
    statusCode,
    severity: options.severity || ErrorSeverity.ERROR,
    details: {
      ...options.details,
      zkErrorType
    }
  });
}

/**
 * Handles ZK-specific errors with specialized messaging
 * @param {Error} error - The error object
 * @param {Function} setError - Function to set error state
 * @param {Function} logError - Optional logging function
 * @returns {Object} Handled error details
 */
export async function handleZkError(error, setError, logError) {
  // First use the base handler to process the error
  const baseHandled = await handleClientError(error, setError, logError);
  
  // Check if this is a known ZK error pattern
  const errorMessage = error.message || '';
  let enhancedMessage = baseHandled.userMessage;
  let zkErrorType = null;
  
  // Identify specific ZK error patterns
  if (errorMessage.includes('getFrLen') || errorMessage.includes('getFrLen is not a function')) {
    enhancedMessage = 'The ZK circuit is incompatible with your browser. Please try Chrome or Firefox.';
    zkErrorType = ZkErrorType.CIRCUIT_ERROR;
  } else if (errorMessage.includes('WebAssembly.compile') || errorMessage.includes('WASM')) {
    enhancedMessage = 'WebAssembly error. The circuit may be corrupted or incompatible.';
    zkErrorType = ZkErrorType.WASM_ERROR;
  } else if (errorMessage.includes('witness') || errorMessage.includes('input signal')) {
    enhancedMessage = 'Invalid input to the ZK circuit. Please check your input values.';
    zkErrorType = ZkErrorType.WITNESS_ERROR;
  } else if (errorMessage.includes('cannot verify')) {
    enhancedMessage = 'The proof could not be verified. Please try again.';
    zkErrorType = ZkErrorType.PROOF_VERIFICATION;
  } else if (errorMessage.includes('generate proof') || errorMessage.includes('fullProve')) {
    enhancedMessage = 'Failed to generate the zero-knowledge proof. Please try again.';
    zkErrorType = ZkErrorType.PROOF_GENERATION;
  }
  
  // Update error state if needed
  if (setError && enhancedMessage !== baseHandled.userMessage) {
    setError(enhancedMessage);
  }
  
  return {
    userMessage: enhancedMessage,
    technicalDetails: {
      ...baseHandled.technicalDetails,
      zkErrorType
    }
  };
}

/**
 * Safely executes a ZK operation with proper error handling
 * @param {Function} zkOperation - The ZK operation to perform
 * @param {Object} params - Parameters for the ZK operation
 * @param {Function} setError - Function to set error state
 * @param {Function} onSuccess - Callback for successful operation
 * @returns {Promise<any>} Operation result or error details
 */
export async function safeZkOperation(zkOperation, params, setError, onSuccess) {
  try {
    const result = await zkOperation(params);
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(result);
    }
    return result;
  } catch (error) {
    const handledError = await handleZkError(error, setError);
    return {
      success: false,
      error: handledError
    };
  }
}

/**
 * Determines if an error is ZK-related
 * @param {Error} error - The error to check
 * @returns {boolean} Whether it's a ZK error
 */
export function isZkError(error) {
  if (!error) return false;
  
  // Check if it's our own ZK error type
  if (error instanceof ZkError) return true;
  
  // Check error code
  if (error.code) {
    return [
      ErrorCode.ZK_PROOF_GENERATION_FAILED,
      ErrorCode.ZK_VERIFICATION_FAILED,
      ErrorCode.ZK_INVALID_WITNESS,
      ErrorCode.ZK_CIRCUIT_ERROR
    ].includes(error.code);
  }
  
  // Check error category
  if (error.category === ErrorCategory.ZK) return true;
  
  // Check error message patterns
  if (error.message) {
    return (
      error.message.includes('ZK proof') ||
      error.message.includes('snarkjs') ||
      error.message.includes('WebAssembly') ||
      error.message.includes('getFrLen') ||
      error.message.includes('circuit') ||
      error.message.includes('witness')
    );
  }
  
  return false;
}

export default {
  ZkErrorType,
  createZkError,
  handleZkError,
  safeZkOperation,
  isZkError
};