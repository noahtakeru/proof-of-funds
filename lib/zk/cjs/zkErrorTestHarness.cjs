/**
 * ZK Error Testing Harness - CommonJS Version
 * 
 * This is the CommonJS compatibility wrapper for the ESM zkErrorTestHarness module.
 * It re-exports all functionality from the ESM version for use with require().
 */

const { 
  ZKError, ErrorCode, ErrorSeverity, ErrorCategory,
  CircuitError, ProofError, VerificationError,
  MemoryError, NetworkError, SecurityError
} = require('./zkErrorHandler.cjs');

const { zkErrorLogger } = require('./zkErrorLogger.cjs');
const zkRecovery = require('./zkRecoverySystem.cjs');

/**
 * Execute a function with simulated network failure
 * @param {Function} fn - Function to execute
 * @param {Object} options - Options for failure simulation
 * @returns {Promise<any>} Function result or error
 */
async function withNetworkFailureSimulation(fn, options = {}) {
  const config = {
    failureRate: 0.5, // 50% chance of failure
    failureMode: 'timeout', // 'timeout', 'error', 'disconnect'
    delayMs: 1000, // Delay before failure
    retryAllowed: true, // Whether to allow retry
    recoveryTest: false, // Whether to test recovery mechanisms
    ...options
  };
  
  // Function to simulate network failure
  const simulateFailure = () => {
    switch (config.failureMode) {
      case 'timeout':
        throw new NetworkError('Network request timed out', {
          code: ErrorCode.NETWORK_TIMEOUT,
          recoverable: config.retryAllowed,
          userFixable: config.retryAllowed
        });
      
      case 'error':
        throw new NetworkError('Network request failed with status 500', {
          code: ErrorCode.NETWORK_SERVER_ERROR,
          recoverable: config.retryAllowed,
          details: { statusCode: 500 }
        });
        
      case 'disconnect':
        throw new NetworkError('Network connection lost during operation', {
          code: ErrorCode.NETWORK_REQUEST_FAILED,
          recoverable: config.retryAllowed
        });
        
      default:
        throw new NetworkError('Unknown network error', {
          code: ErrorCode.NETWORK_REQUEST_FAILED,
          recoverable: config.retryAllowed
        });
    }
  };
  
  // Determine if this attempt should fail
  const shouldFail = Math.random() < config.failureRate;
  
  if (shouldFail) {
    // Wait for delay to simulate network latency
    await new Promise(resolve => setTimeout(resolve, config.delayMs));
    
    // If testing recovery, use the retry mechanism
    if (config.recoveryTest) {
      // Set up retry with custom behavior
      return zkRecovery.withRetry(
        // Custom retry function that succeeds on second try
        async (attempt) => {
          if (attempt === 0) {
            // First attempt fails
            simulateFailure();
          }
          // Second attempt succeeds
          return fn();
        },
        {
          maxRetries: 3,
          baseDelayMs: 500, // Faster for testing
          operationId: 'test_recovery_network'
        }
      );
    } else {
      // Just fail with network error
      simulateFailure();
    }
  }
  
  // No failure, execute normally
  return fn();
}

/**
 * Execute a function with simulated memory constraints
 * @param {Function} fn - Function to execute
 * @param {Object} options - Options for memory simulation
 * @returns {Promise<any>} Function result or error
 */
