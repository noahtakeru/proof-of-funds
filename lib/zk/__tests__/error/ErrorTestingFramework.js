/**
 * ZK Error Testing Framework
 * 
 * This module provides a comprehensive framework for testing error handling,
 * error recovery, and security validation in ZK proof systems.
 */

import crypto from 'crypto';

/**
 * Error types for testing
 * @enum {string}
 */
export const ErrorType = {
  VALIDATION: 'validation',
  CRYPTOGRAPHIC: 'cryptographic',
  NETWORK: 'network',
  RESOURCE: 'resource',
  SECURITY: 'security',
  INPUT: 'input',
  COMPUTATION: 'computation',
  INTEROPERABILITY: 'interoperability',
  COMPATIBILITY: 'compatibility',
  MEMORY: 'memory'
};

/**
 * Error severity levels
 * @enum {string}
 */
export const ErrorSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

/**
 * Error test result
 * @typedef {Object} ErrorTestResult
 * @property {boolean} success - Whether the test was successful
 * @property {string} name - Test name
 * @property {string} type - Error type that was tested
 * @property {string} description - Test description
 * @property {string} [expectedError] - Expected error message or pattern
 * @property {string} [actualError] - Actual error message if an error occurred
 * @property {boolean} [errorOccurred] - Whether an error occurred
 * @property {boolean} [recoverySucceeded] - Whether recovery succeeded (if applicable)
 * @property {any} [recoveryResult] - Result of recovery (if applicable)
 */

/**
 * Base class for error tests
 */
export class ErrorTest {
  /**
   * Create a new error test
   * @param {Object} options - Test options
   * @param {string} options.name - Test name
   * @param {string} options.type - Error type from ErrorType enum
   * @param {string} options.description - Test description
   * @param {string} [options.severity] - Error severity from ErrorSeverity enum
   */
  constructor(options) {
    this.name = options.name;
    this.type = options.type;
    this.description = options.description;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    
    // Default handlers
    this.errorHandler = this.defaultErrorHandler.bind(this);
    this.recoveryHandler = this.defaultRecoveryHandler.bind(this);
  }
  
  /**
   * Set a custom error handler
   * @param {Function} handler - Error handler function
   */
  setErrorHandler(handler) {
    this.errorHandler = handler;
  }
  
  /**
   * Set a custom recovery handler
   * @param {Function} handler - Recovery handler function
   */
  setRecoveryHandler(handler) {
    this.recoveryHandler = handler;
  }
  
  /**
   * Default error handler
   * @param {Error} error - Error that occurred
   * @param {Object} context - Test context
   * @returns {Object} Error handling result
   * @private
   */
  defaultErrorHandler(error, context) {
    return {
      handled: true,
      message: error.message,
      context
    };
  }
  
  /**
   * Default recovery handler
   * @param {Error} error - Error that occurred
   * @param {Object} context - Test context
   * @returns {Object} Recovery result
   * @private
   */
  defaultRecoveryHandler(error, context) {
    return {
      recovered: false,
      message: `No recovery implemented for ${this.type} errors`,
      context
    };
  }
  
  /**
   * Execute the test
   * This method should be overridden by subclasses
   * @returns {Promise<ErrorTestResult>} Test result
   * @async
   */
  async execute() {
    throw new Error('execute() method must be implemented by subclasses');
  }
}

/**
 * Input validation error test
 */
export class ValidationErrorTest extends ErrorTest {
  /**
   * Create a new validation error test
   * @param {Object} options - Test options
   * @param {string} options.name - Test name
   * @param {string} options.description - Test description
   * @param {Object} options.invalidInput - Invalid input that should trigger validation error
   * @param {Function} options.validationFunction - Function that should validate the input
   * @param {RegExp|string} [options.expectedError] - Expected error message or pattern
   */
  constructor(options) {
    super({
      name: options.name,
      type: ErrorType.VALIDATION,
      description: options.description,
      severity: options.severity || ErrorSeverity.MEDIUM
    });
    
    this.invalidInput = options.invalidInput;
    this.validationFunction = options.validationFunction;
    this.expectedError = options.expectedError;
  }
  
