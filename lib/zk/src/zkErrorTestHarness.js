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
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * This module is like a flight simulator for testing error scenarios in our
 * zero-knowledge proof system. Just as pilots train for emergencies in a simulator,
 * this code helps us prepare for real-world problems by:
 * 
 * 1. Creating controlled "failures" to test recovery mechanisms
 * 2. Simulating different types of errors (network problems, memory issues, etc.)
 * 3. Testing how errors move through the system and how they're handled
 * 4. Verifying that our recovery strategies actually work
 * 
 * This ensures that when real issues happen in production, our system gracefully
 * handles them rather than crashing.
 * 
 * @module zkErrorTestHarness
 */

// Module Format Re-Exporter
// This file dynamically loads the appropriate module format (ESM or CommonJS)
// based on the detected environment.

// Check if ESM environment (based on import.meta presence)
const isEsm = typeof import.meta === 'object';

// Create a logger function that can be used before the actual logger is loaded
const logDebug = (message) => {
  if (typeof process !== 'undefined' && process.env.DEBUG) {
    console.debug(`[zkErrorTestHarness] ${message}`);
  }
};

const logError = (message, error) => {
  console.error(`[zkErrorTestHarness] ${message}`, error);
};

/**
 * Error thrown when the module fails to load dependencies
 * 
 * @class ErrorTestHarnessModuleError
 * @extends Error
 */
