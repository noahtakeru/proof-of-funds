/**
 * Zero Knowledge Proof Recovery System
 * CommonJS version
 */

/**
 * Execute a function with retry logic
 * @param {Function} fn - Function to execute  
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    jitterMs = 100,
    exponential = true,
    operationId,
    onProgress
  } = options;
  
  let attempt = 0;
  let lastError;
  
  while (attempt <= maxRetries) {
    try {
      if (attempt > 0 && typeof onProgress === 'function') {
        onProgress({
          operationId,
          status: `Retry attempt ${attempt}/${maxRetries}`,
          progress: 0  // Reset progress on retry
        });
      }
      
      return await fn();
    } catch (error) {
      attempt++;
      lastError = error;
      
      if (attempt > maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const jitter = Math.floor(Math.random() * jitterMs);
      const delay = exponential
        ? baseDelayMs * Math.pow(2, attempt - 1) + jitter
        : baseDelayMs + jitter;
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached due to throw in the catch block
  throw lastError;
}

/**
 * Execute a function with checkpointing for resumable operations
 * @param {Function} fn - Function to execute with state
 * @param {string} operationId - Unique operation identifier
 * @param {Object} options - Checkpointing options
 * @returns {Promise<any>} Result of the function
 */
async function withCheckpointing(fn, operationId, options = {}) {
  const {
    checkpointIntervalMs = 1000,
    type = 'generic',
    context = {},
    requiredMemoryMB = 0
  } = options;
  
  // Initial state
  let state = {
    operationId,
    type,
    context,
    startTime: Date.now(),
    lastCheckpoint: Date.now(),
    step: 'init',
    progress: 0
  };
  
  // Function to update state and save checkpoint
  const updateState = async (newState) => {
    state = { ...state, ...newState, lastCheckpoint: Date.now() };
    return state;
  };
  
  try {
    // Execute the function with state and update capability
    return await fn(state, updateState);
  } catch (error) {
    // Add state information to the error
    error.checkpointState = state;
    throw error;
  }
}

/**
 * Process items in a batch with optimized memory usage
 * @param {Array} items - Items to process
 * @param {Function} processFn - Function to process each item
 * @param {Object} options - Batch processing options
 * @returns {Promise<Array>} Processing results
 */
async function processBatch(items, processFn, options = {}) {
  const {
    batchSize = 10,
    delayBetweenBatchesMs = 0,
    onProgress,
    operationId,
    continueOnError = false
  } = options;
  
  const results = [];
  const errors = [];
  
  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async (item, index) => {
      try {
        return await processFn(item, i + index);
      } catch (error) {
        if (continueOnError) {
          errors.push({ item, error, index: i + index });
          return null;
        } else {
          throw error;
        }
      }
    });
    
    // Process current batch
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Report progress
    if (typeof onProgress === 'function') {
      const progress = Math.round((i + batch.length) / items.length * 100);
      onProgress({
        operationId,
        progress,
        processedItems: i + batch.length,
        totalItems: items.length,
        currentBatch: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(items.length / batchSize)
      });
    }
    
    // Add delay between batches if specified
    if (delayBetweenBatchesMs > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatchesMs));
    }
  }
  
  return {
    results: results.filter(r => r \!== null),
    errors,
    totalProcessed: results.length,
    hasErrors: errors.length > 0
  };
}

// CommonJS exports
module.exports = {
  withRetry,
  withCheckpointing,
  processBatch
};