  /**
   * Execute the validation error test
   * @returns {Promise<ErrorTestResult>} Test result
   * @async
   */
  async execute() {
    const result = {
      success: false,
      name: this.name,
      type: this.type,
      description: this.description,
      expectedError: this.expectedError
    };
    
    try {
      // Execute the validation function with invalid input
      const validationResult = await this.validationFunction(this.invalidInput);
      
      // If we reach here without an error, validation failed to catch the invalid input
      result.errorOccurred = false;
      result.actualError = 'No error occurred, but validation should have failed';
      
      // Check if the validation function returned an error object instead of throwing
      if (validationResult && validationResult.error) {
        result.errorOccurred = true;
        result.actualError = validationResult.error;
        
        // Check if the error matches the expected pattern
        if (this.expectedError) {
          const matches = this.checkErrorMatch(validationResult.error, this.expectedError);
          result.success = matches;
        } else {
          // If no specific error was expected, just having an error is success
          result.success = true;
        }
      }
    } catch (error) {
      // Validation threw an error as expected
      result.errorOccurred = true;
      result.actualError = error.message;
      
      // Check if the error matches the expected pattern
      if (this.expectedError) {
        const matches = this.checkErrorMatch(error.message, this.expectedError);
        result.success = matches;
      } else {
        // If no specific error was expected, just having an error is success
        result.success = true;
      }
      
      // Try recovery
      try {
        const recoveryResult = await this.recoveryHandler(error, { 
          invalidInput: this.invalidInput,
          testType: this.type
        });
        
        result.recoverySucceeded = recoveryResult.recovered;
        result.recoveryResult = recoveryResult;
      } catch (recoveryError) {
        result.recoverySucceeded = false;
        result.recoveryError = recoveryError.message;
      }
    }
    
    return result;
  }
  
  /**
   * Check if an error message matches the expected pattern
   * @param {string} actualError - Actual error message
   * @param {RegExp|string} expectedPattern - Expected error pattern
   * @returns {boolean} True if the error matches
   * @private
   */
  checkErrorMatch(actualError, expectedPattern) {
    if (expectedPattern instanceof RegExp) {
      return expectedPattern.test(actualError);
    } else if (typeof expectedPattern === 'string') {
      return actualError.includes(expectedPattern);
    }
    return false;
  }
}

/**
 * Cryptographic error test
 */
export class CryptographicErrorTest extends ErrorTest {
  /**
   * Create a new cryptographic error test
   * @param {Object} options - Test options
   * @param {string} options.name - Test name
   * @param {string} options.description - Test description
   * @param {Function} options.cryptoFunction - Cryptographic function to test
   * @param {any} options.invalidInput - Invalid input that should trigger a cryptographic error
   * @param {RegExp|string} [options.expectedError] - Expected error message or pattern
   */
  constructor(options) {
    super({
      name: options.name,
      type: ErrorType.CRYPTOGRAPHIC,
      description: options.description,
      severity: options.severity || ErrorSeverity.HIGH
    });
    
    this.cryptoFunction = options.cryptoFunction;
    this.invalidInput = options.invalidInput;
    this.expectedError = options.expectedError;
  }
  
