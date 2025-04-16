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
    this.teardown = teardown || (() => {});
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
      zkErrorLogger.logError(error, {
        category: 'API_ENDPOINT_TEST',
        code: 'SETUP_FAILURE',
        details: { testName: this.name }
      });
      
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
        test.error = new Error(`Endpoint ${test.endpoint} not found`);
        this.results.skipped++;
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
          test.error = new Error(`Validation failed: ${validationResult.reason}`);
          this.results.failed++;
          console.error(`❌ Test failed: ${validationResult.reason}`);
          
          // Log error
          zkErrorLogger.logError(test.error, {
            category: 'API_ENDPOINT_TEST',
            code: 'TEST_VALIDATION_FAILURE',
            details: {
              testName: this.name,
              testId: test.id,
              expected: test.expected,
              actual: combinedResult
            }
          });
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
        zkErrorLogger.logError(error, {
          category: 'API_ENDPOINT_TEST',
          code: 'TEST_EXECUTION_FAILURE',
          details: {
            testName: this.name,
            testId: test.id
          }
        });
        
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
      zkErrorLogger.logError(error, {
        category: 'API_ENDPOINT_TEST',
        code: 'TEARDOWN_FAILURE',
        details: { testName: this.name }
      });
    }
    
    // Calculate success
    const success = this.results.failed === 0;
    
    // Print summary
    console.log(`\n📊 Test Results for: ${this.name}`);
    console.log(`Total Tests: ${this.tests.length}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);
    console.log(`Result: ${success ? '✅ PASSED' : '❌ FAILED'}`);
    
    return {
      success,
      results: this.results,
      tests: this.tests
    };
  }

  /**
   * Creates a mock request object
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @returns {Object} Mock request
   * @private
   */
  _createMockRequest(method, data = {}) {
    const req = {
      method,
      body: method === 'GET' ? {} : { ...data },
      query: method === 'GET' ? { ...data } : {},
      params: {},
      headers: {
        'content-type': 'application/json'
      },
      get: function(header) {
        return this.headers[header.toLowerCase()];
      }
    };
    
    return req;
  }

  /**
   * Creates a mock response object
   * @returns {Object} Mock response
   * @private
   */
  _createMockResponse() {
    let statusCode = 200;
    let responseData = null;
    let responseHeaders = {
      'content-type': 'application/json'
    };
    
    return {
      status: function(code) {
        statusCode = code;
        return this;
      },
      json: function(data) {
        responseData = data;
        return this;
      },
      send: function(data) {
        responseData = data;
        return this;
      },
      setHeader: function(name, value) {
        responseHeaders[name.toLowerCase()] = value;
        return this;
      },
      end: function() {
        return this;
      },
      // Helper methods for tests
      _getStatus: function() {
        return statusCode;
      },
      _getData: function() {
        return responseData;
      },
      _getHeaders: function() {
        return responseHeaders;
      }
    };
  }

  /**
   * Validates a result against expected values
   * @param {*} result - The actual result
   * @param {*} expected - The expected result or validator function
   * @returns {Object} Validation result
   * @private
   */
  _validateResult(result, expected) {
    // If expected is a function, use it as a validator
    if (typeof expected === 'function') {
      try {
        const valid = expected(result);
        return {
          valid: Boolean(valid),
          reason: valid === true ? null : 'Validation function returned false'
        };
      } catch (error) {
        return {
          valid: false,
          reason: `Validation function threw error: ${error.message}`
        };
      }
    }
    
    // If expected is null, any result is valid
    if (expected === null) {
      return { valid: true };
    }
    
    // Handle different types of expected values
    if (Array.isArray(expected)) {
      if (!Array.isArray(result)) {
        return {
          valid: false,
          reason: 'Expected an array but got ' + typeof result
        };
      }
      
      if (expected.length > 0 && result.length !== expected.length) {
        return {
          valid: false,
          reason: `Expected array length ${expected.length} but got ${result.length}`
        };
      }
      
      // Compare array items if expected has items
      if (expected.length > 0) {
        for (let i = 0; i < expected.length; i++) {
          const itemValidation = this._validateResult(result[i], expected[i]);
          if (!itemValidation.valid) {
            return {
              valid: false,
              reason: `Array item ${i}: ${itemValidation.reason}`
            };
          }
        }
      }
      
      return { valid: true };
    }
    
    if (expected && typeof expected === 'object') {
      if (!result || typeof result !== 'object') {
        return {
          valid: false,
          reason: 'Expected an object but got ' + typeof result
        };
      }
      
      // Check each expected property
      for (const key of Object.keys(expected)) {
        if (!(key in result)) {
          return {
            valid: false,
            reason: `Missing expected property: ${key}`
          };
        }
        
        const propValidation = this._validateResult(result[key], expected[key]);
        if (!propValidation.valid) {
          return {
            valid: false,
            reason: `Property ${key}: ${propValidation.reason}`
          };
        }
      }
      
      return { valid: true };
    }
    
    // For primitive values, use strict equality
    if (result !== expected) {
      return {
        valid: false,
        reason: `Expected ${expected} but got ${result}`
      };
    }
    
    return { valid: true };
  }

  /**
   * Generate a detailed HTML report
   * @returns {string} HTML report
   */
  generateHTMLReport() {
    const success = this.results.failed === 0;
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>API Endpoint Test Report: ${this.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .summary { margin-bottom: 20px; }
          .passed { color: green; }
          .failed { color: red; }
          .skipped { color: orange; }
          .test { margin-bottom: 10px; border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
          .test-header { display: flex; justify-content: space-between; }
          .test-details { margin-top: 10px; }
          .error { background-color: #ffebee; padding: 10px; border-radius: 5px; }
          .success { background-color: #e8f5e9; }
          .request { background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin-top: 10px; }
          .response { background-color: #f3f3f3; padding: 10px; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <h1>API Endpoint Test Report</h1>
        <div class="summary">
          <h2>${this.name}</h2>
          <p>${this.description}</p>
          <p><strong>Result:</strong> <span class="${success ? 'passed' : 'failed'}">${success ? 'PASSED' : 'FAILED'}</span></p>
          <p><strong>Tests:</strong> ${this.tests.length} total</p>
          <p><strong>Passed:</strong> <span class="passed">${this.results.passed}</span></p>
          <p><strong>Failed:</strong> <span class="failed">${this.results.failed}</span></p>
          <p><strong>Skipped:</strong> <span class="skipped">${this.results.skipped}</span></p>
        </div>
        
        <h2>Tests</h2>
    `;
    
    this.tests.forEach((test, index) => {
      const statusClass = test.status === 'passed' ? 'success' : '';
      
      html += `
        <div class="test ${statusClass}">
          <div class="test-header">
            <h3>Test ${index + 1}: ${test.endpoint} (${test.method})</h3>
            <span class="${test.status}">${test.status.toUpperCase()}</span>
          </div>
          <p>${test.description || 'No description'}</p>
          <div class="test-details">
            <div class="request">
              <h4>Request</h4>
              <pre>${JSON.stringify(test.request, null, 2)}</pre>
            </div>
      `;
      
      if (test.result && test.result.response) {
        html += `
          <div class="response">
            <h4>Response</h4>
            <pre>${JSON.stringify(test.result.response, null, 2)}</pre>
          </div>
        `;
      }
      
      if (test.error) {
        html += `
          <div class="error">
            <h4>Error</h4>
            <p>${test.error.message}</p>
            <pre>${test.error.stack}</pre>
          </div>
        `;
      }
      
      html += `
          </div>
        </div>
      `;
    });
    
    html += `
      </body>
      </html>
    `;
    
    return html;
  }
}

