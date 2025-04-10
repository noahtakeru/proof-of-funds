/**
 * ZK Recovery System
 * 
 * This module provides sophisticated recovery mechanisms for handling failures
 * during ZK operations, including retries, checkpointing, and partial completion handling.
 * 
 * Key features:
 * - Exponential backoff with jitter for retries
 * - Operation-specific retry policies
 * - Partial completion handling for batch operations
 * - Checkpointing for long-running operations
 * - Resumable proof generation
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as a safety net for the entire proof system. It's like having multiple backup
 * systems for a critical operation:
 * 
 * 1. When something fails, it tries again with smart timing (like waiting a bit longer
 *    between each attempt).
 * 2. It saves progress checkpoints so operations can resume exactly where they left off
 *    if interrupted (like saving your game progress).
 * 3. It handles processing multiple items, ensuring that if one item fails, the others 
 *    can still succeed (like a package delivery system that doesn't stop if one package
 *    has an issue).
 * 
 * This provides a more robust user experience with fewer complete failures and
 * allows large operations to recover from temporary issues without starting over.
 */

import zkErrorLogger from './zkErrorLogger.js';
import memoryManager from './memoryManager.js';
import zkErrorHandler from './zkErrorHandler.js';
import secureStorage from './secureStorage.js';

// Destructure error classes for easier use
const { 
  ZKError,
  SystemError, 
  NetworkError,
  InputError,
  SecurityError,
  MemoryError
} = zkErrorHandler;

// Error code constants
const { ErrorCode } = zkErrorHandler;

// Default retry configuration
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3,
  shouldRetry: null // Custom function to determine if retry should happen
};

// Default checkpoint configuration
const DEFAULT_CHECKPOINT_CONFIG = {
  checkpointIntervalMs: 5000,
  storageKey: 'zk_operation_checkpoints',
  expiryTimeMs: 24 * 60 * 60 * 1000, // 24 hours
  compressionEnabled: true,
  encryptionEnabled: true
};

/**
 * Generate a random jitter value within the specified range
 * @param {number} factor - Jitter factor (0-1)
 * @param {number} value - Base value
 * @returns {number} Jitter amount
 * @throws {InputError} If parameters are invalid
 */
function getRandomJitter(factor, value) {
  const operationId = `jitter_${Date.now()}`;
  
  try {
    // Validate inputs
    if (typeof factor !== 'number' || factor < 0 || factor > 1) {
      throw new InputError('Jitter factor must be a number between 0 and 1', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { factor }
      });
    }
    
    if (typeof value !== 'number' || value < 0) {
      throw new InputError('Base value must be a positive number', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { value }
      });
    }
    
    // Jitter range is up to factor% of the value
    const maxJitter = value * factor;
    
    // Random amount between -maxJitter/2 and +maxJitter/2
    return (Math.random() - 0.5) * maxJitter;
  } catch (error) {
    // If it's already a ZKError, just re-throw it
    if (zkErrorHandler.isZKError(error)) {
      throw error;
    }
    
    // Otherwise, wrap it in a ZKError
    const zkError = new SystemError(`Error generating jitter: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: false,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'getRandomJitter' });
    throw zkError;
  }
}

/**
 * Calculate retry delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 * @throws {InputError} If parameters are invalid
 */
function calculateRetryDelay(attempt, config) {
  const operationId = `retryDelay_${Date.now()}`;
  
  try {
    // Validate inputs
    if (typeof attempt !== 'number' || attempt < 0 || !Number.isInteger(attempt)) {
      throw new InputError('Attempt must be a non-negative integer', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { attempt }
      });
    }
    
    if (!config || typeof config !== 'object') {
      throw new InputError('Config must be an object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true, // Recoverable because we can use default config
        userFixable: true,
        details: { config }
      });
    }
    
    const { baseDelayMs, maxDelayMs, jitterFactor } = {
      ...DEFAULT_RETRY_CONFIG,
      ...config
    };
    
    // Additional validation for config values
    if (typeof baseDelayMs !== 'number' || baseDelayMs <= 0) {
      throw new InputError('baseDelayMs must be a positive number', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true, // Recoverable with default value
        userFixable: true,
        details: { baseDelayMs }
      });
    }
    
    if (typeof maxDelayMs !== 'number' || maxDelayMs <= 0) {
      throw new InputError('maxDelayMs must be a positive number', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true, // Recoverable with default value
        userFixable: true,
        details: { maxDelayMs }
      });
    }
    
    // Calculate exponential delay: baseDelay * 2^attempt
    let delay = baseDelayMs * Math.pow(2, attempt);
    
    // Apply maximum delay cap
    delay = Math.min(delay, maxDelayMs);
    
    // Add jitter to prevent thundering herd problem
    if (jitterFactor > 0) {
      try {
        delay += getRandomJitter(jitterFactor, delay);
      } catch (jitterError) {
        // Log but continue without jitter
        zkErrorLogger.logError(jitterError, { 
          operationId,
          context: 'calculateRetryDelay.jitter'
        });
        // Continuing without jitter is acceptable
      }
    }
    
    // Ensure delay is positive
    return Math.max(delay, 0);
  } catch (error) {
    // If it's already a ZKError, just re-throw it
    if (zkErrorHandler.isZKError(error)) {
      throw error;
    }
    
    // Otherwise, wrap it in a ZKError
    const zkError = new SystemError(`Error calculating retry delay: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: true, // We can recover by using a default delay
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'calculateRetryDelay' });
    
    // Return a safe default value rather than throwing
    return DEFAULT_RETRY_CONFIG.baseDelayMs; 
  }
}

/**
 * Determines if an operation should be retried based on the error
 * @param {Error} error - The error that occurred
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {boolean} Whether to retry
 * @throws {InputError} If parameters are invalid
 */
function shouldRetryOperation(error, attempt, config) {
  const operationId = `shouldRetry_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!error) {
      throw new InputError('Error is required', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true
      });
    }
    
    if (typeof attempt !== 'number' || attempt < 0 || !Number.isInteger(attempt)) {
      throw new InputError('Attempt must be a non-negative integer', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { attempt }
      });
    }
    
    if (!config || typeof config !== 'object') {
      throw new InputError('Config must be an object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true, // Recoverable because we can use default config
        userFixable: true
      });
    }
    
    const { maxRetries, shouldRetry } = {
      ...DEFAULT_RETRY_CONFIG,
      ...config
    };
    
    // Validate maxRetries
    if (typeof maxRetries !== 'number' || maxRetries < 0 || !Number.isInteger(maxRetries)) {
      throw new InputError('maxRetries must be a non-negative integer', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true, // Recoverable with default value
        userFixable: true,
        details: { maxRetries }
      });
    }
    
    // Stop if we've reached max retries
    if (attempt >= maxRetries) {
      // Log for debugging retry behavior
      zkErrorLogger.log('INFO', `Not retrying: reached max retries (${maxRetries})`, {
        operationId,
        context: 'shouldRetryOperation',
        details: {
          attempt,
          maxRetries,
          errorType: error.name || 'Unknown'
        }
      });
      return false;
    }
    
    // Use custom function if provided
    if (typeof shouldRetry === 'function') {
      try {
        const result = shouldRetry(error, attempt);
        return !!result; // Convert to boolean
      } catch (customFnError) {
        // Log error in custom retry function
        zkErrorLogger.logError(customFnError, {
          operationId,
          context: 'shouldRetryOperation.customRetryFunction',
          details: {
            originalError: error.message,
            attempt
          }
        });
        
        // Fall back to default retry logic
        zkErrorLogger.log('WARNING', 'Custom retry function failed, using default retry logic', {
          operationId,
          context: 'shouldRetryOperation'
        });
        // Continue with default logic below
      }
    }
    
    // ZK error-specific logic
    if (zkErrorHandler.isZKError(error)) {
      // Only retry recoverable errors
      if (!error.recoverable) {
        zkErrorLogger.log('INFO', `Not retrying: ZKError marked as non-recoverable`, {
          operationId,
          context: 'shouldRetryOperation',
          details: {
            errorCode: error.code,
            errorType: error.name
          }
        });
        return false;
      }
      
      // Always retry network errors (within max retries)
      if (error instanceof NetworkError) {
        zkErrorLogger.log('INFO', `Retrying: NetworkError type`, {
          operationId,
          context: 'shouldRetryOperation',
          details: {
            errorCode: error.code,
            attempt,
            maxRetries
          }
        });
        return true;
      }
      
      // Don't retry user-fixable errors automatically
      if (error.userFixable) {
        zkErrorLogger.log('INFO', `Not retrying: Error requires user action`, {
          operationId,
          context: 'shouldRetryOperation',
          details: {
            errorCode: error.code,
            errorType: error.name,
            recommendedAction: error.recommendedAction || 'No action specified'
          }
        });
        return false;
      }
      
      // For SystemError, retry if specifically marked as recoverable
      if (error instanceof SystemError && error.recoverable) {
        zkErrorLogger.log('INFO', `Retrying: SystemError marked as recoverable`, {
          operationId,
          context: 'shouldRetryOperation',
          details: {
            errorCode: error.code,
            attempt
          }
        });
        return true;
      }
    }
    
    // For non-ZKErrors, retry only specific types
    if (error instanceof TypeError || error instanceof ReferenceError) {
      zkErrorLogger.log('INFO', `Not retrying: ${error.name} indicates code issue, not transient failure`, {
        operationId,
        context: 'shouldRetryOperation'
      });
      return false; // These usually indicate code issues, not transient failures
    }
    
    // Retry network-related errors
    if (error.message && (
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('connection') ||
      error.message.toLowerCase().includes('offline') ||
      error.message.toLowerCase().includes('temporary') ||
      error.message.toLowerCase().includes('unavailable')
    )) {
      zkErrorLogger.log('INFO', `Retrying: Error message suggests network/temporary issue`, {
        operationId,
        context: 'shouldRetryOperation',
        details: {
          errorType: error.name || 'Unknown',
          attempt,
          messagePattern: 'network/timeout/connection related'
        }
      });
      return true;
    }
    
    // Default to not retrying
    zkErrorLogger.log('INFO', `Not retrying: No retry criteria matched for error type ${error.name || 'Unknown'}`, {
      operationId,
      context: 'shouldRetryOperation',
      details: {
        errorMessage: error.message
      }
    });
    return false;
  } catch (validationError) {
    // If it's already a ZKError, just re-throw it
    if (zkErrorHandler.isZKError(validationError)) {
      zkErrorLogger.logError(validationError, { 
        context: 'shouldRetryOperation.validation' 
      });
      throw validationError;
    }
    
    // Otherwise, wrap it in a ZKError
    const zkError = new SystemError(`Error determining retry behavior: ${validationError.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: true, // We can recover by defaulting to false
      details: { originalError: validationError.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'shouldRetryOperation' });
    
    // Default to not retrying in case of error in the retry logic itself
    return false;
  }
}