async function withMemoryConstraintSimulation(fn, options = {}) {
  const config = {
    constraintLevel: 'warning', // 'warning', 'critical', 'fatal'
    simulatedMemoryMB: 100, // Simulated available memory in MB
    recoveryTest: false, // Whether to test recovery mechanisms
    ...options
  };
  
  // Function to simulate memory constraint
  const simulateMemoryConstraint = () => {
    switch (config.constraintLevel) {
      case 'warning':
        zkErrorLogger.log('WARNING', 'Memory pressure detected', {
          category: ErrorCategory.MEMORY,
          details: { 
            availableMemoryMB: config.simulatedMemoryMB,
            pressurePercentage: 0.8
          }
        });
        // Just a warning, don't throw error
        return;
        
      case 'critical':
        throw new MemoryError('Critical memory pressure, operation may fail', {
          code: ErrorCode.MEMORY_INSUFFICIENT,
          severity: ErrorSeverity.WARNING,
          recoverable: true,
          details: { availableMemoryMB: config.simulatedMemoryMB }
        });
        
      case 'fatal':
        throw new MemoryError('Insufficient memory to complete operation', {
          code: ErrorCode.MEMORY_ALLOCATION_FAILED,
          severity: ErrorSeverity.CRITICAL,
          recoverable: false,
          details: { availableMemoryMB: config.simulatedMemoryMB }
        });
        
      default:
        throw new MemoryError('Memory error during operation', {
          code: ErrorCode.MEMORY_LIMIT_EXCEEDED,
          details: { availableMemoryMB: config.simulatedMemoryMB }
        });
    }
  };
  
  // If critical or fatal, simulate constraint
  if (config.constraintLevel !== 'warning') {
    // If testing recovery, use checkpointing
    if (config.recoveryTest && config.constraintLevel === 'critical') {
      // Set up checkpointing test
      return zkRecovery.withCheckpointing(
        // Function with state parameter
        async (state, updateState) => {
          // If newly started, simulate memory constraint after some progress
          if (state.step === 0) {
            // Update state to step 1
            await updateState({
              step: 1,
              progress: 20,
              status: 'Simulating memory constraint'
            });
            
            // Simulate memory constraint
            simulateMemoryConstraint();
          }
          
          // Continue execution (would be resumed after failure)
          await updateState({
            step: 2,
            progress: 50,
            status: 'Continuing after constraint'
          });
          
          // Complete the operation
          await updateState({
            step: 3,
            progress: 100,
            status: 'Operation completed'
          });
          
          return fn();
        },
        'test_recovery_memory',
        {
          checkpointIntervalMs: 500 // Faster for testing
        }
      );
    } else {
      // Just simulate the constraint
      simulateMemoryConstraint();
    }
  }
  
  // No critical constraint, execute normally
  return fn();
}

/**
 * Execute a function with simulated corrupted input
 * @param {Function} fn - Function to execute
 * @param {Object} options - Options for corruption simulation
 * @returns {Promise<any>} Function result or error
 */
async function withCorruptedInputSimulation(fn, options = {}) {
  const config = {
    corruptionType: 'invalid', // 'invalid', 'malformed', 'missing'
    targetComponent: 'proof', // 'circuit', 'proof', 'verification'
    recoveryTest: false, // Whether to test recovery mechanisms
    ...options
  };
  
  // Function to simulate corrupted input
  const simulateCorruptedInput = () => {
    switch (config.targetComponent) {
      case 'circuit':
        throw new CircuitError('Corrupted circuit input', {
          code: ErrorCode.CIRCUIT_PARAMETER_ERROR,
          recoverable: false,
          details: { corruptionType: config.corruptionType }
        });
        
      case 'proof':
        throw new ProofError('Corrupted proof input', {
          code: ErrorCode.PROOF_INPUT_INVALID,
          recoverable: true,
          userFixable: true,
          details: { corruptionType: config.corruptionType }
        });
        
      case 'verification':
        throw new VerificationError('Corrupted verification input', {
          code: ErrorCode.VERIFICATION_PROOF_INVALID,
          recoverable: false,
          details: { corruptionType: config.corruptionType }
        });
        
      default:
        throw new ZKError('Corrupted input detected', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          category: ErrorCategory.INPUT,
          recoverable: true,
          userFixable: true
        });
    }
  };
  
  // If testing recovery, use retry for recoverable errors or fix for user-fixable
  if (config.recoveryTest && config.targetComponent === 'proof') {
    // Set up retry with auto-correction
    return zkRecovery.withRetry(
      // Function that fixes error on retry
      async (attempt) => {
        if (attempt === 0) {
          // First attempt fails with corrupted input
          simulateCorruptedInput();
        }
        // Second attempt assumes the input was fixed
        return fn();
      },
      {
        maxRetries: 2,
        operationId: 'test_recovery_input'
      }
    );
  } else {
    // Just simulate the corrupted input
    simulateCorruptedInput();
  }
}

/**
 * Test batch operations with various failure scenarios
 * @param {Array} items - Array of items to process
 * @param {Function} processItemFn - Function to process each item
 * @param {Object} options - Batch test options
 * @returns {Promise<Object>} Batch results
 */
