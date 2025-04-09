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
 */

const { zkErrorLogger } = require('./zkErrorLogger');
const memoryManager = require('./memoryManager');
const { isZKError, NetworkError } = require('./zkErrorHandler');
const secureStorage = require('./secureStorage');

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
 */
function getRandomJitter(factor, value) {
  // Jitter range is up to factor% of the value
  const maxJitter = value * factor;
  
  // Random amount between -maxJitter/2 and +maxJitter/2
  return (Math.random() - 0.5) * maxJitter;
}

/**
 * Calculate retry delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt, config) {
  const { baseDelayMs, maxDelayMs, jitterFactor } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  };
  
  // Calculate exponential delay: baseDelay * 2^attempt
  let delay = baseDelayMs * Math.pow(2, attempt);
  
  // Apply maximum delay cap
  delay = Math.min(delay, maxDelayMs);
  
  // Add jitter to prevent thundering herd problem
  if (jitterFactor > 0) {
    delay += getRandomJitter(jitterFactor, delay);
  }
  
  // Ensure delay is positive
  return Math.max(delay, 0);
}

/**
 * Determines if an operation should be retried based on the error
 * @param {Error} error - The error that occurred
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {boolean} Whether to retry
 */
function shouldRetryOperation(error, attempt, config) {
  const { maxRetries, shouldRetry } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  };
  
  // Stop if we've reached max retries
  if (attempt >= maxRetries) {
    return false;
  }
  
  // Use custom function if provided
  if (typeof shouldRetry === 'function') {
    return shouldRetry(error, attempt);
  }
  
  // ZK error-specific logic
  if (isZKError(error)) {
    // Only retry recoverable errors
    if (!error.recoverable) {
      return false;
    }
    
    // Always retry network errors (within max retries)
    if (error instanceof NetworkError) {
      return true;
    }
    
    // Don't retry user-fixable errors automatically
    if (error.userFixable) {
      return false;
    }
  }
  
  // For non-ZKErrors, retry only specific types
  if (error instanceof TypeError || error instanceof ReferenceError) {
    return false; // These usually indicate code issues, not transient failures
  }
  
  // Retry network-related errors
  if (error.message && (
    error.message.includes('network') ||
    error.message.includes('timeout') ||
    error.message.includes('connection') ||
    error.message.includes('offline')
  )) {
    return true;
  }
  
  // Default to not retrying
  return false;
}

/**
 * Execute a function with retry logic
 * @param {Function} fn - Function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  let attempt = 0;
  let lastError = null;
  
  // Generate operation ID for tracking if not provided
  const operationId = options.operationId || `retry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  // Function to handle progress reporting
  const reportProgress = (progress, status) => {
    if (typeof options.onProgress === 'function') {
      options.onProgress({
        operationId,
        attempt: attempt + 1,
        maxAttempts: config.maxRetries + 1,
        progress,
        status
      });
    }
  };
  
  // Initial progress report
  reportProgress(0, 'Starting operation');
  
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
      }
      
      return result;
    } catch (error) {
      // Save error for logging
      lastError = error;
      
      // Log the error
      zkErrorLogger.logError(error, {
        operationId,
        additionalData: {
          attempt,
          maxRetries: config.maxRetries
        }
      });
      
      // Check if we should retry
      if (shouldRetryOperation(error, attempt, config)) {
        // Increment attempt counter
        attempt++;
        
        // Calculate delay for next retry
        const delay = calculateRetryDelay(attempt, config);
        
        // Report retry status
        reportProgress(
          Math.min(90, (attempt / (config.maxRetries + 1)) * 100),
          `Retrying (attempt ${attempt + 1}/${config.maxRetries + 1}) after ${Math.round(delay / 100) / 10}s`
        );
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Continue to next attempt
        continue;
      }
      
      // If we shouldn't retry, report failure and throw
      reportProgress(0, `Operation failed after ${attempt + 1} attempts`);
      throw error;
    }
  }
}

/**
 * Create a checkpoint for resumable operations
 * @param {string} operationId - Unique operation identifier
 * @param {Object} state - Operation state to checkpoint
 * @param {Object} options - Checkpoint options
 * @returns {Promise<boolean>} Success indicator
 */