/**
 * Execute a function with retry logic
 * @param {Function} fn - Function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the function
 * @throws {InputError} If parameters are invalid
 * @throws {Error} Original error after retries are exhausted
 */
async function withRetry(fn, options = {}) {
  // Generate operation ID for tracking if not provided
  const operationId = options.operationId || `retry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  try {
    // Validate inputs
    if (typeof fn !== 'function') {
      throw new InputError('First parameter must be a function', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true
      });
    }
    
    if (options !== undefined && (typeof options !== 'object' || Array.isArray(options))) {
      throw new InputError('Options must be an object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true, // Recoverable with default options
        userFixable: true,
        details: { optionsType: typeof options }
      });
    }
    
    // Merge config with defaults
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };
    let attempt = 0;
    let lastError = null;
    
    // Function to handle progress reporting
    const reportProgress = (progress, status) => {
      try {
        if (typeof options.onProgress === 'function') {
          options.onProgress({
            operationId,
            attempt: attempt + 1,
            maxAttempts: config.maxRetries + 1,
            progress,
            status
          });
        }
      } catch (progressError) {
        // Log but don't fail the operation if progress reporting fails
        zkErrorLogger.logError(progressError, {
          operationId,
          context: 'withRetry.reportProgress',
          details: {
            progress,
            status
          }
        });
      }
    };
    
    // Initial progress report
    reportProgress(0, 'Starting operation');
    
    zkErrorLogger.log('INFO', 'Starting retriable operation', {
      operationId,
      context: 'withRetry',
      details: {
        maxRetries: config.maxRetries,
        baseDelayMs: config.baseDelayMs
      }
    });
    
    while (true) {
      try {
        // Execute the function
        const result = await fn(attempt);
        
        // If successful, report final progress and return result
        reportProgress(100, 'Operation completed successfully');
        
        // Log retry info if this wasn't the first attempt
        if (attempt > 0) {
          zkErrorLogger.log('INFO', `Operation succeeded after ${attempt + 1} attempts`, {
            operationId,
            category: 'recovery',
            details: {
              attempts: attempt + 1,
              recoveryType: 'retry',
              originalError: lastError?.message
            }
          });
        } else {
          zkErrorLogger.log('INFO', 'Operation succeeded on first attempt', {
            operationId,
            category: 'recovery'
          });
        }
        
        return result;
      } catch (error) {
        // Save error for logging
        lastError = error;
        
        // Log the error
        zkErrorLogger.logError(error, {
          operationId,
          additionalData: {
            context: 'withRetry.operation',
            attempt,
            maxRetries: config.maxRetries
          }
        });
        
        // Check if we should retry
        let shouldRetry;
        try {
          shouldRetry = shouldRetryOperation(error, attempt, config);
        } catch (retryDecisionError) {
          // If there's an error in deciding whether to retry, default to not retrying
          zkErrorLogger.logError(retryDecisionError, {
            operationId,
            context: 'withRetry.retryDecision',
            details: {
              originalError: error.message
            }
          });
          shouldRetry = false;
        }
        
        if (shouldRetry) {
          // Increment attempt counter
          attempt++;
          
          // Calculate delay for next retry
          let delay;
          try {
            delay = calculateRetryDelay(attempt, config);
          } catch (delayError) {
            // If there's an error calculating delay, use a safe default
            zkErrorLogger.logError(delayError, {
              operationId,
              context: 'withRetry.calculateDelay'
            });
            
            // Use exponential backoff with default values
            delay = DEFAULT_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
            delay = Math.min(delay, DEFAULT_RETRY_CONFIG.maxDelayMs);
          }
          
          // Report retry status
          zkErrorLogger.log('INFO', `Retrying operation (attempt ${attempt + 1}/${config.maxRetries + 1})`, {
            operationId,
            category: 'recovery',
            details: {
              attempt: attempt + 1,
              maxRetries: config.maxRetries,
              delayMs: delay,
              errorType: lastError.name || 'Unknown'
            }
          });
          
          reportProgress(
            Math.min(90, (attempt / (config.maxRetries + 1)) * 100),
            `Retrying (attempt ${attempt + 1}/${config.maxRetries + 1}) after ${Math.round(delay / 100) / 10}s`
          );
          
          try {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
          } catch (timeoutError) {
            // If there's an error with setTimeout (extremely unlikely), log and continue immediately
            zkErrorLogger.logError(timeoutError, {
              operationId,
              context: 'withRetry.delayTimer'
            });
          }
          
          // Continue to next attempt
          continue;
        }
        
        // If we shouldn't retry, report failure and throw
        zkErrorLogger.log('WARNING', `Operation failed after ${attempt + 1} attempts - no further retries`, {
          operationId,
          category: 'recovery',
          details: {
            attempts: attempt + 1,
            recoveryType: 'retry_exhausted',
            errorType: lastError.name || 'Unknown',
            errorMessage: lastError.message
          }
        });
        
        reportProgress(0, `Operation failed after ${attempt + 1} attempts`);
        
        // Enhance the error with retry information
        if (zkErrorHandler.isZKError(error)) {
          // Add retry context to existing ZKError
          error.details = {
            ...error.details,
            retryAttempts: attempt + 1,
            maxRetries: config.maxRetries,
            retryExhausted: true
          };
          throw error;
        } else {
          // Wrap non-ZKError with retry context
          const zkError = new SystemError(`Operation failed after ${attempt + 1} attempts: ${error.message}`, {
            code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
            operationId,
            recoverable: false,
            details: { 
              originalError: error.message,
              retryAttempts: attempt + 1,
              maxRetries: config.maxRetries,
              retryExhausted: true
            }
          });
          
          throw zkError;
        }
      }
    }
  } catch (validationError) {
    // If it's already a ZKError, just re-throw it
    if (zkErrorHandler.isZKError(validationError)) {
      zkErrorLogger.logError(validationError, { 
        context: 'withRetry.validation' 
      });
      throw validationError;
    }
    
    // Otherwise, wrap it in a ZKError
    const zkError = new SystemError(`Error in retry mechanism: ${validationError.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: false,
      details: { originalError: validationError.message }
    });
    
    zkErrorLogger.logError(zkError, { context: 'withRetry' });
    throw zkError;
  }
}

/**
 * Create a checkpoint for resumable operations
 * @param {string} operationId - Unique operation identifier
 * @param {Object} state - Operation state to checkpoint
 * @param {Object} options - Checkpoint options
 * @returns {Promise<boolean>} Success indicator
 * @throws {InputError} If parameters are invalid (but catches internally and returns false)
 */
