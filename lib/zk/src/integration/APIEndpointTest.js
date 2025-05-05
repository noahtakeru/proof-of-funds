/**
 * APIEndpointTest.js
 * 
 * A specialized testing framework for validating API endpoints and their interactions
 * with the ZK infrastructure. This framework focuses on ensuring that API endpoints
 * correctly handle requests, process ZK operations, and return appropriate responses.
 * 
 * This framework is designed to:
 * 1. Test API endpoint functionality
 * 2. Validate request/response handling
 * 3. Verify error handling in API contexts
 * 4. Test endpoint integration with ZK components
 */

import { zkErrorLogger } from '../zkErrorLogger.mjs';
import {
  ZKError,
  SystemError,
  InputError,
  NetworkError,
  SecurityError,
  ErrorCode
} from '../zkErrorHandler.mjs';

/**
 * Represents an API endpoint test
 * @class
 */
class APIEndpointTest {
  /**
   * Create a new API endpoint test
   * @param {Object} config - Test configuration
   * @param {string} config.name - Test name
   * @param {string} config.description - Test description
   * @param {Object} config.endpoints - Map of endpoint names to implementations
   * @param {Object} config.components - ZK components to use for testing
   * @param {Function} config.setup - Setup function to prepare test environment
   * @param {Function} config.teardown - Teardown function to clean up after tests
   */
  constructor({ name, description, endpoints = {}, components = {}, setup, teardown }) {
    this.name = name;
    this.description = description;
    this.endpoints = endpoints;
    this.components = components;
    this.setup = setup || (() => ({}));
    this.teardown = teardown || (() => { });
    this.tests = [];

    // Results tracking
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      testResults: []
    };
  }

  /**
   * Add an API endpoint test case
   * @param {Object} testCase - The test case to add
   * @param {string} testCase.endpoint - Endpoint name to test
   * @param {string} testCase.method - HTTP method (GET, POST, etc.)
   * @param {Object} testCase.request - Request data
   * @param {Function} testCase.test - Test function
   * @param {Object|Function} testCase.expected - Expected result or validator
   * @param {string} testCase.description - Test description
   * @returns {APIEndpointTest} - Returns this for method chaining
   */
  addTest(testCase) {
    this.tests.push({
      ...testCase,
      id: `${testCase.endpoint}:${testCase.method}:${this.tests.length}`,
      status: 'pending'
    });

    return this;
  }

  /**
   * Add multiple test cases at once
   * @param {Array} testCases - Array of test cases
   * @returns {APIEndpointTest} - Returns this for method chaining
   */
  addTests(testCases) {
    testCases.forEach(testCase => this.addTest(testCase));
    return this;
  }

  /**
   * Run all API endpoint tests
   * @returns {Promise<Object>} - Test results
   */
  async run() {
    console.log(`\n🌐 Starting API endpoint test: ${this.name}`);
    console.log(`Description: ${this.description}`);

    let context;
    try {
      // Setup test environment
      console.log('\n📋 Setting up test environment...');
      context = await this.setup();
      console.log('✅ Setup complete');
    } catch (error) {
      console.error(`❌ Setup failed: ${error.message}`);
      const setupError = error instanceof SystemError ? error : new SystemError(`Setup failed: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        category: 'API_ENDPOINT_TEST',
        operationId: `setup_${Date.now()}`,
        recoverable: false,
        details: { testName: this.name }
      });
      zkErrorLogger.logError(setupError);

      // Mark all tests as skipped
      this.tests.forEach(test => {
        test.status = 'skipped';
        this.results.skipped++;
      });

      return {
        success: false,
        error,
        results: this.results
      };
    }

    // Execute all test cases
    for (let i = 0; i < this.tests.length; i++) {
      const test = this.tests[i];

      console.log(`\n▶️ Test ${i + 1}/${this.tests.length}: ${test.endpoint} (${test.method})`);
      console.log(`Description: ${test.description || 'No description'}`);

      // Skip if endpoint doesn't exist
      if (!this.endpoints[test.endpoint]) {
        console.log(`⏩ Skipping test: Endpoint ${test.endpoint} not found`);
        test.status = 'skipped';
        test.error = new InputError(`Endpoint ${test.endpoint} not found`, {
          code: ErrorCode.INPUT_RESOURCE_NOT_FOUND,
          operationId: `endpoint_check_${test.id}_${Date.now()}`,
          recoverable: false,
          details: {
            endpoint: test.endpoint,
            availableEndpoints: Object.keys(this.endpoints)
          }
        });
        this.results.skipped++;
        zkErrorLogger.logError(test.error);
        continue;
      }

      try {
        // Get endpoint implementation
        const endpoint = this.endpoints[test.endpoint];

        // Create mock request/response objects
        const req = this._createMockRequest(test.method, test.request);
        const res = this._createMockResponse();

        // Add context to request
        req._testContext = context;

        // Execute test function
        const result = await test.test({
          endpoint,
          req,
          res,
          components: this.components,
          context
        });

        // Extract response from mock
        const response = res._getData();

        // Get combined result (may include response and other test data)
        const combinedResult = {
          ...result,
          response
        };

        // Validate result against expectations
        const validationResult = this._validateResult(combinedResult, test.expected);

        if (validationResult.valid) {
          test.status = 'passed';
          test.result = combinedResult;
          this.results.passed++;
          console.log(`✅ Test passed`);
        } else {
          test.status = 'failed';
          test.result = combinedResult;
          test.error = new InputError(`Validation failed: ${validationResult.reason}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId: `validation_${test.id}_${Date.now()}`,
            recoverable: true,
            userFixable: true,
            details: {
              testName: this.name,
              testId: test.id,
              expected: test.expected,
              actual: combinedResult
            }
          });
          this.results.failed++;
          console.error(`❌ Test failed: ${validationResult.reason}`);

          // Log error
          zkErrorLogger.logError(test.error);
        }

        // Store test result
        this.results.testResults.push({
          test: test.id,
          status: test.status,
          result: combinedResult,
          error: test.error
        });
      } catch (error) {
        test.status = 'failed';
        test.error = error;
        this.results.failed++;
        console.error(`❌ Test failed with exception: ${error.message}`);

        // Log error
        const executionError = error instanceof ZKError ? error : new SystemError(`Test execution failed: ${error.message}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          operationId: `execution_${test.id}_${Date.now()}`,
          recoverable: false,
          details: {
            testName: this.name,
            testId: test.id,
            originalError: error.message
          }
        });
        zkErrorLogger.logError(executionError);

        // Store test result
        this.results.testResults.push({
          test: test.id,
          status: test.status,
          error: error
        });
      }
    }

    // Run teardown
    try {
      console.log(`\n📋 Tearing down test environment...`);
      await this.teardown(context);
      console.log(`✅ Teardown complete`);
    } catch (error) {
      console.error(`❌ Teardown failed: ${error.message}`);
      const teardownError = error instanceof ZKError ? error : new SystemError(`Teardown failed: ${error.message}`, {
        code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
        operationId: `teardown_${Date.now()}`,
        recoverable: true,
        details: { testName: this.name }
      });
      zkErrorLogger.logError(teardownError);
    }

    // Calculate success
    const success = this.results.failed === 0;

    // Print summary
    console.log(`\n📊 Test Results: ${this.results.passed} passed, ${this.results.failed} failed, ${this.results.skipped} skipped`);

    return {
      success,
      results: this.results
    };
  }

  /**
   * Create a mock request object
   * @private
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @returns {Object} - Mock request object
   */
  _createMockRequest(method, data = {}) {
    return {
      method,
      body: method !== 'GET' ? { ...data } : undefined,
      query: method === 'GET' ? { ...data } : {},
      params: {},
      headers: {},
      cookies: {},
      get: (header) => this.headers[header],
      _getData: () => method === 'GET' ? { ...data } : { ...data }
    };
  }

  /**
   * Create a mock response object
   * @private
   * @returns {Object} - Mock response object
   */
  _createMockResponse() {
    const res = {
      statusCode: 200,
      headers: {},
      cookies: {},
      body: null,

      status: function (code) {
        this.statusCode = code;
        return this;
      },

      json: function (data) {
        this.body = data;
        return this;
      },

      send: function (data) {
        this.body = data;
        return this;
      },

      setHeader: function (name, value) {
        this.headers[name] = value;
        return this;
      },

      cookie: function (name, value, options) {
        this.cookies[name] = { value, options };
        return this;
      },

      _getData: function () {
        return {
          statusCode: this.statusCode,
          headers: this.headers,
          cookies: this.cookies,
          body: this.body
        };
      }
    };

    return res;
  }

  /**
   * Validate a test result against expectations
   * @private
   * @param {Object} result - Test result
   * @param {Object|Function} expected - Expected result or validator function
   * @returns {Object} - Validation result with valid and reason properties
   */
  _validateResult(result, expected) {
    // If expected is a function, use it as a validator
    if (typeof expected === 'function') {
      try {
        const validationResult = expected(result);

        // If validator returns boolean, convert to standard format
        if (typeof validationResult === 'boolean') {
          return {
            valid: validationResult,
            reason: validationResult ? null : 'Validator function returned false'
          };
        }

        // If validator returns object with valid property, use it
        if (validationResult && typeof validationResult === 'object' && 'valid' in validationResult) {
          return {
            valid: Boolean(validationResult.valid),
            reason: validationResult.reason || null
          };
        }

        // Default to true if validator doesn't return boolean or standard format
        return {
          valid: true,
          reason: null
        };
      } catch (error) {
        // If validator throws, validation failed
        return {
          valid: false,
          reason: `Validator function threw error: ${error.message}`
        };
      }
    }

    // If expected is null or undefined, any result is valid
    if (expected == null) {
      return {
        valid: true,
        reason: null
      };
    }

    // If expected is an object, check if result matches
    if (typeof expected === 'object') {
      try {
        // Check status code if specified
        if (expected.statusCode && result.response?.statusCode !== expected.statusCode) {
          return {
            valid: false,
            reason: `Status code mismatch. Expected ${expected.statusCode}, got ${result.response?.statusCode}`
          };
        }

        // Check body if specified
        if (expected.body) {
          const bodyValid = this._deepCompare(result.response?.body, expected.body);
          if (!bodyValid) {
            return {
              valid: false,
              reason: `Response body mismatch. Expected ${JSON.stringify(expected.body)}, got ${JSON.stringify(result.response?.body)}`
            };
          }
        }

        // Check headers if specified
        if (expected.headers) {
          for (const [key, value] of Object.entries(expected.headers)) {
            if (result.response?.headers[key] !== value) {
              return {
                valid: false,
                reason: `Header "${key}" mismatch. Expected "${value}", got "${result.response?.headers[key]}"`
              };
            }
          }
        }

        // Check custom fields
        for (const [key, value] of Object.entries(expected)) {
          if (key !== 'statusCode' && key !== 'body' && key !== 'headers') {
            const fieldValid = this._deepCompare(result[key], value);
            if (!fieldValid) {
              return {
                valid: false,
                reason: `Field "${key}" mismatch. Expected ${JSON.stringify(value)}, got ${JSON.stringify(result[key])}`
              };
            }
          }
        }

        // All checks passed
        return {
          valid: true,
          reason: null
        };
      } catch (error) {
        // If comparison throws, validation failed
        const validationError = new InputError(`Validation comparison failed: ${error.message}`, {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId: `validation_comparison_${Date.now()}`,
          recoverable: false,
          details: { expected, result }
        });
        zkErrorLogger.logError(validationError);

        return {
          valid: false,
          reason: `Validation comparison failed: ${error.message}`
        };
      }
    }

    // If expected is a primitive, compare directly with result
    return {
      valid: result === expected,
      reason: result === expected ? null : `Result mismatch. Expected ${expected}, got ${result}`
    };
  }

  /**
   * Deep compare two values for equality
   * @private
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} - Whether values are equal
   */
  _deepCompare(a, b) {
    // If a and b are strictly equal, return true
    if (a === b) return true;

    // If either a or b is null or undefined, but not both, return false
    if (a == null || b == null) return false;

    // If a and b are different types, return false
    if (typeof a !== typeof b) return false;

    // If a and b are objects, compare all keys
    if (typeof a === 'object') {
      // Get all keys from both objects
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      // If different number of keys, not equal
      if (keysA.length !== keysB.length) return false;

      // Check each key in a exists in b with same value
      for (const key of keysA) {
        if (!this._deepCompare(a[key], b[key])) return false;
      }

      // All keys checked and equal
      return true;
    }

    // If a and b are primitives and not strictly equal, return false
    return false;
  }

  /**
   * Generate an HTML report of test results
   * @returns {string} - HTML report
   */
  generateHTMLReport() {
    // HTML template
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API Endpoint Test Report - ${this.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
          h1 { color: #2c3e50; }
          .summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .summary h2 { margin-top: 0; }
          .stats { display: flex; gap: 20px; }
          .stat { padding: 10px; border-radius: 5px; }
          .passed { background-color: #d4edda; }
          .failed { background-color: #f8d7da; }
          .skipped { background-color: #fff3cd; }
          .test { margin-bottom: 15px; padding: 15px; border-radius: 5px; }
          .test h3 { margin-top: 0; }
          .test-passed { border-left: 5px solid #28a745; background-color: #f8fffa; }
          .test-failed { border-left: 5px solid #dc3545; background-color: #fff8f8; }
          .test-skipped { border-left: 5px solid #ffc107; background-color: #fffdf8; }
          .endpoint { font-weight: bold; }
          .method { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 0.85em; }
          .get { background-color: #e7f5ff; color: #0069d9; }
          .post { background-color: #ebfbee; color: #28a745; }
          .put { background-color: #fff9eb; color: #f5a623; }
          .delete { background-color: #feebeb; color: #dc3545; }
          .error { background-color: #f8d7da; padding: 10px; border-radius: 5px; margin-top: 10px; white-space: pre-wrap; }
          pre { background-color: #f8f9fa; padding: 10px; border-radius: 5px; overflow: auto; max-height: 300px; }
          code { font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>API Endpoint Test Report</h1>
        <div class="summary">
          <h2>${this.name}</h2>
          <p>${this.description}</p>
          <div class="stats">
            <div class="stat passed">Passed: ${this.results.passed}</div>
            <div class="stat failed">Failed: ${this.results.failed}</div>
            <div class="stat skipped">Skipped: ${this.results.skipped}</div>
          </div>
        </div>
        <h2>Test Results</h2>
    `;

    // Add each test result
    for (const result of this.results.testResults) {
      const test = this.tests.find(t => t.id === result.test);

      html += `
        <div class="test test-${result.status}">
          <h3>
            <span class="endpoint">${test.endpoint}</span>
            <span class="method ${test.method.toLowerCase()}">${test.method}</span>
          </h3>
          <p>${test.description || 'No description'}</p>
          <p><strong>Status:</strong> ${result.status}</p>
      `;

      // Add error if any
      if (result.error) {
        html += `
          <div class="error">
            <strong>Error:</strong> ${result.error.message}
            ${result.error.stack ? `<pre><code>${result.error.stack}</code></pre>` : ''}
          </div>
        `;
      }

      // Add result details if any
      if (result.result) {
        html += `
          <div>
            <strong>Result:</strong>
            <pre><code>${JSON.stringify(result.result, null, 2)}</code></pre>
          </div>
        `;
      }

      html += `</div>`;
    }

    // Close HTML
    html += `
      </body>
      </html>
    `;

    return html;
  }
}

/**
 * Create an API endpoint test for ZK proof validation
 * @param {Object} options - Test options
 * @returns {APIEndpointTest} - Configured API endpoint test
 */
function createZKProofEndpointTest(options = {}) {
  try {
    // Default options
    const defaultOptions = {
      name: 'ZK Proof API Endpoint Test',
      description: 'Test API endpoints for ZK proof generation and validation',
      endpoints: {},
      components: {},
      setup: async () => ({}),
      teardown: async () => { }
    };

    // Merge options
    const mergedOptions = { ...defaultOptions, ...options };

    // Create and return test
    return new APIEndpointTest(mergedOptions);
  } catch (error) {
    // Create proper error
    const initError = error instanceof ZKError ? error : new SystemError(`Failed to create ZK proof endpoint test: ${error.message}`, {
      code: ErrorCode.SYSTEM_NOT_INITIALIZED,
      operationId: `create_zk_proof_endpoint_test_${Date.now()}`,
      recoverable: false,
      details: { options }
    });

    // Log error
    zkErrorLogger.logError(initError);

    // Rethrow error
    throw initError;
  }
}

// Export the test class and factory function
export { APIEndpointTest, createZKProofEndpointTest };