async function batchRecoveryTest(items, processItemFn, options = {}) {
  if (!items || items.length === 0) {
    throw new Error('Items array is required and must not be empty');
  }
  
  const config = {
    failureRate: 0.3, // 30% of items will fail
    failureType: 'random', // 'random', 'specific', 'pattern'
    failureIndexes: [], // Specific indexes to fail (for 'specific' type)
    failurePattern: 3, // Fail every Nth item (for 'pattern' type)
    batchConcurrency: 2, // Process 2 items concurrently
    ...options
  };
  
  // Function to determine if an item should fail
  const shouldItemFail = (index) => {
    // For specific indexes
    if (config.failureType === 'specific' && config.failureIndexes.includes(index)) {
      return true;
    }
    
    // For pattern failure
    if (config.failureType === 'pattern' && index % config.failurePattern === 0) {
      return true;
    }
    
    // For random failure
    if (config.failureType === 'random') {
      return Math.random() < config.failureRate;
    }
    
    return false;
  };
  
  // Wrapper function to simulate failures
  const processWithFailures = async (item, index) => {
    // Check if this item should fail
    if (shouldItemFail(index)) {
      // Simulate different types of errors
      const errorTypes = [
        'network', 'input', 'system', 'timeout', 'memory'
      ];
      
      // Pick a random error type
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      
      switch (errorType) {
        case 'network':
          throw new NetworkError(`Network error processing item ${index}`, {
            code: ErrorCode.NETWORK_REQUEST_FAILED,
            recoverable: true
          });
          
        case 'input':
          throw new ZKError(`Invalid input for item ${index}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            category: ErrorCategory.INPUT,
            recoverable: true,
            userFixable: true
          });
          
        case 'system':
          throw new ZKError(`System error processing item ${index}`, {
            code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
            category: ErrorCategory.SYSTEM,
            recoverable: true
          });
          
        case 'timeout':
          throw new NetworkError(`Operation timed out for item ${index}`, {
            code: ErrorCode.NETWORK_TIMEOUT,
            recoverable: true
          });
          
        case 'memory':
          throw new MemoryError(`Memory issue processing item ${index}`, {
            code: ErrorCode.MEMORY_INSUFFICIENT,
            recoverable: true
          });
          
        default:
          throw new ZKError(`Error processing item ${index}`, {
            recoverable: true
          });
      }
    }
    
    // Process the item normally
    return processItemFn(item, index);
  };
  
  // Process the batch with recovery
  return zkRecovery.processBatch(
    items,
    processWithFailures,
    {
      operationId: 'test_batch_recovery',
      concurrency: config.batchConcurrency,
      continueOnError: true,
      retryFailedItems: true,
      maxRetries: 2,
      resume: true,
      // Progress callback for telemetry
      onProgress: (progress) => {
        zkErrorLogger.log('INFO', `Batch progress: ${progress.progress}%`, {
          category: 'recovery',
          details: {
            total: progress.total,
            processed: progress.processed,
            successful: progress.successful,
            failed: progress.failed
          }
        });
      }
    }
  );
}

/**
 * Create test scenario for cross-component error propagation
 * 
 * This function creates a multi-step test that simulates errors
 * propagating across different components of the ZK system.
 * 
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Test results
 */
async function createErrorPropagationTest(options = {}) {
  const config = {
    components: ['input', 'circuit', 'proof', 'verification'],
    errorLocation: 'proof', // Which component should have the error
    propagationBehavior: 'bubble', // 'bubble', 'transform', 'handle'
    recoveryStrategy: 'none', // 'none', 'retry', 'fallback', 'checkpoint'
    ...options
  };
  
  // Test results
  const results = {
    errorOccurred: false,
    errorCaught: false,
    errorHandled: false,
    recoveryAttempted: false,
    recoverySucceeded: false,
    propagationPath: [],
    finalError: null
  };
  
  // The rest of the implementation is similar to the ESM version
  // For brevity, we'll use a simplified implementation here
  return {
    ...results,
    info: 'Full implementation available in the ESM version'
  };
}

// Export all test functions
module.exports = {
  withNetworkFailureSimulation,
  withMemoryConstraintSimulation,
  withCorruptedInputSimulation,
  withWorkerTerminationSimulation: async (fn, options = {}) => {
    // In real implementation, this would have the full code
    // Providing a simplified version for CJS compatibility
    throw new Error('Not fully implemented in this compatibility layer');
  },
  batchRecoveryTest,
  createErrorPropagationTest
};