async function createCheckpoint(operationId, state, options = {}) {
  // Use the provided operationId or generate one if not provided
  const opId = operationId || `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  try {
    // Validate inputs
    if (!operationId || typeof operationId !== 'string') {
      throw new InputError('Operation ID is required and must be a string', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId: opId,
        recoverable: false,
        userFixable: true
      });
    }
    
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new InputError('State must be a non-null object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId: opId,
        recoverable: false,
        userFixable: true,
        details: { 
          stateType: typeof state,
          stateIsArray: Array.isArray(state)
        }
      });
    }
    
    if (options !== undefined && (typeof options !== 'object' || Array.isArray(options))) {
      throw new InputError('Options must be an object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId: opId,
        recoverable: true, // Recoverable with default options
        userFixable: true,
        details: { optionsType: typeof options }
      });
    }
    
    // Merge with default config
    const config = { ...DEFAULT_CHECKPOINT_CONFIG, ...options };
    
    // Validate critical config options
    if (typeof config.expiryTimeMs !== 'number' || config.expiryTimeMs <= 0) {
      zkErrorLogger.log('WARNING', 'Invalid expiryTimeMs, using default', {
        operationId: opId,
        context: 'createCheckpoint',
        details: { 
          providedValue: config.expiryTimeMs,
          usingDefault: DEFAULT_CHECKPOINT_CONFIG.expiryTimeMs
        }
      });
      config.expiryTimeMs = DEFAULT_CHECKPOINT_CONFIG.expiryTimeMs;
    }
    
    if (typeof config.storageKey !== 'string' || config.storageKey.trim() === '') {
      zkErrorLogger.log('WARNING', 'Invalid storageKey, using default', {
        operationId: opId,
        context: 'createCheckpoint',
        details: { 
          providedValue: config.storageKey,
          usingDefault: DEFAULT_CHECKPOINT_CONFIG.storageKey
        }
      });
      config.storageKey = DEFAULT_CHECKPOINT_CONFIG.storageKey;
    }
    
    // Add metadata to checkpoint
    const checkpointData = {
      id: opId,
      timestamp: Date.now(),
      expiresAt: Date.now() + config.expiryTimeMs,
      state,
      metadata: {
        version: '1.0.0',
        type: options.type || 'generic',
        context: options.context || {},
        compressionEnabled: config.compressionEnabled,
        encryptionEnabled: config.encryptionEnabled
      }
    };
    
    zkErrorLogger.log('INFO', 'Creating checkpoint', {
      operationId: opId,
      context: 'createCheckpoint',
      details: {
        type: checkpointData.metadata.type,
        expiresAt: new Date(checkpointData.expiresAt).toISOString(),
        storageKey: `${config.storageKey}:${opId}`
      }
    });
    
    // Use secure storage to persist checkpoint
    try {
      const success = await secureStorage.setItem(
        `${config.storageKey}:${opId}`,
        checkpointData,
        {
          compress: config.compressionEnabled,
          encrypt: config.encryptionEnabled
        }
      );
      
      if (success) {
        zkErrorLogger.log('INFO', 'Checkpoint created successfully', {
          operationId: opId,
          context: 'createCheckpoint',
          details: {
            stateSize: JSON.stringify(state).length,
            type: checkpointData.metadata.type
          }
        });
      } else {
        zkErrorLogger.log('WARNING', 'Failed to create checkpoint', {
          operationId: opId,
          context: 'createCheckpoint'
        });
      }
      
      return success;
    } catch (storageError) {
      // Handle storage-specific errors
      const errorMessage = `Failed to store checkpoint: ${storageError.message}`;
      const zkError = zkErrorHandler.isZKError(storageError) 
        ? storageError 
        : new SystemError(errorMessage, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId: opId,
            recoverable: true,
            details: { originalError: storageError.message }
          });
          
      zkErrorLogger.logError(zkError, {
        operationId: opId,
        context: 'createCheckpoint.storage',
        details: {
          storageKey: `${config.storageKey}:${opId}`
        }
      });
      
      return false;
    }
  } catch (error) {
    // Log error but don't fail the main operation
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'createCheckpoint'
      });
    } else {
      // Wrap non-ZKError
      const zkError = new SystemError(`Checkpoint creation error: ${error.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId: opId,
        recoverable: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(zkError, {
        context: 'createCheckpoint'
      });
    }
    
    return false;
  }
}

/**
 * Retrieve a checkpoint for resuming an operation
 * @param {string} operationId - Unique operation identifier
 * @param {Object} options - Checkpoint options
 * @returns {Promise<Object|null>} Checkpoint state or null if not found
 * @throws {InputError} If parameters are invalid (but catches internally and returns null)
 */
async function getCheckpoint(operationId, options = {}) {
  // Generate operation ID for error tracking if not provided
  const opId = operationId || `retrieveCheckpoint_${Date.now()}`;
  
  try {
    // Validate inputs
    if (!operationId || typeof operationId !== 'string') {
      throw new InputError('Operation ID is required and must be a string', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId: opId,
        recoverable: false,
        userFixable: true
      });
    }
    
    if (options !== undefined && (typeof options !== 'object' || Array.isArray(options))) {
      throw new InputError('Options must be an object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId: opId,
        recoverable: true, // Recoverable with default options
        userFixable: true,
        details: { optionsType: typeof options }
      });
    }
    
    // Merge with default config
    const config = { ...DEFAULT_CHECKPOINT_CONFIG, ...options };
    
    // Validate critical config options
    if (typeof config.storageKey !== 'string' || config.storageKey.trim() === '') {
      zkErrorLogger.log('WARNING', 'Invalid storageKey, using default', {
        operationId: opId,
        context: 'getCheckpoint',
        details: { 
          providedValue: config.storageKey,
          usingDefault: DEFAULT_CHECKPOINT_CONFIG.storageKey
        }
      });
      config.storageKey = DEFAULT_CHECKPOINT_CONFIG.storageKey;
    }
    
    zkErrorLogger.log('INFO', 'Retrieving checkpoint', {
      operationId: opId,
      context: 'getCheckpoint',
      details: {
        storageKey: `${config.storageKey}:${operationId}`
      }
    });
    
    // Retrieve checkpoint data
    try {
      const checkpointData = await secureStorage.getItem(
        `${config.storageKey}:${operationId}`,
        {
          decompress: config.compressionEnabled,
          decrypt: config.encryptionEnabled
        }
      );
      
      if (!checkpointData) {
        zkErrorLogger.log('INFO', 'No checkpoint found', {
          operationId: opId,
          context: 'getCheckpoint',
          details: {
            storageKey: `${config.storageKey}:${operationId}`
          }
        });
        return null;
      }
      
      // Basic validation of checkpoint data
      if (!checkpointData.state || !checkpointData.id || !checkpointData.timestamp) {
        throw new SystemError('Retrieved checkpoint data is malformed', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId: opId,
          recoverable: false,
          details: { 
            hasState: !!checkpointData.state,
            hasId: !!checkpointData.id,
            hasTimestamp: !!checkpointData.timestamp 
          }
        });
      }
      
      // Check if checkpoint has expired
      if (checkpointData.expiresAt && checkpointData.expiresAt < Date.now()) {
        zkErrorLogger.log('INFO', 'Checkpoint has expired, removing', {
          operationId: opId,
          context: 'getCheckpoint',
          details: {
            expiredAt: new Date(checkpointData.expiresAt).toISOString(),
            currentTime: new Date().toISOString(),
            checkpointAge: Math.round((Date.now() - checkpointData.timestamp) / (1000 * 60)) + ' minutes'
          }
        });
        
        try {
          // Remove expired checkpoint
          await secureStorage.removeItem(`${config.storageKey}:${operationId}`);
        } catch (removeError) {
          // Log but continue - main flow can continue even if cleanup fails
          zkErrorLogger.logError(removeError, {
            operationId: opId,
            context: 'getCheckpoint.removeExpired'
          });
        }
        
        return null;
      }
      
      // Log successful checkpoint retrieval
      zkErrorLogger.log('INFO', 'Successfully retrieved checkpoint', {
        operationId: opId,
        context: 'getCheckpoint',
        details: {
          type: checkpointData.metadata?.type || 'unknown',
          age: Math.round((Date.now() - checkpointData.timestamp) / (1000 * 60)) + ' minutes',
          expiresIn: Math.round((checkpointData.expiresAt - Date.now()) / (1000 * 60)) + ' minutes'
        }
      });
      
      // Return the checkpoint state
      return checkpointData.state;
    } catch (storageError) {
      // Handle storage-specific errors
      const errorMessage = `Failed to retrieve checkpoint: ${storageError.message}`;
      const zkError = zkErrorHandler.isZKError(storageError) 
        ? storageError 
        : new SystemError(errorMessage, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            operationId: opId,
            recoverable: true,
            details: { 
              originalError: storageError.message,
              storageKey: `${config.storageKey}:${operationId}`
            }
          });
          
      zkErrorLogger.logError(zkError, {
        operationId: opId,
        context: 'getCheckpoint.storage'
      });
      
      return null;
    }
  } catch (error) {
    // Log error but don't fail the main operation
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'getCheckpoint'
      });
    } else {
      // Wrap non-ZKError
      const zkError = new SystemError(`Checkpoint retrieval error: ${error.message}`, {
        code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
        operationId: opId,
        recoverable: true,
        details: { originalError: error.message }
      });
      
      zkErrorLogger.logError(zkError, {
        context: 'getCheckpoint'
      });
    }
    
    return null;
  }
}