  /**
   * Execute the cryptographic error test
   * @returns {Promise<ErrorTestResult>} Test result
   * @async
   */
  async execute() {
    const result = {
      success: false,
      name: this.name,
      type: this.type,
      description: this.description,
      expectedError: this.expectedError
    };
    
    try {
      // Execute the cryptographic function with invalid input
      await this.cryptoFunction(this.invalidInput);
      
      // If we reach here without an error, the function didn't detect the invalid input
      result.errorOccurred = false;
      result.actualError = 'No error occurred, but cryptographic function should have failed';
    } catch (error) {
      // Cryptographic function threw an error as expected
      result.errorOccurred = true;
      result.actualError = error.message;
      
      // Check if the error matches the expected pattern
      if (this.expectedError) {
        if (this.expectedError instanceof RegExp) {
          result.success = this.expectedError.test(error.message);
        } else if (typeof this.expectedError === 'string') {
          result.success = error.message.includes(this.expectedError);
        }
      } else {
        // If no specific error was expected, just having an error is success
        result.success = true;
      }
      
      // Try recovery
      try {
        const recoveryResult = await this.recoveryHandler(error, { 
          invalidInput: this.invalidInput,
          testType: this.type
        });
        
        result.recoverySucceeded = recoveryResult.recovered;
        result.recoveryResult = recoveryResult;
      } catch (recoveryError) {
        result.recoverySucceeded = false;
        result.recoveryError = recoveryError.message;
      }
    }
    
    return result;
  }
}

/**
 * Security error test
 */
export class SecurityErrorTest extends ErrorTest {
  /**
   * Create a new security error test
   * @param {Object} options - Test options
   * @param {string} options.name - Test name
   * @param {string} options.description - Test description
   * @param {Function} options.securityFunction - Security function to test
   * @param {any} options.maliciousInput - Malicious input that should trigger a security error
   * @param {RegExp|string} [options.expectedError] - Expected error message or pattern
   */
  constructor(options) {
    super({
      name: options.name,
      type: ErrorType.SECURITY,
      description: options.description,
      severity: options.severity || ErrorSeverity.CRITICAL
    });
    
    this.securityFunction = options.securityFunction;
    this.maliciousInput = options.maliciousInput;
    this.expectedError = options.expectedError;
  }
  
  /**
   * Execute the security error test
   * @returns {Promise<ErrorTestResult>} Test result
   * @async
   */
  async execute() {
    const result = {
      success: false,
      name: this.name,
      type: this.type,
      description: this.description,
      expectedError: this.expectedError
    };
    
    try {
      // Execute the security function with malicious input
      await this.securityFunction(this.maliciousInput);
      
      // If we reach here without an error, the security check failed
      result.errorOccurred = false;
      result.actualError = 'No error occurred, but security function should have detected attack';
    } catch (error) {
      // Security function threw an error as expected
      result.errorOccurred = true;
      result.actualError = error.message;
      
      // Check if the error matches the expected pattern
      if (this.expectedError) {
        if (this.expectedError instanceof RegExp) {
          result.success = this.expectedError.test(error.message);
        } else if (typeof this.expectedError === 'string') {
          result.success = error.message.includes(this.expectedError);
        }
      } else {
        // If no specific error was expected, just having an error is success
        result.success = true;
      }
      
      // For security errors, we also want to log the attack details
      result.attackDetails = {
        type: this.name,
        detectedAt: new Date().toISOString(),
        inputHash: crypto.createHash('sha256').update(JSON.stringify(this.maliciousInput)).digest('hex').substring(0, 16)
      };
      
      // Try recovery
      try {
        const recoveryResult = await this.recoveryHandler(error, { 
          maliciousInput: this.maliciousInput,
          testType: this.type,
          attackDetails: result.attackDetails
        });
        
        result.recoverySucceeded = recoveryResult.recovered;
        result.recoveryResult = recoveryResult;
      } catch (recoveryError) {
        result.recoverySucceeded = false;
        result.recoveryError = recoveryError.message;
      }
    }
    
    return result;
  }
}

/**
 * Resource error test
 */
export class ResourceErrorTest extends ErrorTest {
  /**
   * Create a new resource error test
   * @param {Object} options - Test options
   * @param {string} options.name - Test name
   * @param {string} options.description - Test description
   * @param {Function} options.resourceFunction - Resource-intensive function to test
   * @param {any} options.resourceInput - Input for resource-intensive operation
   * @param {Object} options.resourceLimits - Resource limits to enforce
   * @param {number} [options.resourceLimits.memoryMB] - Memory limit in MB
   * @param {number} [options.resourceLimits.timeoutMs] - Timeout in milliseconds
   */
  constructor(options) {
    super({
      name: options.name,
      type: ErrorType.RESOURCE,
      description: options.description,
      severity: options.severity || ErrorSeverity.MEDIUM
    });
    
    this.resourceFunction = options.resourceFunction;
    this.resourceInput = options.resourceInput;
    this.resourceLimits = options.resourceLimits || {};
  }
  
