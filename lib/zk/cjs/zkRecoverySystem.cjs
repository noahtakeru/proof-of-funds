/**
 * ZK Recovery System (CommonJS Version)
 * 
 * This module provides recovery mechanisms for ZK operations,
 * including retry logic, checkpointing, and error recovery.
 */

// Import error handling components
const { ErrorCode, ErrorSeverity, ErrorCategory } = require('./zkErrorHandler.cjs');
const { zkErrorLogger } = require('./zkErrorLogger.cjs');

/**
 * Create a function that will retry a ZK operation with exponential backoff
 *
 * @param {Function} operation - The async operation to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.initialDelayMs - Initial delay between retries in ms
 * @param {number} options.maxDelayMs - Maximum delay between retries in ms
 * @returns {Function} - A wrapped function that will retry on failure
 */
function withRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 10000
  } = options;
  
  return async (...args) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation(...args);
      } catch (error) {
        lastError = error;
        
        // Don't retry if we've reached the max retries
        if (attempt >= maxRetries) {
          break;
        }
        
        // Log retry attempt
        zkErrorLogger.log('WARNING', `Operation failed, retrying (${attempt + 1}/${maxRetries})`, {
          operation: operation.name || 'unknownOperation',
          attempt: attempt + 1,
          maxRetries,
          error: error.message
        });
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // If we got here, all retries failed
    throw lastError;
  };
}

/**
 * Create a checkpointing wrapper for long-running operations
 *
 * @param {Function} operation - The async operation to checkpoint
 * @param {Object} options - Checkpointing options
 * @param {number} options.checkpointIntervalMs - How often to create checkpoints
 * @param {Function} options.storeCheckpoint - Function to store checkpoint data
 * @param {Function} options.loadCheckpoint - Function to load checkpoint data
 * @returns {Function} - A wrapped function that supports checkpointing
 */
function withCheckpointing(operation, options = {}) {
  const {
    checkpointIntervalMs = 5000,
    storeCheckpoint = async (data) => data,
    loadCheckpoint = async (id) => null
  } = options;
  
  return async (operationId, ...args) => {
    // Check for existing checkpoint
    const checkpoint = await loadCheckpoint(operationId).catch(() => null);
    
    // If we have a checkpoint, resume from there
    if (checkpoint) {
      zkErrorLogger.log('INFO', `Resuming operation from checkpoint`, {
        operationId,
        checkpoint
      });
      
      // Use checkpoint data to resume
      return await operation(operationId, ...args, { checkpoint });
    }
    
    // Start fresh operation with checkpointing
    let checkpointTimer;
    let latestState = null;
    
    try {
      // Set up checkpointing timer
      checkpointTimer = setInterval(async () => {
        if (latestState) {
          await storeCheckpoint({
            operationId,
            state: latestState,
            timestamp: Date.now()
          });
        }
      }, checkpointIntervalMs);
      
      // Call the original operation with a state updater
      return await operation(operationId, ...args, {
        updateState: (state) => {
          latestState = state;
        }
      });
    } finally {
      // Clean up timer
      if (checkpointTimer) {
        clearInterval(checkpointTimer);
      }
    }
  };
}

/**
 * Process a batch of operations with resilience
 * 
 * @param {Array} items - Items to process in the batch
 * @param {Function} processor - Function to process each item
 * @param {Object} options - Processing options
 * @param {number} options.concurrency - How many items to process concurrently
 * @param {boolean} options.continueOnError - Whether to continue after errors
 * @returns {Object} - Results of batch processing
 */
async function processBatch(items, processor, options = {}) {
  const {
    concurrency = 5,
    continueOnError = false
  } = options;
  
  const results = {
    successful: [],
    failed: [],
    skipped: []
  };
  
  // Process items in chunks for controlled concurrency
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (item, index) => {
      try {
        const result = await processor(item);
        results.successful.push({ item, result, index: i + index });
        return { success: true, item, result };
      } catch (error) {
        results.failed.push({ item, error, index: i + index });
        
        // Log the error
        zkErrorLogger.logError(error, {
          operation: 'batchProcess',
          item,
          index: i + index
        });
        
        // If we should stop on errors, throw to break processing
        if (!continueOnError) {
          throw error;
        }
        
        return { success: false, item, error };
      }
    });
    
    // Wait for the current chunk to complete
    try {
      await Promise.all(chunkPromises);
    } catch (error) {
      // If an error was thrown, it means continueOnError is false
      // Mark remaining items as skipped
      for (let j = i + concurrency; j < items.length; j++) {
        results.skipped.push({
          item: items[j],
          reason: 'Previous batch item failed',
          index: j
        });
      }
      
      // Exit early
      break;
    }
  }
  
  return results;
}

// Export the recovery system
const recovery = {
  withRetry,
  withCheckpointing,
  processBatch,
  createTransferableCheckpoint: async (operationId, state, options = {}) => {
    // Simplified implementation
    return {
      id: operationId,
      state: JSON.stringify(state),
      timestamp: Date.now(),
      signature: "dummy-signature"
    };
  },
  resumeFromTransferableCheckpoint: async (token) => {
    // Simplified implementation
    try {
      return {
        id: token.id,
        state: JSON.parse(token.state),
        timestamp: token.timestamp,
        valid: true
      };
    } catch (error) {
      throw new Error(`Invalid checkpoint token: ${error.message}`);
    }
  }
};

// Export the module
module.exports = recovery;