/**
 * Remove a checkpoint after operation completion
 * @param {string} operationId - Unique operation identifier
 * @param {Object} options - Checkpoint options
 * @returns {Promise<boolean>} Success indicator
 */
async function removeCheckpoint(operationId, options = {}) {
  if (!operationId) {
    return false;
  }
  
  try {
    const config = { ...DEFAULT_CHECKPOINT_CONFIG, ...options };
    
    // Remove checkpoint
    return await secureStorage.removeItem(`${config.storageKey}:${operationId}`);
  } catch (error) {
    // Log error but don't fail
    zkErrorLogger.logError(error, {
      operationId,
      additionalData: {
        action: 'removeCheckpoint',
        recoveryType: 'checkpoint'
      }
    });
    
    return false;
  }
}

/**
 * List all checkpoints of a specific type
 * @param {string} type - Checkpoint type filter
 * @param {Object} options - Checkpoint options
 * @returns {Promise<Array>} List of checkpoint metadata
 */
async function listCheckpoints(type, options = {}) {
  try {
    const config = { ...DEFAULT_CHECKPOINT_CONFIG, ...options };
    
    // Get all checkpoint keys
    const allKeys = await secureStorage.getAllKeys();
    const checkpointKeys = allKeys.filter(key => 
      key.startsWith(`${config.storageKey}:`)
    );
    
    // Fetch all checkpoints
    const checkpoints = [];
    for (const key of checkpointKeys) {
      const data = await secureStorage.getItem(key, {
        decompress: config.compressionEnabled,
        decrypt: config.encryptionEnabled
      });
      
      // Skip if not found or not matching type
      if (!data || (type && data.metadata?.type !== type)) {
        continue;
      }
      
      // Check if expired
      if (data.expiresAt && data.expiresAt < Date.now()) {
        // Clean up expired checkpoint
        await secureStorage.removeItem(key);
        continue;
      }
      
      // Add metadata only (not the full state)
      checkpoints.push({
        id: data.id,
        timestamp: data.timestamp,
        expiresAt: data.expiresAt,
        type: data.metadata?.type || 'unknown',
        context: data.metadata?.context || {}
      });
    }
    
    return checkpoints;
  } catch (error) {
    zkErrorLogger.logError(error, {
      additionalData: {
        action: 'listCheckpoints',
        type
      }
    });
    
    return [];
  }
}

/**
 * Execute a function with checkpointing
 * @param {Function} fn - Function to execute with state parameter
 * @param {string} operationId - Unique operation identifier
 * @param {Object} options - Checkpointing options
 * @returns {Promise<any>} Result of the function
 * @throws {InputError} If parameters are invalid
 * @throws {SystemError} If checkpointing operation fails
 * @throws {MemoryError} If memory management fails
 */