/**
 * Creates a test for ZK proof API endpoints
 * @param {Object} options - Test options
 * @returns {APIEndpointTest} - Configured test
 */
function createZKProofEndpointTest(options = {}) {
  const {
    name = 'ZK Proof API Endpoints',
    description = 'Tests ZK proof generation and verification endpoints',
    endpoints = {},
    components = {}
  } = options;
  
  // Create test instance
  const test = new APIEndpointTest({
    name,
    description,
    endpoints,
    components,
    setup: async () => {
      // Prepare test data
      return {
        testProofInputs: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          amount: '1000000000000000000', // 1 ETH
          tokenAddress: '0x0000000000000000000000000000000000000000',
          chainId: 1,
          nonce: Date.now().toString()
        }
      };
    }
  });
  
  // Add test cases if endpoints exist
  if (endpoints.generate || endpoints.fullProve) {
    const generateEndpoint = endpoints.generate || endpoints.fullProve;
    
    test.addTest({
      endpoint: generateEndpoint === endpoints.generate ? 'generate' : 'fullProve',
      method: 'POST',
      description: 'Generate ZK proof with valid inputs',
      request: {
        proofType: 'standard',
        inputs: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          amount: '1000000000000000000',
          tokenAddress: '0x0000000000000000000000000000000000000000',
          chainId: 1
        }
      },
      test: async ({ endpoint, req, res }) => {
        // Call the endpoint handler
        await endpoint(req, res);
        return {};
      },
      expected: result => {
        const response = result.response;
        return response && 
               response.success === true && 
               response.proof && 
               response.publicSignals;
      }
    });
    
    test.addTest({
      endpoint: generateEndpoint === endpoints.generate ? 'generate' : 'fullProve',
      method: 'POST',
      description: 'Handle invalid proof type',
      request: {
        proofType: 'invalid',
        inputs: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          amount: '1000000000000000000',
          tokenAddress: '0x0000000000000000000000000000000000000000',
          chainId: 1
        }
      },
      test: async ({ endpoint, req, res }) => {
        // Call the endpoint handler
        await endpoint(req, res);
        return {};
      },
      expected: result => {
        const response = result.response;
        const status = result.response._status || 400;
        return response && 
               response.success === false && 
               status >= 400;
      }
    });
    
    test.addTest({
      endpoint: generateEndpoint === endpoints.generate ? 'generate' : 'fullProve',
      method: 'POST',
      description: 'Handle missing inputs',
      request: {
        proofType: 'standard'
      },
      test: async ({ endpoint, req, res }) => {
        // Call the endpoint handler
        await endpoint(req, res);
        return {};
      },
      expected: result => {
        const response = result.response;
        const status = result.response._status || 400;
        return response && 
               response.success === false && 
               status >= 400;
      }
    });
  }
  
  if (endpoints.verify) {
    // First need to generate a proof to verify
    test.addTest({
      endpoint: 'verify',
      method: 'POST',
      description: 'Verify valid proof',
      request: {
        proofType: 'standard',
        proof: null, // Will be populated in test function
        publicSignals: null // Will be populated in test function
      },
      test: async ({ endpoint, req, res, components, context }) => {
        // Generate a proof using the zkProofGenerator component
        if (!components.zkProofGenerator) {
          throw new Error('zkProofGenerator component is required for this test');
        }
        
        const { zkProofGenerator, zkUtils } = components;
        
        // Prepare inputs
        const inputs = await zkUtils.prepareProofInputs({
          proofType: 'standard',
          ...context.testProofInputs
        });
        
        // Generate proof
        const { proof, publicSignals } = await zkProofGenerator.generateProof('standard', inputs);
        
        // Update request with the generated proof
        req.body.proof = proof;
        req.body.publicSignals = publicSignals;
        
        // Call the endpoint handler
        await endpoint(req, res);
        
        return { originalProof: { proof, publicSignals } };
      },
      expected: result => {
        const response = result.response;
        return response && 
               response.success === true && 
               response.verified === true;
      }
    });
    
    test.addTest({
      endpoint: 'verify',
      method: 'POST',
      description: 'Reject invalid proof',
      request: {
        proofType: 'standard',
        proof: {
          pi_a: ['0', '0', '1'],
          pi_b: [['0', '0'], ['0', '0']],
          pi_c: ['0', '0', '1'],
          protocol: 'groth16'
        },
        publicSignals: ['0', '0', '0', '0']
      },
      test: async ({ endpoint, req, res }) => {
        // Call the endpoint handler
        await endpoint(req, res);
        return {};
      },
      expected: result => {
        const response = result.response;
        return response && 
               (response.success === false || response.verified === false);
      }
    });
  }
  
  return test;
}

export { APIEndpointTest, createZKProofEndpointTest };
export default APIEndpointTest;