  /**
   * Execute the resource error test
   * @returns {Promise<ErrorTestResult>} Test result
   * @async
   */
  async execute() {
    const result = {
      success: false,
      name: this.name,
      type: this.type,
      description: this.description,
      resourceLimits: this.resourceLimits
    };
    
    const timeoutMs = this.resourceLimits.timeoutMs || 5000;
    let timeoutId;
    
    try {
      // Create a promise race between the resource function and a timeout
      const resourcePromise = this.resourceFunction(this.resourceInput);
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Resource function timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      
      // Race the promises
      await Promise.race([resourcePromise, timeoutPromise]);
      
      // If we get here, the resource function completed before timeout
      clearTimeout(timeoutId);
      
      // For resource tests, completing without hitting limits is a success
      result.success = true;
      result.errorOccurred = false;
      result.actualError = 'No resource limits exceeded';
    } catch (error) {
      // Clean up timeout if the resource function threw first
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Resource function threw an error or timed out
      result.errorOccurred = true;
      result.actualError = error.message;
      
      // For resource tests, getting an error might be the expected behavior
      // if we're testing that the system detects and handles resource limits
      if (error.message.includes('timed out') || 
          error.message.includes('memory limit') ||
          error.message.includes('resource')) {
        result.success = true;
      }
      
      // Try recovery
      try {
        const recoveryResult = await this.recoveryHandler(error, { 
          resourceInput: this.resourceInput,
          testType: this.type,
          resourceLimits: this.resourceLimits
        });
        
        result.recoverySucceeded = recoveryResult.recovered;
        result.recoveryResult = recoveryResult;
      } catch (recoveryError) {
        result.recoverySucceeded = false;
        result.recoveryError = recoveryError.message;
      }
    }
    
    return result;
  }
}

/**
 * Interoperability error test
 */
export class InteroperabilityErrorTest extends ErrorTest {
  /**
   * Create a new interoperability error test
   * @param {Object} options - Test options
   * @param {string} options.name - Test name
   * @param {string} options.description - Test description
   * @param {Function} options.sourceFunction - Source function to test
   * @param {Function} options.targetFunction - Target function that should interoperate
   * @param {any} options.testInput - Input for interoperability test
   */
  constructor(options) {
    super({
      name: options.name,
      type: ErrorType.INTEROPERABILITY,
      description: options.description,
      severity: options.severity || ErrorSeverity.MEDIUM
    });
    
    this.sourceFunction = options.sourceFunction;
    this.targetFunction = options.targetFunction;
    this.testInput = options.testInput;
  }
  
  /**
   * Execute the interoperability error test
   * @returns {Promise<ErrorTestResult>} Test result
   * @async
   */
  async execute() {
    const result = {
      success: false,
      name: this.name,
      type: this.type,
      description: this.description
    };
    
    try {
      // Execute the source function
      const sourceOutput = await this.sourceFunction(this.testInput);
      
      try {
        // Try to use the source output as input to the target function
        await this.targetFunction(sourceOutput);
        
        // If we reach here, interoperability succeeded
        result.success = true;
        result.errorOccurred = false;
        result.interoperable = true;
      } catch (targetError) {
        // Target function threw an error, interoperability failed
        result.errorOccurred = true;
        result.actualError = targetError.message;
        result.interoperable = false;
        
        // Try recovery
        try {
          const recoveryResult = await this.recoveryHandler(targetError, { 
            sourceOutput,
            testInput: this.testInput,
            testType: this.type
          });
          
          result.recoverySucceeded = recoveryResult.recovered;
          result.recoveryResult = recoveryResult;
          
          // If recovery succeeded, mark the test as successful
          if (recoveryResult.recovered) {
            result.success = true;
          }
        } catch (recoveryError) {
          result.recoverySucceeded = false;
          result.recoveryError = recoveryError.message;
        }
      }
    } catch (sourceError) {
      // Source function threw an error
      result.errorOccurred = true;
      result.actualError = sourceError.message;
      result.sourceFunction = 'failed';
      
      // This is an unexpected failure, so the test fails
      result.success = false;
    }
    
    return result;
  }
}