async function withCheckpointing(fn, operationId, options = {}) {
  // Generate or use provided operation ID
  const opId = operationId || `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  try {
    // Validate inputs
    if (typeof fn !== 'function') {
      throw new InputError('First parameter must be a function', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId: opId,
        recoverable: false,
        userFixable: true
      });
    }
    
    if (operationId !== undefined && typeof operationId !== 'string') {
      throw new InputError('Operation ID must be a string if provided', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId: opId,
        recoverable: true, // Recoverable because we generated a valid ID
        userFixable: true,
        details: { providedType: typeof operationId }
      });
    }
    
    if (options !== undefined && (typeof options !== 'object' || Array.isArray(options))) {
      throw new InputError('Options must be an object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId: opId,
        recoverable: true, // Recoverable with default options
        userFixable: true,
        details: { optionsType: typeof options }
      });
    }
    
    // Merge config with defaults
    const config = { 
      ...DEFAULT_CHECKPOINT_CONFIG, 
      ...options 
    };
    
    // Function to report progress if callback provided
    const reportProgress = (progress, status) => {
      try {
        if (typeof options.onProgress === 'function') {
          options.onProgress({
            operationId: opId,
            progress,
            status
          });
        }
      } catch (progressError) {
        // Log but don't fail the operation if progress reporting fails
        zkErrorLogger.logError(progressError, {
          operationId: opId,
          context: 'withCheckpointing.reportProgress',
          details: {
            progress,
            status
          }
        });
      }
    };
    
    // Get existing checkpoint if resuming
    let state = null;
    if (options.resume !== false) {
      reportProgress(0, 'Checking for previous state');
      
      try {
        state = await getCheckpoint(opId, config);
      } catch (checkpointError) {
        // Log but continue - we can start fresh if checkpoint retrieval fails
        zkErrorLogger.logError(checkpointError, {
          operationId: opId,
          context: 'withCheckpointing.getCheckpoint'
        });
        
        zkErrorLogger.log('WARNING', 'Failed to retrieve checkpoint, starting fresh', {
          operationId: opId,
          context: 'withCheckpointing.getCheckpoint'
        });
      }
      
      if (state) {
        reportProgress(10, 'Resuming from previous state');
        zkErrorLogger.log('INFO', 'Resuming operation from checkpoint', {
          operationId: opId,
          category: 'recovery',
          details: {
            recoveryType: 'checkpoint',
            checkpointAge: state.timestamp ? Math.round((Date.now() - state.timestamp) / 1000) + 's' : 'unknown'
          }
        });
      } else {
        reportProgress(0, 'Starting new operation');
        zkErrorLogger.log('INFO', 'No existing checkpoint found, starting new operation', {
          operationId: opId,
          context: 'withCheckpointing'
        });
      }
    }
    
    // Setup interval for creating checkpoints
    let checkpointInterval = null;
    let currentState = state || { 
      step: 0,
      progress: 0,
      lastUpdated: Date.now()
    };
    
    // Create checkpoint initially if resuming
    if (state) {
      try {
        await createCheckpoint(opId, currentState, config);
      } catch (initialCheckpointError) {
        // Log but continue - initial checkpoint is not critical
        zkErrorLogger.logError(initialCheckpointError, {
          operationId: opId,
          context: 'withCheckpointing.initialCheckpoint'
        });
      }
    }
    
    // Function to update state and create checkpoint
    const updateState = async (newState) => {
      try {
        // Validate newState
        if (!newState || typeof newState !== 'object') {
          throw new InputError('New state must be an object', {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId: opId,
            recoverable: true, // We can recover by ignoring this update
            userFixable: true,
            details: { newStateType: typeof newState }
          });
        }
        
        // Merge with current state
        currentState = { ...currentState, ...newState, lastUpdated: Date.now() };
        
        // Report progress if provided
        if (typeof currentState.progress === 'number') {
          reportProgress(
            currentState.progress,
            currentState.status || `Step ${currentState.step || 0}`
          );
        }
        
        // Create checkpoint with updated state
        return await createCheckpoint(opId, currentState, config);
      } catch (updateError) {
        // Log error
        zkErrorLogger.logError(updateError, {
          operationId: opId,
          context: 'withCheckpointing.updateState'
        });
        
        // Even if checkpointing fails, we can continue with the operation
        return false;
      }
    };
    
    try {
      // Setup automatic checkpointing
      if (config.checkpointIntervalMs > 0) {
        checkpointInterval = setInterval(async () => {
          try {
            // Only create checkpoint if state changed since last checkpoint
            if (currentState.lastUpdated > (currentState.lastCheckpoint || 0)) {
              currentState.lastCheckpoint = Date.now();
              await createCheckpoint(opId, currentState, config);
            }
          } catch (intervalError) {
            // Log but don't crash on interval errors
            zkErrorLogger.logError(intervalError, {
              operationId: opId,
              context: 'withCheckpointing.checkpointInterval'
            });
          }
        }, config.checkpointIntervalMs);
      }
      
      // Run with memory control to prevent crashes
      let result;
      try {
        result = await memoryManager.runWithMemoryControl(
          async () => {
            try {
              // Execute function with current state and update function
              return await fn(currentState, updateState);
            } catch (fnError) {
              // If the function throws, create a checkpoint before propagating
              // so we can potentially resume from this point
              zkErrorLogger.logError(fnError, {
                operationId: opId,
                context: 'withCheckpointing.userFunction'
              });
              
              // Only checkpoint if it's a recoverable issue
              if (zkErrorHandler.isZKError(fnError) && fnError.recoverable) {
                zkErrorLogger.log('INFO', 'Saving checkpoint before propagating recoverable error', {
                  operationId: opId,
                  context: 'withCheckpointing.errorCheckpoint'
                });
                
                try {
                  await createCheckpoint(opId, {
                    ...currentState,
                    lastError: {
                      message: fnError.message,
                      code: fnError.code,
                      timestamp: Date.now()
                    },
                    status: 'failed_with_error',
                    recoverable: fnError.recoverable
                  }, {
                    ...config,
                    expiryTimeMs: config.expiryTimeMs * 2 // Double expiry for error checkpoints
                  });
                } catch (errorCheckpointError) {
                  // Just log if this fails - not critical
                  zkErrorLogger.logError(errorCheckpointError, {
                    operationId: opId,
                    context: 'withCheckpointing.errorCheckpoint'
                  });
                }
              }
              
              // Re-throw to propagate the error
              throw fnError;
            }
          },
          options.requiredMemoryMB || 100,
          {
            onMemoryWarning: (memInfo) => {
              // Log memory warning
              zkErrorLogger.log('WARNING', 'Memory pressure during checkpointed operation', {
                operationId: opId,
                category: 'memory',
                details: { 
                  availableMemoryMB: memInfo.availableMB,
                  percentUsed: Math.round(memInfo.pressurePercentage * 100) + '%'
                }
              });
              
              // Create checkpoint before potential crash
              try {
                createCheckpoint(opId, {
                  ...currentState,
                  memoryWarning: {
                    timestamp: Date.now(),
                    availableMemoryMB: memInfo.availableMB,
                    pressurePercentage: memInfo.pressurePercentage
                  },
                  status: 'memory_pressure'
                }, config);
              } catch (memoryCheckpointError) {
                // Just log if this fails - not critical
                zkErrorLogger.logError(memoryCheckpointError, {
                  operationId: opId,
                  context: 'withCheckpointing.memoryWarningCheckpoint'
                });
              }
            }
          }
        );
      } catch (memoryError) {
        // Handle memory management errors
        const errorMessage = `Memory management error during checkpointed operation: ${memoryError.message}`;
        const zkError = zkErrorHandler.isZKError(memoryError) 
          ? memoryError 
          : new MemoryError(errorMessage, {
              code: ErrorCode.MEMORY_ALLOCATION_FAILED,
              operationId: opId,
              recoverable: true,
              details: { originalError: memoryError.message }
            });
            
        zkErrorLogger.logError(zkError, {
          operationId: opId,
          context: 'withCheckpointing.memoryManagement'
        });
        
        // Create crash checkpoint to enable recovery
        try {
          await createCheckpoint(opId, {
            ...currentState,
            lastError: {
              message: zkError.message,
              code: zkError.code,
              timestamp: Date.now()
            },
            status: 'crashed_with_memory_error',
            recoverable: true
          }, {
            ...config,
            expiryTimeMs: config.expiryTimeMs * 2 // Double expiry for crash checkpoints
          });
        } catch (crashCheckpointError) {
          // Just log if this fails - we're already in an error condition
          zkErrorLogger.logError(crashCheckpointError, {
            operationId: opId,
            context: 'withCheckpointing.crashCheckpoint'
          });
        }
        
        throw zkError;
      }
      
      // Final checkpoint with completed state
      try {
        await updateState({ 
          completed: true, 
          progress: 100,
          status: 'Operation completed',
          completedAt: Date.now()
        });
      } catch (finalCheckpointError) {
        // Log but don't fail the operation if final checkpoint fails
        zkErrorLogger.logError(finalCheckpointError, {
          operationId: opId,
          context: 'withCheckpointing.finalCheckpoint'
        });
      }
      
      // Clean up checkpoint if requested
      if (options.removeOnCompletion) {
        try {
          await removeCheckpoint(opId, config);
        } catch (removeCheckpointError) {
          // Log but don't fail the operation if cleanup fails
          zkErrorLogger.logError(removeCheckpointError, {
            operationId: opId,
            context: 'withCheckpointing.removeCheckpoint'
          });
        }
      }
      
      // Log successful completion
      zkErrorLogger.log('INFO', 'Checkpointed operation completed successfully', {
        operationId: opId,
        category: 'recovery',
        details: {
          recoveryType: state ? 'checkpoint_resumed' : 'checkpoint_new',
          totalSteps: currentState.step || 0,
          duration: Date.now() - (currentState.startedAt || Date.now())
        }
      });
      
      return result;
    } finally {
      // Clean up checkpoint interval
      if (checkpointInterval) {
        clearInterval(checkpointInterval);
      }
    }
  } catch (error) {
    // If it's already a ZKError, just re-throw it
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'withCheckpointing'
      });
      throw error;
    }
    
    // Otherwise, wrap it in a ZKError
    const zkError = new SystemError(`Checkpointing system error: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId: opId,
      recoverable: false,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'withCheckpointing' 
    });
    throw zkError;
  }
}

/**
 * Handles batch operations with partial completion support
 * @param {Array} items - Array of items to process
 * @param {Function} processFn - Function to process each item
 * @param {Object} options - Batch options
 * @returns {Promise<Object>} Results with success and failure counts
 * @throws {InputError} If parameters are invalid
 * @throws {SystemError} If batch processing system fails
 */
