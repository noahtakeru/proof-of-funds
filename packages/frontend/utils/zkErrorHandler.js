/**
 * ZK Error Handler Utility
 * 
 * This utility helps handle ZK-related errors in the frontend without blocking UI navigation.
 * It follows the token-agnostic wallet scanning plan by not using fallbacks or hiding errors.
 * 
 * This file now uses the unified error handling system.
 */

import { 
  handleZkError as unifiedHandleZkError,
  isZkError as unifiedIsZkError,
  safeZkOperation as unifiedSafeZkOperation
} from '@proof-of-funds/common/src/error-handling';

/**
 * Handles ZK errors from API responses
 * @param {Object} error - The error object from fetch responses
 * @param {Function} setError - Function to set error state in UI
 * @param {Function} logError - Optional function to log errors
 * @returns {Object} - User-friendly error information
 */
export const handleZkError = async (error, setError, logError) => {
  return unifiedHandleZkError(error, setError, logError);
};

/**
 * Determines if the error is related to ZK proof functionality
 * @param {Object} error - Error object
 * @returns {boolean} - Whether this is a ZK-related error
 */
export const isZkError = (error) => {
  return unifiedIsZkError(error);
};

/**
 * Safely handles ZK operations with proper error handling
 * @param {Function} zkOperation - The ZK operation function to perform
 * @param {Object} params - Parameters for the ZK operation
 * @param {Function} setError - Function to set error state
 * @param {Function} onSuccess - Callback for successful operation
 */
export const safeZkOperation = async (zkOperation, params, setError, onSuccess) => {
  return unifiedSafeZkOperation(zkOperation, params, setError, onSuccess);
};

export default {
  handleZkError,
  isZkError,
  safeZkOperation
};