async function createCheckpoint(operationId, state, options = {}) {
  if (!operationId || !state) {
    return false;
  }
  
  try {
    const config = { ...DEFAULT_CHECKPOINT_CONFIG, ...options };
    
    // Add metadata to checkpoint
    const checkpointData = {
      id: operationId,
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
    
    // Use secure storage to persist checkpoint
    const success = await secureStorage.setItem(
      `${config.storageKey}:${operationId}`,
      checkpointData,
      {
        compress: config.compressionEnabled,
        encrypt: config.encryptionEnabled
      }
    );
    
    return success;
  } catch (error) {
    // Log error but don't fail the main operation
    zkErrorLogger.logError(error, {
      operationId,
      additionalData: {
        action: 'createCheckpoint',
        recoveryType: 'checkpoint'
      }
    });
    
    return false;
  }
}

/**
 * Retrieve a checkpoint for resuming an operation
 * @param {string} operationId - Unique operation identifier
 * @param {Object} options - Checkpoint options
 * @returns {Promise<Object|null>} Checkpoint state or null if not found
 */
async function getCheckpoint(operationId, options = {}) {
  if (!operationId) {
    return null;
  }
  
  try {
    const config = { ...DEFAULT_CHECKPOINT_CONFIG, ...options };
    
    // Retrieve checkpoint data
    const checkpointData = await secureStorage.getItem(
      `${config.storageKey}:${operationId}`,
      {
        decompress: config.compressionEnabled,
        decrypt: config.encryptionEnabled
      }
    );
    
    if (!checkpointData) {
      return null;
    }
    
    // Check if checkpoint has expired
    if (checkpointData.expiresAt && checkpointData.expiresAt < Date.now()) {
      // Remove expired checkpoint
      await secureStorage.removeItem(`${config.storageKey}:${operationId}`);
      return null;
    }
    
    // Return the checkpoint state
    return checkpointData.state;
  } catch (error) {
    // Log error but don't fail the main operation
    zkErrorLogger.logError(error, {
      operationId,
      additionalData: {
        action: 'getCheckpoint',
        recoveryType: 'checkpoint'
      }
    });
    
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
 */
async function withCheckpointing(fn, operationId, options = {}) {
  if (!operationId) {
    operationId = `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  
  const config = { 
    ...DEFAULT_CHECKPOINT_CONFIG, 
    ...options 
  };
  
  // Function to report progress if callback provided
  const reportProgress = (progress, status) => {
    if (typeof options.onProgress === 'function') {
      options.onProgress({
        operationId,
        progress,
        status
      });
    }
  };
  
  // Get existing checkpoint if resuming
  let state = null;
  if (options.resume !== false) {
    reportProgress(0, 'Checking for previous state');
    state = await getCheckpoint(operationId, config);
    
    if (state) {
      reportProgress(10, 'Resuming from previous state');
      zkErrorLogger.log('INFO', 'Resuming operation from checkpoint', {
        operationId,
        category: 'recovery',
        details: {
          recoveryType: 'checkpoint',
          checkpointAge: Date.now() - (state.timestamp || 0)
        }
      });
    } else {
      reportProgress(0, 'Starting new operation');
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
    await createCheckpoint(operationId, currentState, config);
  }
  
  // Function to update state and create checkpoint
  const updateState = async (newState) => {
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
    return createCheckpoint(operationId, currentState, config);
  };
  
  try {
    // Setup automatic checkpointing
    if (config.checkpointIntervalMs > 0) {
      checkpointInterval = setInterval(async () => {
        // Only create checkpoint if state changed since last checkpoint
        if (currentState.lastUpdated > currentState.lastCheckpoint) {
          currentState.lastCheckpoint = Date.now();
          await createCheckpoint(operationId, currentState, config);
        }
      }, config.checkpointIntervalMs);
    }
    
    // Run with memory control to prevent crashes
    const result = await memoryManager.runWithMemoryControl(
      async () => {
        // Execute function with current state and update function
        return await fn(currentState, updateState);
      },
      options.requiredMemoryMB || 100,
      {
        onMemoryWarning: (memInfo) => {
          // Log memory warning
          zkErrorLogger.log('WARNING', 'Memory pressure during checkpointed operation', {
            operationId,
            category: 'memory',
            details: { 
              availableMemoryMB: memInfo.availableMB,
              percentUsed: memInfo.pressurePercentage * 100
            }
          });
          
          // Create checkpoint before potential crash
          createCheckpoint(operationId, currentState, config);
        }
      }
    );
    
    // Final checkpoint with completed state
    await updateState({ 
      completed: true, 
      progress: 100,
      status: 'Operation completed'
    });
    
    // Clean up checkpoint if requested
    if (options.removeOnCompletion) {
      await removeCheckpoint(operationId, config);
    }
    
    return result;
  } finally {
    // Clean up checkpoint interval
    if (checkpointInterval) {
      clearInterval(checkpointInterval);
    }
  }
}

/**
 * Handles batch operations with partial completion support
 * @param {Array} items - Array of items to process
 * @param {Function} processFn - Function to process each item
 * @param {Object} options - Batch options
 * @returns {Promise<Object>} Results with success and failure counts
 */
async function processBatch(items, processFn, options = {}) {
  if (!items || !Array.isArray(items) || items.length === 0) {
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
    operationId: `batch_${Date.now()}`,
    ...options
  };
  
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
  };
  
  // Initial progress report
  results.status = 'processing';
  reportProgress();
  
  // Check for resumable state
  let processedIndexes = new Set();
  let retryMap = new Map();
  
  if (options.resume && config.operationId) {
    const checkpoint = await getCheckpoint(config.operationId, {
      type: 'batch'
    });
    
    if (checkpoint) {
      // Mark items as already processed
      checkpoint.processedIndexes?.forEach(idx => processedIndexes.add(idx));
      
      // Restore retry counts
      if (checkpoint.retryMap) {
        Object.entries(checkpoint.retryMap).forEach(([idx, count]) => {
          retryMap.set(parseInt(idx), count);
        });
      }
      
      // Log resumption
      zkErrorLogger.log('INFO', `Resuming batch operation, ${processedIndexes.size} items already processed`, {
        operationId: config.operationId,
        category: 'recovery',
        details: {
          recoveryType: 'batch_resume',
          totalItems: items.length,
          processedItems: processedIndexes.size
        }
      });
    }
  }
  
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
          }
        } catch (err) {
          error = err;
          retryCount++;
          retryMap.set(i, retryCount);
          
          // Log retry attempts
          if (retryCount <= config.maxRetries && config.retryFailedItems) {
            zkErrorLogger.logError(err, {
              operationId: config.operationId,
              additionalData: {
                type: 'batch_item_retry',
                itemIndex: i,
                attempt: retryCount,
                maxRetries: config.maxRetries
              }
            });
            
            // Wait before retry with exponential backoff
            const delay = calculateRetryDelay(retryCount - 1, config);
            await new Promise(resolve => setTimeout(resolve, delay));
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
          error: error?.message || 'Unknown error',
          retryCount
        });
        results.stats.failure++;
        
        // Log failure
        zkErrorLogger.logError(error, {
          operationId: config.operationId,
          additionalData: {
            action: 'batch_item_failed',
            itemIndex: i,
            attempts: retryCount
          }
        });
        
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
    
    // Process in concurrent batches
    while (currentIndex < indexesToProcess.length) {
      // Get next batch of indexes
      const batchIndexes = indexesToProcess.slice(
        currentIndex,
        currentIndex + config.concurrency
      );
      
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
            async () => processFn(items[i], i, results),
            {
              maxRetries: config.maxRetries,
              operationId: `${config.operationId}_item${i}`
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
            error: error?.message || 'Unknown error',
            retryCount
          });
          results.stats.failure++;
          
          // Log failure
          zkErrorLogger.logError(error, {
            operationId: config.operationId,
            additionalData: {
              action: 'batch_item_failed',
              itemIndex: i,
              attempts: retryCount
            }
          });
          
          return { success: false, index: i, error };
        } finally {
          // Update in-progress count
          results.stats.inProgress--;
          reportProgress();
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Handle stop on error
      if (!config.continueOnError && batchResults.some(r => !r.success)) {
        results.status = 'stopped_on_error';
        reportProgress();
        break;
      }
      
      // Update checkpoint
      if (config.operationId) {
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
          context: { total: items.length, current: currentIndex }
        });
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
  zkErrorLogger.log(
    results.failed.length > 0 ? 'WARNING' : 'INFO',
    `Batch processing completed: ${results.successful.length}/${items.length} successful`,
    {
      operationId: config.operationId,
      category: 'batch',
      details: {
        total: items.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        status: results.status
      }
    }
  );
  
  // Clean up checkpoint if successful
  if (config.operationId && options.removeOnCompletion && results.failed.length === 0) {
    await removeCheckpoint(config.operationId);
  }
  
  return results;
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
 */
async function createTransferableCheckpoint(operationId, state, options = {}) {
  if (!operationId || !state) {
    throw new Error('Operation ID and state are required');
  }
  
  try {
    const config = { ...DEFAULT_CHECKPOINT_CONFIG, ...options };
    
    // Add metadata to checkpoint
    const checkpointData = {
      id: operationId,
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
    
    // Create checkpoint locally first
    await createCheckpoint(operationId, state, config);
    
    // Create secure, encrypted string representation
    const token = await secureStorage.createSecureToken(checkpointData);
    
    // Log creation of transferable checkpoint
    zkErrorLogger.log('INFO', 'Created transferable checkpoint', {
      operationId,
      category: 'recovery',
      details: {
        recoveryType: 'transferable_checkpoint',
        expiresAt: checkpointData.expiresAt,
        tokenLength: token.length
      }
    });
    
    return token;
  } catch (error) {
    // Log error
    zkErrorLogger.logError(error, {
      operationId,
      additionalData: {
        action: 'createTransferableCheckpoint',
        recoveryType: 'checkpoint'
      }
    });
    
    throw error;
  }
}

/**
 * Resume operation from a transferable checkpoint token
 * @param {string} token - Transferable checkpoint token
 * @returns {Promise<Object>} Checkpoint data and state
 */
async function resumeFromTransferableCheckpoint(token) {
  if (!token) {
    throw new Error('Checkpoint token is required');
  }
  
  try {
    // Decode and validate the token
    const checkpointData = await secureStorage.parseSecureToken(token);
    
    if (!checkpointData || !checkpointData.id || !checkpointData.state) {
      throw new Error('Invalid checkpoint token');
    }
    
    // Check expiration
    if (checkpointData.expiresAt && checkpointData.expiresAt < Date.now()) {
      throw new Error('Checkpoint has expired');
    }
    
    // Store checkpoint locally for future use
    await createCheckpoint(
      checkpointData.id,
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
    
    // Log resumption
    zkErrorLogger.log('INFO', 'Resuming from transferred checkpoint', {
      operationId: checkpointData.id,
      category: 'recovery',
      details: {
        recoveryType: 'transferred_checkpoint',
        checkpointAge: Date.now() - checkpointData.timestamp,
        type: checkpointData.metadata?.type
      }
    });
    
    return {
      operationId: checkpointData.id,
      state: checkpointData.state,
      metadata: checkpointData.metadata
    };
  } catch (error) {
    // Log error
    zkErrorLogger.logError(error, {
      additionalData: {
        action: 'resumeFromTransferableCheckpoint',
        recoveryType: 'checkpoint'
      }
    });
    
    throw error;
  }
}

/**
 * Auto-recovery manager for ZK operations
 * @class
 */
class AutoRecoveryManager {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      checkpointingEnabled: true,
      autoResumeEnabled: true,
      ...options
    };
    
    this.activeOperations = new Map();
    this.recoveryStrategies = new Map();
    
    // Initialize default recovery strategies
    this.registerDefaultRecoveryStrategies();
  }
  
  /**
   * Register default recovery strategies for common error types
   */
  registerDefaultRecoveryStrategies() {
    // Memory-related issues
    this.registerRecoveryStrategy('memory', async (error, context) => {
      // For memory issues, try to free up resources
      if (memoryManager.clearCaches) {
        await memoryManager.clearCaches();
      }
      
      if (context.options?.serverFallback) {
        // Switch to server-side processing
        return {
          action: 'switch_to_server',
          metadata: { reason: 'memory_pressure' }
        };
      }
      
      return { action: 'retry', delay: 1000 };
    });
    
    // Network issues
    this.registerRecoveryStrategy('network', async (error) => {
      // For network failures, use increasing delays
      const attempt = error.retryCount || 0;
      const delay = calculateRetryDelay(attempt, { baseDelayMs: 1000, jitterFactor: 0.3 });
      
      return { action: 'retry', delay };
    });
    
    // Input validation issues
    this.registerRecoveryStrategy('input', async (error) => {
      // For input validation errors, we cannot auto-recover
      return { action: 'fail', reason: 'invalid_input', userMessage: error.message };
    });
    
    // Security issues
    this.registerRecoveryStrategy('security', async (error, context) => {
      // For security issues, log and fail immediately
      zkErrorLogger.log('CRITICAL', 'Security-related recovery triggered', {
        error: error.message,
        context: context.operation
      });
      
      return { action: 'fail', reason: 'security_violation' };
    });
  }
  
  /**
   * Register a custom recovery strategy for a specific error category
   * @param {string} category - Error category or type
   * @param {Function} strategyFn - Strategy function that returns recovery action
   */
  registerRecoveryStrategy(category, strategyFn) {
    this.recoveryStrategies.set(category, strategyFn);
  }
  
  /**
   * Determine the appropriate recovery strategy for an error
   * @param {Error} error - The error to handle
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Recovery action details
   */
  async determineRecoveryStrategy(error, context) {
    if (isZKError(error)) {
      // Use category-specific strategy if available
      const strategy = this.recoveryStrategies.get(error.category);
      if (strategy) {
        return await strategy(error, context);
      }
      
      // Default strategies based on error properties
      if (!error.recoverable) {
        return { action: 'fail', reason: 'unrecoverable_error' };
      }
      
      if (error.userFixable) {
        return { 
          action: 'user_action', 
          message: error.recommendedAction || error.message 
        };
      }
    }
    
    // Generic retry for unknown errors
    return { action: 'retry', delay: 1000 };
  }
  
  /**
   * Execute an operation with comprehensive recovery
   * @param {string} operationId - Unique operation identifier
   * @param {Function} operationFn - Operation function to execute
   * @param {Object} options - Recovery options
   * @returns {Promise<any>} Operation result
   */
  async executeWithRecovery(operationId, operationFn, options = {}) {
    // Generate ID if not provided
    if (!operationId) {
      operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    
    // Merge with default options
    const opOptions = {
      ...this.options,
      ...options,
      operationId
    };
    
    // Track active operation
    this.activeOperations.set(operationId, {
      status: 'pending',
      startTime: Date.now(),
      options: opOptions
    });
    
    try {
      // Try to resume from checkpoint if enabled
      let initialState = null;
      if (opOptions.autoResumeEnabled && opOptions.checkpointingEnabled) {
        initialState = await getCheckpoint(operationId);
        
        if (initialState) {
          zkErrorLogger.log('INFO', 'Auto-resuming operation', {
            operationId,
            details: {
              state: initialState.step || 'unknown',
              age: Date.now() - (initialState.timestamp || 0)
            }
          });
        }
      }
      
      // Execute with retry and checkpointing
      let result;
      if (opOptions.checkpointingEnabled) {
        result = await withCheckpointing(
          async (state, updateState) => {
            return await withRetry(
              async (attempt) => operationFn(state, updateState, attempt),
              {
                maxRetries: opOptions.maxRetries,
                operationId,
                onProgress: opOptions.onProgress
              }
            );
          },
          operationId,
          {
            resume: opOptions.autoResumeEnabled,
            onProgress: opOptions.onProgress,
            removeOnCompletion: opOptions.removeCheckpointOnCompletion
          }
        );
      } else {
        // Just use retry without checkpointing
        result = await withRetry(
          async (attempt) => operationFn(initialState, null, attempt),
          {
            maxRetries: opOptions.maxRetries,
            operationId,
            onProgress: opOptions.onProgress
          }
        );
      }
      
      // Update operation status
      this.activeOperations.set(operationId, {
        ...this.activeOperations.get(operationId),
        status: 'completed',
        endTime: Date.now()
      });
      
      return result;
    } catch (error) {
      // Try to recover using appropriate strategy
      const context = {
        operation: operationId,
        options: opOptions,
        error
      };
      
      const strategy = await this.determineRecoveryStrategy(error, context);
      
      // Update operation status
      this.activeOperations.set(operationId, {
        ...this.activeOperations.get(operationId),
        status: 'failed',
        endTime: Date.now(),
        error: error.message,
        recoveryStrategy: strategy
      });
      
      // Log recovery attempt
      zkErrorLogger.log('WARNING', 'Operation recovery strategy determined', {
        operationId,
        category: 'recovery',
        details: {
          strategy: strategy.action,
          error: error.message,
          recoverable: error.recoverable
        }
      });
      
      // Throw enhanced error with recovery info
      error.recoveryStrategy = strategy;
      throw error;
    }
  }
  
  /**
   * Get status of all active and recent operations
   * @returns {Array<Object>} Operation status list
   */
  getOperationStatus() {
    return Array.from(this.activeOperations.entries())
      .map(([id, status]) => ({
        id,
        ...status
      }));
  }
  
  /**
   * Clean up completed operations
   * @param {number} maxAgeMs - Maximum age in milliseconds
   */
  cleanupCompletedOperations(maxAgeMs = 3600000) {
    const now = Date.now();
    
    for (const [id, status] of this.activeOperations.entries()) {
      if (status.endTime && (now - status.endTime > maxAgeMs)) {
        this.activeOperations.delete(id);
        
        // Also remove any checkpoints
        if (status.options?.checkpointingEnabled) {
          removeCheckpoint(id).catch(() => {});
        }
      }
    }
  }
}

// Create singleton instance
const autoRecoveryManager = new AutoRecoveryManager();

// Export all functions and classes
module.exports = {
  withRetry,
  createCheckpoint,
  getCheckpoint,
  removeCheckpoint,
  listCheckpoints,
  withCheckpointing,
  processBatch,
  createTransferableCheckpoint,
  resumeFromTransferableCheckpoint,
  AutoRecoveryManager,
  autoRecoveryManager
};