async function processBatch(items, processFn, options = {}) {
  // Generate operation ID for tracking
  const operationId = options.operationId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  try {
    // Validate inputs
    if (!Array.isArray(items)) {
      throw new InputError('First parameter must be an array', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof items }
      });
    }
    
    if (typeof processFn !== 'function') {
      throw new InputError('Second parameter must be a function', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { providedType: typeof processFn }
      });
    }
    
    if (options !== undefined && (typeof options !== 'object' || Array.isArray(options))) {
      throw new InputError('Options must be an object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId,
        recoverable: true, // Recoverable with default options
        userFixable: true,
        details: { optionsType: typeof options }
      });
    }
    
    // Handle empty array case
    if (items.length === 0) {
      zkErrorLogger.log('INFO', 'Batch processing called with empty array', {
        operationId,
        context: 'processBatch'
      });
      
      return { 
        successful: [], 
        failed: [], 
        skipped: [],
        status: 'empty',
        stats: { total: 0, success: 0, failure: 0, skipped: 0 }
      };
    }
    
    // Default options
    const config = {
      concurrency: 1,
      continueOnError: true,
      retryFailedItems: true,
      maxRetries: 2,
      operationId,
      ...options
    };
    
    // Validate critical config options
    if (typeof config.concurrency !== 'number' || config.concurrency < 1 || !Number.isInteger(config.concurrency)) {
      zkErrorLogger.log('WARNING', 'Invalid concurrency setting, using default', {
        operationId,
        context: 'processBatch.config',
        details: { 
          providedValue: config.concurrency,
          usingDefault: 1
        }
      });
      config.concurrency = 1;
    }
    
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0 || !Number.isInteger(config.maxRetries)) {
      zkErrorLogger.log('WARNING', 'Invalid maxRetries setting, using default', {
        operationId,
        context: 'processBatch.config',
        details: { 
          providedValue: config.maxRetries,
          usingDefault: 2
        }
      });
      config.maxRetries = 2;
    }
    
    // Results tracking
    const results = {
      successful: [],
      failed: [],
      skipped: [],
      status: 'pending',
      stats: {
        total: items.length,
        success: 0,
        failure: 0,
        skipped: 0,
        inProgress: 0
      }
    };
    
    // Function to report progress
    const reportProgress = () => {
      try {
        if (typeof options.onProgress === 'function') {
          const processed = results.successful.length + results.failed.length + results.skipped.length;
          const progress = Math.round((processed / items.length) * 100);
          
          options.onProgress({
            operationId: config.operationId,
            total: items.length,
            processed,
            successful: results.successful.length,
            failed: results.failed.length,
            skipped: results.skipped.length,
            progress,
            status: results.status
          });
        }
      } catch (progressError) {
        // Log but don't fail the operation if progress reporting fails
        zkErrorLogger.logError(progressError, {
          operationId,
          context: 'processBatch.reportProgress'
        });
      }
    };
    
    // Initial progress report
    results.status = 'processing';
    reportProgress();
    
    // Check for resumable state
    let processedIndexes = new Set();
    let retryMap = new Map();
    
    if (options.resume && config.operationId) {
      try {
        const checkpoint = await getCheckpoint(config.operationId, {
          type: 'batch'
        });
        
        if (checkpoint) {
          // Validate checkpoint data
          if (Array.isArray(checkpoint.processedIndexes)) {
            checkpoint.processedIndexes.forEach(idx => {
              if (typeof idx === 'number' && idx >= 0 && idx < items.length) {
                processedIndexes.add(idx);
              }
            });
          }
          
          // Restore retry counts
          if (checkpoint.retryMap && typeof checkpoint.retryMap === 'object') {
            Object.entries(checkpoint.retryMap).forEach(([idx, count]) => {
              const index = parseInt(idx);
              if (!isNaN(index) && index >= 0 && index < items.length && 
                  typeof count === 'number' && count >= 0) {
                retryMap.set(index, count);
              }
            });
          }
          
          // Log resumption
          zkErrorLogger.log('INFO', `Resuming batch operation, ${processedIndexes.size}/${items.length} items already processed`, {
            operationId: config.operationId,
            category: 'recovery',
            details: {
              recoveryType: 'batch_resume',
              totalItems: items.length,
              processedItems: processedIndexes.size,
              resumePercentage: Math.round((processedIndexes.size / items.length) * 100) + '%'
            }
          });
        } else {
          zkErrorLogger.log('INFO', 'No checkpoint found for batch operation, starting fresh', {
            operationId: config.operationId,
            context: 'processBatch.resume'
          });
        }
      } catch (checkpointError) {
        // Log but continue - we can start fresh if checkpoint retrieval fails
        zkErrorLogger.logError(checkpointError, {
          operationId: config.operationId,
          context: 'processBatch.getCheckpoint'
        });
        
        zkErrorLogger.log('WARNING', 'Failed to retrieve batch checkpoint, starting fresh', {
          operationId: config.operationId,
          context: 'processBatch.resume'
        });
      }
    }
    
    try {
      // Process items according to concurrency setting
      if (config.concurrency <= 1) {
        // Process sequentially
        for (let i = 0; i < items.length; i++) {
          // Skip already processed items on resume
          if (processedIndexes.has(i)) {
            results.skipped.push({
              index: i,
              item: items[i],
              status: 'skipped',
              reason: 'already_processed'
            });
            results.stats.skipped++;
            reportProgress();
            continue;
          }
          
          // Process item with retry logic
          let retryCount = retryMap.get(i) || 0;
          let success = false;
          let error = null;
          
          while (!success && retryCount <= config.maxRetries) {
            try {
              // Update in-progress count
              results.stats.inProgress++;
              reportProgress();
              
              // Process the item
              const result = await processFn(items[i], i, results);
              
              // Mark as successful
              results.successful.push({
                index: i,
                item: items[i],
                result,
                retryCount
              });
              results.stats.success++;
              success = true;
              
              // Save processed index in case of resume
              processedIndexes.add(i);
              
              // Update checkpoint if needed
              if (config.operationId) {
                try {
                  // Convert retry map to object for serialization
                  const retryObj = {};
                  retryMap.forEach((count, idx) => {
                    retryObj[idx] = count;
                  });
                  
                  await createCheckpoint(config.operationId, {
                    processedIndexes: Array.from(processedIndexes),
                    retryMap: retryObj,
                    progress: Math.round((i / items.length) * 100)
                  }, {
                    type: 'batch',
                    context: { total: items.length, current: i }
                  });
                } catch (checkpointError) {
                  // Log but continue - checkpointing is not critical
                  zkErrorLogger.logError(checkpointError, {
                    operationId: config.operationId,
                    context: 'processBatch.sequential.createCheckpoint',
                    details: { itemIndex: i }
                  });
                }
              }
            } catch (err) {
              error = err;
              retryCount++;
              retryMap.set(i, retryCount);
              
              // Log retry attempts
              if (retryCount <= config.maxRetries && config.retryFailedItems) {
                // Log the error
                if (zkErrorHandler.isZKError(err)) {
                  zkErrorLogger.logError(err, {
                    context: 'processBatch.sequential.itemProcessing',
                    details: {
                      itemIndex: i,
                      attempt: retryCount,
                      maxRetries: config.maxRetries,
                      type: 'batch_item_retry'
                    }
                  });
                } else {
                  // Wrap non-ZKError with contextual information
                  const zkError = new SystemError(`Error processing batch item: ${err.message}`, {
                    code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
                    operationId: config.operationId,
                    recoverable: true,
                    details: { 
                      originalError: err.message,
                      itemIndex: i,
                      attempt: retryCount,
                      maxRetries: config.maxRetries
                    }
                  });
                  
                  zkErrorLogger.logError(zkError, {
                    context: 'processBatch.sequential.itemProcessing'
                  });
                }
                
                try {
                  // Wait before retry with exponential backoff
                  const delay = calculateRetryDelay(retryCount - 1, config);
                  await new Promise(resolve => setTimeout(resolve, delay));
                } catch (delayError) {
                  // Log but continue immediately if delay calculation fails
                  zkErrorLogger.logError(delayError, {
                    operationId: config.operationId,
                    context: 'processBatch.sequential.retryDelay',
                    details: { itemIndex: i }
                  });
                  // Use simple delay in case of failure
                  await new Promise(resolve => setTimeout(resolve, 1000 * Math.min(retryCount, 5)));
                }
              }
            } finally {
              // Update in-progress count
              results.stats.inProgress--;
            }
          }
          
          // If all retries failed, mark as failed
          if (!success) {
            results.failed.push({
              index: i,
              item: items[i],
              error: error instanceof Error ? error.message : 'Unknown error',
              retryCount
            });
            results.stats.failure++;
            
            // Log failure
            const failureError = error instanceof Error ? error : new Error('Unknown error');
            if (zkErrorHandler.isZKError(failureError)) {
              zkErrorLogger.logError(failureError, {
                context: 'processBatch.sequential.itemFailed',
                details: {
                  itemIndex: i,
                  attempts: retryCount,
                  type: 'batch_item_failed'
                }
              });
            } else {
              // Wrap non-ZKError
              const zkError = new SystemError(`Batch item processing failed: ${failureError.message}`, {
                code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
                operationId: config.operationId,
                recoverable: false,
                details: { 
                  originalError: failureError.message,
                  itemIndex: i,
                  attempts: retryCount
                }
              });
              
              zkErrorLogger.logError(zkError, {
                context: 'processBatch.sequential.itemFailed'
              });
            }
            
            // Stop processing if continueOnError is false
            if (!config.continueOnError) {
              results.status = 'stopped_on_error';
              reportProgress();
              break;
            }
          }
          
          // Report progress
          reportProgress();
        }
      } else {
        // Process with concurrency using Promise.all with limited batches
        let currentIndex = 0;
        
        // First, build list of indexes to process (skipping already processed)
        const indexesToProcess = [];
        for (let i = 0; i < items.length; i++) {
          if (!processedIndexes.has(i)) {
            indexesToProcess.push(i);
          } else {
            // Mark as skipped
            results.skipped.push({
              index: i,
              item: items[i],
              status: 'skipped',
              reason: 'already_processed'
            });
            results.stats.skipped++;
          }
        }
        
        // Log the plan
        zkErrorLogger.log('INFO', `Processing ${indexesToProcess.length} items in parallel (max ${config.concurrency} at a time)`, {
          operationId: config.operationId,
          context: 'processBatch.parallel',
          details: {
            totalItems: items.length,
            itemsToProcess: indexesToProcess.length,
            skippedItems: items.length - indexesToProcess.length,
            concurrency: config.concurrency
          }
        });
        
        // Process in concurrent batches
        while (currentIndex < indexesToProcess.length) {
          // Get next batch of indexes
          const batchIndexes = indexesToProcess.slice(
            currentIndex,
            currentIndex + config.concurrency
          );
          
          zkErrorLogger.log('INFO', `Processing batch ${Math.ceil(currentIndex / config.concurrency) + 1}, items ${currentIndex}-${currentIndex + batchIndexes.length - 1}`, {
            operationId: config.operationId,
            context: 'processBatch.parallel.batch',
            details: {
              batchSize: batchIndexes.length,
              batchStartIndex: currentIndex,
              batchEndIndex: currentIndex + batchIndexes.length - 1,
              progressPercentage: Math.round((currentIndex / indexesToProcess.length) * 100) + '%'
            }
          });
          
          // Create promises for concurrent processing
          const batchPromises = batchIndexes.map(async (index) => {
            const i = index;
            let retryCount = retryMap.get(i) || 0;
            
            // Update in-progress count
            results.stats.inProgress++;
            reportProgress();
            
            try {
              // Process with retry logic
              const result = await withRetry(
                async (attempt) => {
                  try {
                    // Call the process function with current item, index and results
                    return await processFn(items[i], i, results);
                  } catch (processingError) {
                    // Enhance error with batch context if it's a ZKError
                    if (zkErrorHandler.isZKError(processingError)) {
                      processingError.details = {
                        ...processingError.details,
                        batchItemIndex: i,
                        batchAttempt: attempt + 1
                      };
                    }
                    throw processingError;
                  }
                },
                {
                  maxRetries: config.maxRetries,
                  operationId: `${config.operationId}_item${i}`,
                  shouldRetry: (error) => {
                    // Custom retry logic that respects the batch's retryFailedItems setting
                    return config.retryFailedItems && shouldRetryOperation(error, retryCount, config);
                  }
                }
              );
              
              // Mark as successful
              results.successful.push({
                index: i,
                item: items[i],
                result,
                retryCount
              });
              results.stats.success++;
              
              // Save as processed
              processedIndexes.add(i);
              
              return { success: true, index: i };
            } catch (error) {
              // Mark as failed
              results.failed.push({
                index: i,
                item: items[i],
                error: error instanceof Error ? error.message : 'Unknown error',
                retryCount
              });
              results.stats.failure++;
              
              // Log failure
              if (zkErrorHandler.isZKError(error)) {
                zkErrorLogger.logError(error, {
                  context: 'processBatch.parallel.itemFailed',
                  details: {
                    itemIndex: i,
                    attempts: retryCount,
                    type: 'batch_item_failed'
                  }
                });
              } else {
                // Wrap non-ZKError
                const zkError = new SystemError(`Parallel batch item processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
                  code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
                  operationId: config.operationId,
                  recoverable: false,
                  details: { 
                    originalError: error instanceof Error ? error.message : 'Unknown error',
                    itemIndex: i,
                    attempts: retryCount
                  }
                });
                
                zkErrorLogger.logError(zkError, {
                  context: 'processBatch.parallel.itemFailed'
                });
              }
              
              return { success: false, index: i, error };
            } finally {
              // Update in-progress count
              results.stats.inProgress--;
              reportProgress();
            }
          });
          
          // Wait for batch to complete
          let batchResults;
          try {
            batchResults = await Promise.all(batchPromises);
          } catch (batchError) {
            // This should not happen with proper Promise.all usage, but just in case
            zkErrorLogger.logError(batchError, {
              operationId: config.operationId,
              context: 'processBatch.parallel.batchExecution'
            });
            
            // Construct a fallback result
            batchResults = batchIndexes.map(i => ({ 
              success: false, 
              index: i, 
              error: batchError instanceof Error ? batchError : new Error('Unknown batch error') 
            }));
          }
          
          // Handle stop on error
          if (!config.continueOnError && batchResults.some(r => !r.success)) {
            results.status = 'stopped_on_error';
            zkErrorLogger.log('WARNING', 'Stopping batch processing due to errors (continueOnError=false)', {
              operationId: config.operationId,
              context: 'processBatch.parallel.stopOnError',
              details: {
                errorCount: batchResults.filter(r => !r.success).length,
                completedItems: processedIndexes.size,
                remainingItems: items.length - processedIndexes.size
              }
            });
            reportProgress();
            break;
          }
          
          // Update checkpoint
          if (config.operationId) {
            try {
              // Convert retry map to object for serialization
              const retryObj = {};
              retryMap.forEach((count, idx) => {
                retryObj[idx] = count;
              });
              
              await createCheckpoint(config.operationId, {
                processedIndexes: Array.from(processedIndexes),
                retryMap: retryObj,
                progress: Math.round((currentIndex / items.length) * 100)
              }, {
                type: 'batch',
                context: { 
                  total: items.length, 
                  current: currentIndex,
                  batchSize: config.concurrency
                }
              });
            } catch (checkpointError) {
              // Log but continue - checkpointing is not critical
              zkErrorLogger.logError(checkpointError, {
                operationId: config.operationId,
                context: 'processBatch.parallel.createCheckpoint',
                details: { 
                  batchStart: currentIndex,
                  batchEnd: currentIndex + batchIndexes.length - 1
                }
              });
            }
          }
          
          // Move to next batch
          currentIndex += config.concurrency;
          reportProgress();
        }
      }
      
      // Mark as complete
      results.status = results.failed.length > 0 ? 'completed_with_failures' : 'completed';
      
      // Calculate completion percentage
      const processed = results.successful.length + results.failed.length;
      results.completionPercentage = Math.round((processed / items.length) * 100);
      
      // Final progress report
      reportProgress();
      
      // Log completion
      const logLevel = results.failed.length > 0 ? 'WARNING' : 'INFO';
      const logMessage = `Batch processing completed: ${results.successful.length}/${items.length} successful` +
                        (results.failed.length > 0 ? `, ${results.failed.length} failed` : '') +
                        (results.skipped.length > 0 ? `, ${results.skipped.length} skipped` : '');
                        
      zkErrorLogger.log(logLevel, logMessage, {
        operationId: config.operationId,
        category: 'batch',
        details: {
          total: items.length,
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
          status: results.status,
          successPercentage: Math.round((results.successful.length / items.length) * 100) + '%'
        }
      });
      
      // Clean up checkpoint if successful and requested
      if (config.operationId && options.removeOnCompletion) {
        try {
          // Remove checkpoint if all items processed successfully, or if we processed all we could
          // with failures but continueOnError=true
          const shouldRemove = results.failed.length === 0 || 
                              (config.continueOnError && processed === items.length - results.skipped.length);
          
          if (shouldRemove) {
            await removeCheckpoint(config.operationId);
            
            zkErrorLogger.log('INFO', 'Removed batch processing checkpoint after successful completion', {
              operationId: config.operationId,
              context: 'processBatch.cleanup'
            });
          } else {
            zkErrorLogger.log('INFO', 'Keeping batch checkpoint due to failures for potential resume', {
              operationId: config.operationId,
              context: 'processBatch.cleanup',
              details: {
                failureCount: results.failed.length
              }
            });
          }
        } catch (removeError) {
          // Log but don't fail the operation if checkpoint removal fails
          zkErrorLogger.logError(removeError, {
            operationId: config.operationId,
            context: 'processBatch.removeCheckpoint'
          });
        }
      }
      
      return results;
    } catch (processingError) {
      // Handle errors in the batch processing system itself
      const zkError = zkErrorHandler.isZKError(processingError)
        ? processingError
        : new SystemError(`Batch processing system error: ${processingError.message}`, {
            code: ErrorCode.SYSTEM_FUNCTION_EXECUTION_FAILED,
            operationId: config.operationId,
            recoverable: true,
            details: { originalError: processingError.message }
          });
          
      zkErrorLogger.logError(zkError, {
        context: 'processBatch.system'
      });
      
      // Create a final result with what we have so far
      results.status = 'failed_with_system_error';
      results.systemError = {
        message: zkError.message,
        code: zkError.code,
        recoverable: zkError.recoverable
      };
      
      // Report final progress
      reportProgress();
      
      throw zkError;
    }
  } catch (validationError) {
    // If it's already a ZKError, just re-throw it
    if (zkErrorHandler.isZKError(validationError)) {
      zkErrorLogger.logError(validationError, {
        context: 'processBatch.validation'
      });
      throw validationError;
    }
    
    // Otherwise, wrap it in a ZKError
    const zkError = new SystemError(`Batch processing validation error: ${validationError.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: false,
      details: { originalError: validationError.message }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'processBatch.validation' 
    });
    throw zkError;
  }
}

/**
 * Create session transferable checkpoint for partial proof data
 * 
 * This creates a secure, transferable checkpoint that can be used to
 * resume proof generation on another device or in another session.
 * 
 * @param {string} operationId - Unique operation identifier
 * @param {Object} state - Operation state to checkpoint
 * @param {Object} options - Checkpoint options
 * @returns {Promise<string>} Transferable checkpoint token
 * @throws {InputError} If parameters are invalid
 * @throws {SystemError} If checkpoint creation fails
 * @throws {SecurityError} If secure token creation fails
 */
async function createTransferableCheckpoint(operationId, state, options = {}) {
  // Generate operation ID for tracking if not provided
  const opId = operationId || `transferable_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  try {
    // Validate inputs
    if (!operationId || typeof operationId !== 'string') {
      throw new InputError('Operation ID is required and must be a string', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId: opId,
        recoverable: false,
        userFixable: true
      });
    }
    
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new InputError('State must be a non-null object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId: opId,
        recoverable: false,
        userFixable: true,
        details: { 
          stateType: typeof state,
          stateIsArray: Array.isArray(state)
        }
      });
    }
    
    if (options !== undefined && (typeof options !== 'object' || Array.isArray(options))) {
      throw new InputError('Options must be an object', {
        code: ErrorCode.INPUT_VALIDATION_FAILED,
        operationId: opId,
        recoverable: true, // Recoverable with default options
        userFixable: true,
        details: { optionsType: typeof options }
      });
    }
    
    // Merge with default config
    const config = { ...DEFAULT_CHECKPOINT_CONFIG, ...options };
    
    // Add metadata to checkpoint
    const checkpointData = {
      id: opId,
      timestamp: Date.now(),
      expiresAt: Date.now() + config.expiryTimeMs,
      state,
      metadata: {
        version: '1.0.0',
        type: options.type || 'transferable',
        context: options.context || {},
        secureTransfer: true
      }
    };
    
    try {
      // Create checkpoint locally first
      const localCheckpointSuccess = await createCheckpoint(opId, state, config);
      
      if (!localCheckpointSuccess) {
        throw new SystemError('Failed to create local checkpoint before creating transferable checkpoint', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          operationId: opId,
          recoverable: false,
          details: { checkpointType: options.type || 'transferable' }
        });
      }
      
      // Create secure, encrypted string representation
      try {
        const token = await secureStorage.createSecureToken(checkpointData);
        
        // Log creation of transferable checkpoint
        zkErrorLogger.log('INFO', 'Created transferable checkpoint', {
          operationId: opId,
          category: 'recovery',
          details: {
            recoveryType: 'transferable_checkpoint',
            expiresAt: new Date(checkpointData.expiresAt).toISOString(),
            tokenLength: token.length
          }
        });
        
        return token;
      } catch (tokenError) {
        // Handle token creation errors specifically
        const errorMessage = `Failed to create secure token: ${tokenError.message}`;
        const zkError = new SecurityError(errorMessage, {
          code: ErrorCode.SECURITY_ENCRYPTION_FAILED,
          operationId: opId,
          recoverable: false,
          details: { 
            reason: tokenError.message,
            dataSize: JSON.stringify(checkpointData).length 
          }
        });
        
        zkErrorLogger.logError(zkError, {
          operationId: opId,
          context: 'createTransferableCheckpoint.tokenCreation'
        });
        
        throw zkError;
      }
    } catch (checkpointError) {
      // If it's already a ZKError, just re-throw it
      if (zkErrorHandler.isZKError(checkpointError)) {
        throw checkpointError;
      }
      
      // Otherwise, wrap in a SystemError
      const zkError = new SystemError(`Checkpoint creation error: ${checkpointError.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId: opId,
        recoverable: false,
        details: { originalError: checkpointError.message }
      });
      
      zkErrorLogger.logError(zkError, {
        operationId: opId,
        context: 'createTransferableCheckpoint.localCheckpoint'
      });
      
      throw zkError;
    }
  } catch (error) {
    // If it's already a ZKError, just re-throw it
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'createTransferableCheckpoint'
      });
      throw error;
    }
    
    // Otherwise, wrap it in a ZKError
    const zkError = new SystemError(`Error creating transferable checkpoint: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId: opId,
      recoverable: false,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'createTransferableCheckpoint' 
    });
    throw zkError;
  }
}

/**
 * Resume operation from a transferable checkpoint token
 * @param {string} token - Transferable checkpoint token
 * @returns {Promise<Object>} Checkpoint data and state
 * @throws {InputError} If token is invalid
 * @throws {SecurityError} If token cannot be securely parsed
 * @throws {SystemError} If checkpoint restoration fails
 */
async function resumeFromTransferableCheckpoint(token) {
  const operationId = `resumeTransferable_${Date.now()}`;
  
  try {
    // Validate input
    if (!token || typeof token !== 'string') {
      throw new InputError('Checkpoint token is required and must be a string', {
        code: ErrorCode.INPUT_MISSING_REQUIRED,
        operationId,
        recoverable: false,
        userFixable: true,
        details: { tokenType: typeof token }
      });
    }
    
    let checkpointData;
    try {
      // Decode and validate the token
      checkpointData = await secureStorage.parseSecureToken(token);
      
      if (!checkpointData) {
        throw new SecurityError('Unable to parse checkpoint token', {
          code: ErrorCode.SECURITY_DECRYPTION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          recommendedAction: 'Provide a valid checkpoint token'
        });
      }
      
      if (!checkpointData.id || !checkpointData.state) {
        throw new SecurityError('Checkpoint token is missing required fields', {
          code: ErrorCode.SECURITY_VALIDATION_FAILED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: {
            hasId: !!checkpointData.id,
            hasState: !!checkpointData.state
          }
        });
      }
    } catch (parseError) {
      // Handle security-specific errors for token parsing
      const errorMessage = `Failed to parse secure token: ${parseError.message}`;
      const zkError = zkErrorHandler.isZKError(parseError) 
        ? parseError 
        : new SecurityError(errorMessage, {
            code: ErrorCode.SECURITY_DECRYPTION_FAILED,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { originalError: parseError.message }
          });
          
      zkErrorLogger.logError(zkError, {
        operationId,
        context: 'resumeFromTransferableCheckpoint.parsing'
      });
      
      throw zkError;
    }
    
    // Use the checkpoint's original operation ID going forward
    const checkpointOpId = checkpointData.id;
    
    // Check expiration
    if (checkpointData.expiresAt && checkpointData.expiresAt < Date.now()) {
      throw new SystemError('Checkpoint has expired', {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId: checkpointOpId,
        recoverable: false,
        userFixable: false,
        details: {
          expiredAt: new Date(checkpointData.expiresAt).toISOString(),
          currentTime: new Date().toISOString(),
          checkpointAge: Math.round((Date.now() - checkpointData.timestamp) / (1000 * 60)) + ' minutes'
        }
      });
    }
    
    try {
      // Store checkpoint locally for future use
      const localCheckpointSuccess = await createCheckpoint(
        checkpointOpId,
        checkpointData.state,
        {
          type: checkpointData.metadata?.type || 'transferred',
          context: {
            ...checkpointData.metadata?.context,
            transferredAt: Date.now(),
            source: 'external'
          }
        }
      );
      
      if (!localCheckpointSuccess) {
        // We can continue even if local checkpoint fails
        zkErrorLogger.log('WARNING', 'Failed to create local copy of transferred checkpoint', {
          operationId: checkpointOpId,
          context: 'resumeFromTransferableCheckpoint.localStorage',
          details: {
            checkpointType: checkpointData.metadata?.type || 'transferred'
          }
        });
      }
    } catch (localStorageError) {
      // Log but continue - this is not critical
      zkErrorLogger.logError(localStorageError, {
        operationId: checkpointOpId,
        context: 'resumeFromTransferableCheckpoint.localStorage'
      });
      
      // We can proceed even if local storage fails
      zkErrorLogger.log('WARNING', 'Continuing without local checkpoint storage', {
        operationId: checkpointOpId,
        context: 'resumeFromTransferableCheckpoint.localStorage'
      });
    }
    
    // Log resumption
    zkErrorLogger.log('INFO', 'Resuming from transferred checkpoint', {
      operationId: checkpointOpId,
      category: 'recovery',
      details: {
        recoveryType: 'transferred_checkpoint',
        checkpointAge: Math.round((Date.now() - checkpointData.timestamp) / (1000 * 60)) + ' minutes',
        type: checkpointData.metadata?.type,
        expiresIn: checkpointData.expiresAt ? Math.round((checkpointData.expiresAt - Date.now()) / (1000 * 60)) + ' minutes' : 'unknown'
      }
    });
    
    return {
      operationId: checkpointOpId,
      state: checkpointData.state,
      metadata: checkpointData.metadata
    };
  } catch (error) {
    // If it's already a ZKError, just re-throw it
    if (zkErrorHandler.isZKError(error)) {
      zkErrorLogger.logError(error, {
        context: 'resumeFromTransferableCheckpoint'
      });
      throw error;
    }
    
    // Otherwise, wrap it in a ZKError
    const zkError = new SystemError(`Error resuming from transferable checkpoint: ${error.message}`, {
      code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
      operationId,
      recoverable: false,
      details: { originalError: error.message }
    });
    
    zkErrorLogger.logError(zkError, { 
      context: 'resumeFromTransferableCheckpoint' 
    });
    throw zkError;
  }
}

// Export all functions
export default {
  withRetry,
  createCheckpoint,
  getCheckpoint,
  removeCheckpoint,
  listCheckpoints,
  withCheckpointing,
  processBatch,
  createTransferableCheckpoint,
  resumeFromTransferableCheckpoint
};