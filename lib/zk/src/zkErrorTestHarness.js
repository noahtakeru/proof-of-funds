/**
 * ZK Error Testing Harness
 * 
 * This module provides comprehensive testing tools for the ZK error handling
 * and recovery system, including fault injection, error simulation, and 
 * recovery scenario testing.
 * 
 * Key features:
 * - Network failure simulation
 * - Memory constraint simulation
 * - Corrupted input testing
 * - Recovery scenario testing
 * - Cross-component error propagation testing
 */

const { 
  ZKError, ErrorCode, ErrorSeverity, ErrorCategory,
  CircuitError, ProofError, VerificationError,
  MemoryError, NetworkError, SecurityError
} = require('./zkErrorHandler.js');

const { zkErrorLogger } = require('./zkErrorLogger.js');
const zkRecovery = require('./zkRecoverySystem.js');

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
 * Execute a function with simulated worker termination
 * @param {Function} fn - Function to execute
 * @param {Object} options - Options for termination simulation
 * @returns {Promise<any>} Function result or error
 */
async function withWorkerTerminationSimulation(fn, options = {}) {
  const config = {
    terminationPoint: 'middle', // 'start', 'middle', 'end'
    reason: 'crash', // 'crash', 'timeout', 'user_cancel'
    recoveryTest: false, // Whether to test recovery mechanisms
    ...options
  };
  
  // Calculate delay based on termination point
  let delay = 0;
  switch (config.terminationPoint) {
    case 'start': delay = 100; break;
    case 'middle': delay = 500; break;
    case 'end': delay = 900; break;
  }
  
  // Function to simulate worker termination
  const simulateTermination = () => {
    switch (config.reason) {
      case 'crash':
        throw new ZKError('Worker process crashed', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          category: ErrorCategory.SYSTEM,
          recoverable: true,
          details: { 
            reason: 'crash',
            terminationPoint: config.terminationPoint
          }
        });
        
      case 'timeout':
        throw new ZKError('Worker process timed out', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          category: ErrorCategory.SYSTEM,
          recoverable: true,
          details: { 
            reason: 'timeout',
            terminationPoint: config.terminationPoint
          }
        });
        
      case 'user_cancel':
        throw new ZKError('Operation cancelled by user', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          category: ErrorCategory.SYSTEM,
          recoverable: false, // User cancellation is intentional
          expected: true,
          details: { 
            reason: 'user_cancel',
            terminationPoint: config.terminationPoint
          }
        });
        
      default:
        throw new ZKError('Worker terminated unexpectedly', {
          code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
          category: ErrorCategory.SYSTEM,
          recoverable: true
        });
    }
  };
  
  // Wait for delay
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // If testing recovery and not user cancellation, use checkpointing
  if (config.recoveryTest && config.reason !== 'user_cancel') {
    return zkRecovery.withCheckpointing(
      // Checkpointed function that can resume
      async (state, updateState) => {
        // If fresh start, set initial state
        if (!state.progress) {
          await updateState({
            step: 1,
            progress: 10,
            status: 'Starting operation'
          });
        }
        
        // If before termination point, simulate termination
        if (state.step <= 2) {
          await updateState({
            step: 2,
            progress: 30,
            status: 'About to terminate'
          });
          
          // Simulate termination
          simulateTermination();
        }
        
        // Continue operation after recovery
        await updateState({
          step: 3,
          progress: 60,
          status: 'Recovered from termination'
        });
        
        // Complete operation
        await updateState({
          step: 4,
          progress: 100,
          status: 'Operation completed'
        });
        
        return fn();
      },
      'test_recovery_worker',
      {
        checkpointIntervalMs: 200 // Faster for testing
      }
    );
  } else {
    // Just simulate the termination
    simulateTermination();
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
  
  try {
    // Function to simulate error in a component
    const simulateComponentError = (component) => {
      if (component === config.errorLocation) {
        switch (component) {
          case 'input':
            throw new ZKError('Input validation error', {
              code: ErrorCode.INPUT_VALIDATION_FAILED,
              category: ErrorCategory.INPUT,
              recoverable: true,
              userFixable: true
            });
            
          case 'circuit':
            throw new CircuitError('Circuit execution error', {
              code: ErrorCode.CIRCUIT_EXECUTION_ERROR,
              recoverable: false
            });
            
          case 'proof':
            throw new ProofError('Proof generation error', {
              code: ErrorCode.PROOF_GENERATION_FAILED,
              recoverable: true
            });
            
          case 'verification':
            throw new VerificationError('Verification error', {
              code: ErrorCode.VERIFICATION_FAILED,
              recoverable: false
            });
        }
      }
    };
    
    // Function to handle error based on propagation behavior
    const handleComponentError = (error, component, nextComponent) => {
      // Record propagation
      results.propagationPath.push({
        component,
        error: error.message,
        code: error.code
      });
      
      // Apply propagation behavior
      switch (config.propagationBehavior) {
        case 'bubble':
          // Just rethrow to bubble up
          throw error;
          
        case 'transform':
          // Transform error to next component
          switch (nextComponent) {
            case 'circuit':
              throw new CircuitError(`Circuit error caused by ${component}: ${error.message}`, {
                code: ErrorCode.CIRCUIT_PARAMETER_ERROR,
                recoverable: error.recoverable,
                details: { originalError: error }
              });
              
            case 'proof':
              throw new ProofError(`Proof error caused by ${component}: ${error.message}`, {
                code: ErrorCode.PROOF_GENERATION_FAILED,
                recoverable: error.recoverable,
                details: { originalError: error }
              });
              
            case 'verification':
              throw new VerificationError(`Verification error caused by ${component}: ${error.message}`, {
                code: ErrorCode.VERIFICATION_FAILED,
                recoverable: error.recoverable,
                details: { originalError: error }
              });
              
            default:
              throw new ZKError(`Error caused by ${component}: ${error.message}`, {
                code: error.code,
                recoverable: error.recoverable,
                details: { originalError: error }
              });
          }
          
        case 'handle':
          // Handle the error without propagating
          results.errorHandled = true;
          zkErrorLogger.logError(error, {
            additionalData: {
              component,
              action: 'error_handled',
              propagation: 'stopped'
            }
          });
          
          return { // Return recovery result
            handled: true,
            component,
            message: `Error handled at ${component}`
          };
      }
    };
    
    // Apply recovery strategy if specified
    const executeWithRecovery = async (fn) => {
      switch (config.recoveryStrategy) {
        case 'retry':
          results.recoveryAttempted = true;
          return zkRecovery.withRetry(fn, {
            maxRetries: 2,
            operationId: 'test_propagation_retry',
            shouldRetry: () => {
              // Only retry once for testing
              return true;
            }
          }).then(result => {
            results.recoverySucceeded = true;
            return result;
          });
          
        case 'fallback':
          results.recoveryAttempted = true;
          try {
            return await fn();
          } catch (error) {
            // Log the error
            zkErrorLogger.logError(error, {
              additionalData: {
                action: 'fallback_recovery',
                recoveryType: 'fallback'
              }
            });
            
            // Use fallback
            results.recoverySucceeded = true;
            return {
              fallback: true,
              message: 'Used fallback implementation',
              originalError: error.message
            };
          }
          
        case 'checkpoint':
          results.recoveryAttempted = true;
          return zkRecovery.withCheckpointing(
            // State contains recovery attempts
            async (state, updateState) => {
              // If recovery attempt, increment counter
              if (state.recoveryAttempts) {
                await updateState({
                  recoveryAttempts: state.recoveryAttempts + 1,
                  lastAttempt: Date.now()
                });
                
                // Second attempt succeeds
                if (state.recoveryAttempts > 1) {
                  results.recoverySucceeded = true;
                  return {
                    checkpoint: true,
                    recoveryAttempts: state.recoveryAttempts,
                    message: 'Recovered using checkpoint'
                  };
                }
              } else {
                // First attempt, initialize state
                await updateState({
                  recoveryAttempts: 1,
                  lastAttempt: Date.now()
                });
              }
              
              // Try the function (will fail on first attempt)
              return await fn();
            },
            'test_propagation_checkpoint',
            {
              checkpointIntervalMs: 100 // Fast for testing
            }
          );
          
        default:
          // No recovery
          return fn();
      }
    };
    
    // Execute multi-step operation with error propagation
    let result;
    
    // Input processing step
    result = await executeWithRecovery(async () => {
      // Simulate potential error in input
      simulateComponentError('input');
      
      // Return validated input
      return { valid: true };
    }).catch(error => handleComponentError(error, 'input', 'circuit'));
    
    // If handled without propagation, return early
    if (result && result.handled) return results;
    
    // Circuit processing step
    result = await executeWithRecovery(async () => {
      // Simulate potential error in circuit
      simulateComponentError('circuit');
      
      // Return circuit execution result
      return { circuitResult: true };
    }).catch(error => handleComponentError(error, 'circuit', 'proof'));
    
    // If handled without propagation, return early
    if (result && result.handled) return results;
    
    // Proof generation step
    result = await executeWithRecovery(async () => {
      // Simulate potential error in proof generation
      simulateComponentError('proof');
      
      // Return proof result
      return { 
        proof: { valid: true },
        publicSignals: [1, 2, 3]
      };
    }).catch(error => handleComponentError(error, 'proof', 'verification'));
    
    // If handled without propagation, return early
    if (result && result.handled) return results;
    
    // Verification step
    result = await executeWithRecovery(async () => {
      // Simulate potential error in verification
      simulateComponentError('verification');
      
      // Return verification result
      return { verified: true };
    }).catch(error => handleComponentError(error, 'verification', null));
    
    // Made it through without errors
    return {
      ...results,
      success: true,
      finalResult: result
    };
  } catch (error) {
    // Record the error
    results.errorOccurred = true;
    results.errorCaught = true;
    results.finalError = {
      message: error.message,
      code: error.code,
      category: error.category,
      recoverable: error.recoverable
    };
    
    // Log the error
    zkErrorLogger.logError(error, {
      additionalData: {
        test: 'error_propagation',
        propagationPath: results.propagationPath
      }
    });
    
    return results;
  }
}

// Export all test functions
module.exports = {
  withNetworkFailureSimulation,
  withMemoryConstraintSimulation,
  withCorruptedInputSimulation,
  withWorkerTerminationSimulation,
  batchRecoveryTest,
  createErrorPropagationTest
};