/**
 * Error testing suite for running multiple error tests
 */
export class ErrorTestSuite {
  /**
   * Create a new error test suite
   * @param {Object} options - Suite options
   * @param {string} options.name - Suite name
   * @param {string} options.description - Suite description
   */
  constructor(options) {
    this.name = options.name;
    this.description = options.description;
    this.tests = [];
    this.startTime = null;
    this.endTime = null;
  }
  
  /**
   * Add a test to the suite
   * @param {ErrorTest} test - Test to add
   */
  addTest(test) {
    this.tests.push(test);
  }
  
  /**
   * Add multiple tests to the suite
   * @param {ErrorTest[]} tests - Tests to add
   */
  addTests(tests) {
    this.tests.push(...tests);
  }
  
  /**
   * Run all tests in the suite
   * @returns {Object} Suite results
   * @async
   */
  async run() {
    this.startTime = Date.now();
    
    const results = {
      name: this.name,
      description: this.description,
      startTime: new Date(this.startTime).toISOString(),
      tests: [],
      summary: {
        total: this.tests.length,
        passed: 0,
        failed: 0,
        recoveryAttempted: 0,
        recoverySucceeded: 0
      }
    };
    
    for (const test of this.tests) {
      try {
        const testResult = await test.execute();
        results.tests.push(testResult);
        
        if (testResult.success) {
          results.summary.passed++;
        } else {
          results.summary.failed++;
        }
        
        if (testResult.recoverySucceeded !== undefined) {
          results.summary.recoveryAttempted++;
          if (testResult.recoverySucceeded) {
            results.summary.recoverySucceeded++;
          }
        }
      } catch (error) {
        results.tests.push({
          name: test.name,
          type: test.type,
          description: test.description,
          success: false,
          error: error.message,
          testExecutionFailed: true
        });
        
        results.summary.failed++;
      }
    }
    
    this.endTime = Date.now();
    results.endTime = new Date(this.endTime).toISOString();
    results.duration = this.endTime - this.startTime;
    
    results.summary.passRate = (results.summary.passed / results.summary.total) * 100;
    results.summary.recoveryRate = results.summary.recoveryAttempted > 0 
      ? (results.summary.recoverySucceeded / results.summary.recoveryAttempted) * 100
      : 0;
    
    return results;
  }
}

/**
 * Factory for creating different types of error tests
 */
export class ErrorTestFactory {
  /**
   * Create a validation error test
   * @param {Object} options - Test options
   * @returns {ValidationErrorTest} Validation error test
   */
  static createValidationTest(options) {
    return new ValidationErrorTest(options);
  }
  
  /**
   * Create a cryptographic error test
   * @param {Object} options - Test options
   * @returns {CryptographicErrorTest} Cryptographic error test
   */
  static createCryptographicTest(options) {
    return new CryptographicErrorTest(options);
  }
  
  /**
   * Create a security error test
   * @param {Object} options - Test options
   * @returns {SecurityErrorTest} Security error test
   */
  static createSecurityTest(options) {
    return new SecurityErrorTest(options);
  }
  
  /**
   * Create a resource error test
   * @param {Object} options - Test options
   * @returns {ResourceErrorTest} Resource error test
   */
  static createResourceTest(options) {
    return new ResourceErrorTest(options);
  }
  
  /**
   * Create an interoperability error test
   * @param {Object} options - Test options
   * @returns {InteroperabilityErrorTest} Interoperability error test
   */
  static createInteroperabilityTest(options) {
    return new InteroperabilityErrorTest(options);
  }
}

/**
 * Default export is the ErrorTestFactory
 */
export default ErrorTestFactory;