class ErrorTestHarnessModuleError extends Error {
  /**
   * Create a new ErrorTestHarnessModuleError
   * 
   * @param {string} message - Error message
   * @param {Object} options - Additional options
   * @param {string} [options.code] - Error code
   * @param {string} [options.severity] - Error severity level
   * @param {boolean} [options.recoverable] - Whether the error is recoverable
   * @param {string} [options.operationId] - Unique operation ID for tracing
   * @param {Object} [options.details] - Additional error details
   * @param {Error} [options.originalError] - Original error that caused this one
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'ErrorTestHarnessModuleError';
    this.code = options.code || 'ERROR_TEST_HARNESS_MODULE_ERROR';
    this.severity = options.severity || 'ERROR';
    this.recoverable = options.recoverable !== undefined ? options.recoverable : true;
    this.operationId = options.operationId || `error_test_harness_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.details = {
      ...(options.details || {}),
      component: 'zkErrorTestHarness',
      timestamp: new Date().toISOString()
    };
    
    // Capture original error info if provided
    if (options.originalError) {
      this.originalError = options.originalError;
      this.originalStack = options.originalError.stack;
    }
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Module storage for lazy loading
let moduleExports = null;
let moduleLoadPromise = null;
let errorLogger = null;

/**
 * Load the appropriate module format based on the environment
 * 
 * @private
 * @async
 * @function loadModule
 * @returns {Promise<Object>} Promise that resolves to the module exports
 * @throws {ErrorTestHarnessModuleError} When module loading fails
 */
async function loadModule() {
  if (moduleExports) {
    return moduleExports;
  }
  
  if (!moduleLoadPromise) {
    const operationId = `load_error_test_harness_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    moduleLoadPromise = (async () => {
      try {
        logDebug(`Loading module in ${isEsm ? 'ESM' : 'CommonJS'} environment (operationId: ${operationId})`);
        
        if (isEsm) {
          // ESM environment
          const [module, loggerModule] = await Promise.all([
            import('./zkErrorTestHarness.mjs'),
            import('./zkErrorLogger.mjs')
          ]);
          
          moduleExports = module.default || module;
          errorLogger = loggerModule.default || loggerModule.zkErrorLogger;
          
          logDebug(`Successfully loaded ESM module (operationId: ${operationId})`);
        } else {
          // CommonJS environment
          moduleExports = require('./cjs/zkErrorTestHarness.cjs');
          const loggerModule = require('./cjs/zkErrorLogger.cjs');
          errorLogger = loggerModule.zkErrorLogger;
          
          logDebug(`Successfully loaded CommonJS module (operationId: ${operationId})`);
        }
        
        return moduleExports;
      } catch (error) {
        // First try to log using structured logger if available
        try {
          if (errorLogger && errorLogger.logError) {
            await errorLogger.logError(error, {
              context: 'zkErrorTestHarness.loadModule',
              operationId,
              details: {
                environment: isEsm ? 'ESM' : 'CommonJS',
                moduleType: 'error-test-harness'
              }
            });
          }
        } catch (loggingError) {
          // If structured logging fails, fallback to console
          logError(`Error during structured logging: ${loggingError.message}`, loggingError);
        }
        
        // Always log to console for visibility
        logError(`Failed to load module: ${error.message} (operationId: ${operationId})`, error);
        
        // Throw a specialized error with context
        throw new ErrorTestHarnessModuleError(
          `Failed to load zkErrorTestHarness module: ${error.message}`,
          {
            operationId,
            originalError: error,
            details: {
              environment: isEsm ? 'ESM' : 'CommonJS',
              moduleType: 'error-test-harness'
            }
          }
        );
      }
    })();
  }
  
  return moduleLoadPromise;
}

/**
 * Get a module property, ensuring module is loaded first
 * 
 * @private
 * @async
 * @function getModuleProp
 * @param {string} prop - Property name to get
 * @returns {Promise<*>} Promise that resolves to the property value
 */
async function getModuleProp(prop) {
  try {
    const module = await loadModule();
    return module[prop];
  } catch (error) {
    // Try to use error logger if available
    try {
      if (errorLogger && errorLogger.logError) {
        await errorLogger.logError(error, {
          context: 'zkErrorTestHarness.getModuleProp',
          details: {
            property: prop,
            environment: isEsm ? 'ESM' : 'CommonJS'
          }
        });
      }
    } catch (loggingError) {
      logError(`Error during property access logging: ${loggingError.message}`, loggingError);
    }
    
    // Always log to console
    logError(`Failed to access property '${prop}': ${error.message}`, error);
    throw error;
  }
}

// Create a proxy to lazily load the module and access its properties
const moduleProxy = new Proxy({}, {
  get: (target, prop) => {
    // Special case for Symbol.toStringTag to avoid errors with console.log
    if (prop === Symbol.toStringTag) {
      return 'Module';
    }
    
    // Return a function that loads the module before accessing the property
    return (...args) => {
      return getModuleProp(prop)
        .then(value => typeof value === 'function' ? value(...args) : value)
        .catch(error => {
          // Log error and rethrow
          logError(`Error accessing or executing ${String(prop)}: ${error.message}`, error);
          throw error;
        });
    };
  }
});

/**
 * Execute a function with simulated network failure to test error handling
 * 
 * This function allows developers to test how their code handles network failures
 * by injecting controlled failures during function execution.
 * 
 * @async
 * @function withNetworkFailureSimulation
 * @param {Function} fn - Function to execute with potential failure
 * @param {Object} [options] - Options for failure simulation
 * @param {number} [options.failureRate=0.5] - Probability of failure (0-1)
 * @param {string} [options.failureMode='timeout'] - Type of failure: 'timeout', 'error', or 'disconnect'
 * @param {number} [options.delayMs=1000] - Delay in ms before simulated failure
 * @param {boolean} [options.retryAllowed=true] - Whether retry should be allowed
 * @param {boolean} [options.recoveryTest=false] - Whether to test recovery mechanisms
 * @returns {Promise<any>} Function result or error
 * @throws {NetworkError} When failure is simulated
 * @example
 * // Test a network request with 50% chance of timeout
 * const result = await withNetworkFailureSimulation(
 *   () => fetchData(url),
 *   { failureRate: 0.5, failureMode: 'timeout' }
 * );
 */
export const withNetworkFailureSimulation = (...args) => getModuleProp('withNetworkFailureSimulation').then(fn => fn(...args));

/**
 * Execute a function with simulated memory constraints to test error handling
 * 
 * This function allows developers to test how their code handles memory pressure
 * and constraints by simulating different levels of memory constraints.
 * 
 * @async
 * @function withMemoryConstraintSimulation
 * @param {Function} fn - Function to execute with memory constraints
 * @param {Object} [options] - Options for memory constraint simulation
 * @param {string} [options.constraintLevel='warning'] - Constraint level: 'warning', 'critical', or 'fatal'
 * @param {number} [options.simulatedMemoryMB=100] - Simulated available memory in MB
 * @param {boolean} [options.recoveryTest=false] - Whether to test recovery mechanisms
 * @returns {Promise<any>} Function result or error
 * @throws {MemoryError} When memory constraints are simulated at critical or fatal levels
 * @example
 * // Test proof generation with critical memory constraint
 * const proof = await withMemoryConstraintSimulation(
 *   () => generateProof(input),
 *   { constraintLevel: 'critical', simulatedMemoryMB: 50 }
 * );
 */
export const withMemoryConstraintSimulation = (...args) => getModuleProp('withMemoryConstraintSimulation').then(fn => fn(...args));

/**
 * Execute a function with simulated corrupted input to test error handling
 * 
 * This function allows developers to test how their code handles corrupted or
 * invalid inputs by simulating various types of input corruption.
 * 
 * @async
 * @function withCorruptedInputSimulation
 * @param {Function} fn - Function to execute with corrupted input
 * @param {Object} [options] - Options for corruption simulation
 * @param {string} [options.corruptionType='invalid'] - Type of corruption: 'invalid', 'malformed', or 'missing'
 * @param {string} [options.targetComponent='proof'] - Component to target: 'circuit', 'proof', or 'verification'
 * @param {boolean} [options.recoveryTest=false] - Whether to test recovery mechanisms
 * @returns {Promise<any>} Function result or error
 * @throws {CircuitError|ProofError|VerificationError|ZKError} Based on the target component and corruption type
 * @example
 * // Test verification with corrupted proof input
 * const result = await withCorruptedInputSimulation(
 *   () => verifyProof(proof, publicSignals),
 *   { corruptionType: 'malformed', targetComponent: 'verification' }
 * );
 */
export const withCorruptedInputSimulation = (...args) => getModuleProp('withCorruptedInputSimulation').then(fn => fn(...args));

/**
 * Execute a function with simulated worker termination to test error handling
 * 
 * This function allows developers to test how their code handles worker process
 * termination by simulating different termination scenarios at various points
 * during execution.
 * 
 * @async
 * @function withWorkerTerminationSimulation
 * @param {Function} fn - Function to execute with potential termination
 * @param {Object} [options] - Options for termination simulation
 * @param {string} [options.terminationPoint='middle'] - When to terminate: 'start', 'middle', or 'end'
 * @param {string} [options.reason='crash'] - Reason for termination: 'crash', 'timeout', or 'user_cancel'
 * @param {boolean} [options.recoveryTest=false] - Whether to test recovery mechanisms
 * @returns {Promise<any>} Function result or error
 * @throws {ZKError} When worker termination is simulated
 * @example
 * // Test proof generation with worker crash in the middle
 * const proof = await withWorkerTerminationSimulation(
 *   () => generateProof(input),
 *   { terminationPoint: 'middle', reason: 'crash', recoveryTest: true }
 * );
 */
export const withWorkerTerminationSimulation = (...args) => getModuleProp('withWorkerTerminationSimulation').then(fn => fn(...args));

/**
 * Test batch operations with various failure scenarios to validate recovery
 * 
 * This function helps developers test batch processing with controlled failures
 * to validate that recovery mechanisms work correctly across multiple items.
 * It allows configuring different failure patterns and testing batch concurrency.
 * 
 * @async
 * @function batchRecoveryTest
 * @param {Array} items - Array of items to process in the batch
 * @param {Function} processItemFn - Function to process each individual item 
 * @param {Object} [options] - Batch test options
 * @param {number} [options.failureRate=0.3] - Probability of failure for each item (0-1)
 * @param {string} [options.failureType='random'] - Failure pattern: 'random', 'specific', or 'pattern'
 * @param {Array<number>} [options.failureIndexes=[]] - Specific indexes to fail (for 'specific' type)
 * @param {number} [options.failurePattern=3] - Fail every Nth item (for 'pattern' type)
 * @param {number} [options.batchConcurrency=2] - Number of items to process concurrently
 * @returns {Promise<Object>} Batch processing results including success/failure counts
 * @throws {Error} If items array is empty or invalid
 * @example
 * // Test batch processing with specific items failing
 * const results = await batchRecoveryTest(
 *   [item1, item2, item3, item4, item5],
 *   (item) => processItem(item),
 *   { failureType: 'specific', failureIndexes: [1, 3] }
 * );
 */
export const batchRecoveryTest = (...args) => getModuleProp('batchRecoveryTest').then(fn => fn(...args));

/**
 * Create test scenario for cross-component error propagation to validate error handling
 * 
 * This function creates a controlled multi-step test that simulates errors
 * propagating across different components of the ZK system. It allows testing
 * different error propagation behaviors and recovery strategies.
 * 
 * @async
 * @function createErrorPropagationTest
 * @param {Object} [options] - Test scenario options
 * @param {Array<string>} [options.components=['input', 'circuit', 'proof', 'verification']] - Components to include
 * @param {string} [options.errorLocation='proof'] - Where the error should originate
 * @param {string} [options.propagationBehavior='bubble'] - How errors propagate: 'bubble', 'transform', or 'handle'
 * @param {string} [options.recoveryStrategy='none'] - Recovery strategy: 'none', 'retry', 'fallback', or 'checkpoint'
 * @returns {Promise<Object>} Detailed test results including error propagation path and recovery outcomes
 * @example
 * // Test error propagation with transform behavior and fallback recovery
 * const results = await createErrorPropagationTest({
 *   errorLocation: 'circuit',
 *   propagationBehavior: 'transform',
 *   recoveryStrategy: 'fallback'
 * });
 */
export const createErrorPropagationTest = (...args) => getModuleProp('createErrorPropagationTest').then(fn => fn(...args));

/**
 * Error class thrown when test harness operations fail
 * 
 * This is a specialized error class for test harness-specific errors,
 * providing additional context and error classification.
 * 
 * @async
 * @function TestHarnessError
 * @param {string} message - Error message
 * @param {Object} [options] - Error options
 * @param {string} [options.code] - Error code
 * @param {string} [options.severity] - Error severity level
 * @param {string} [options.category] - Error category
 * @param {boolean} [options.recoverable] - Whether the error is recoverable
 * @param {Object} [options.details] - Additional error details
 * @param {Error} [options.originalError] - Original error that caused this one
 * @returns {Promise<TestHarnessError>} A specialized test harness error 
 * @example
 * // Create and throw a test harness error
 * throw await TestHarnessError(
 *   "Test scenario failed unexpectedly",
 *   { 
 *     code: "TEST_HARNESS_SCENARIO_FAILED",
 *     severity: "ERROR",
 *     recoverable: false,
 *     details: { scenarioName: "network-failure-test" }
 *   }
 * );
 */
export const TestHarnessError = async (...args) => {
  try {
    const ErrorClass = await getModuleProp('TestHarnessError');
    return new ErrorClass(...args);
  } catch (error) {
    // Log error and fallback to basic error
    logError(`Failed to create TestHarnessError, falling back to standard Error: ${error.message}`, error);
    return new Error(`TestHarnessError: ${args[0]}`);
  }
};

// Default export for convenience and backward compatibility
export default moduleProxy;