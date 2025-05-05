/**
 * E2EIntegrationTest.js
 * 
 * A comprehensive framework for end-to-end integration testing of the ZK infrastructure.
 * Provides a structured approach to testing complete flows from UI interaction to
 * contract verification, ensuring all components work together as expected.
 * 
 * This framework is designed to:
 * 1. Test full flows across the entire application stack
 * 2. Validate integration points between components
 * 3. Simulate realistic user scenarios
 * 4. Provide detailed reporting on integration issues
 */

import { zkErrorLogger } from '../zkErrorLogger.mjs';
import { createWallet } from '../TestWalletFactory.js';
import { ZKError, SystemError, InputError, ErrorCode } from '../zkErrorHandler.mjs';

/**
 * Represents a complete end-to-end integration test flow
 * @class
 */
class E2EIntegrationTest {
  /**
   * Create a new E2E integration test
   * @param {Object} config - Test configuration
   * @param {string} config.name - Test name
   * @param {string} config.description - Test description
   * @param {Function} config.setup - Setup function (returns test context)
   * @param {Function} config.teardown - Teardown function
   * @param {Object} config.components - Components to test
   * @param {Object} config.options - Additional test options
   */
  constructor({ name, description, setup, teardown, components, options = {} }) {
    this.name = name;
    this.description = description;
    this.setup = setup || (() => ({}));
    this.teardown = teardown || (() => {});
    this.components = components || {};
    this.options = {
      timeout: 30000, // 30 second default timeout
      retries: 1,
      parallel: false,
      ...options
    };
    
    this.steps = [];
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      startTime: null,
      endTime: null,
      duration: null
    };

    // Bind methods
    this.addStep = this.addStep.bind(this);
    this.run = this.run.bind(this);
    this._executeStep = this._executeStep.bind(this);
    this._validateComponents = this._validateComponents.bind(this);
  }

  /**
   * Add a test step to the flow
   * @param {string} name - Step name
   * @param {string} description - Step description
   * @param {Function} action - Step action function
   * @param {Function} validation - Validation function
   * @param {Object} options - Step options
   * @returns {E2EIntegrationTest} - Returns this for method chaining
   */
  addStep(name, description, action, validation, options = {}) {
    this.steps.push({
      name,
      description,
      action,
      validation,
      options: {
        timeout: this.options.timeout,
        retries: this.options.retries,
        ...options
      },
      status: 'pending',
      error: null,
      startTime: null,
      endTime: null,
      duration: null
    });
    
    return this;
  }

  /**
   * Run the integration test flow
   * @param {Object} initialContext - Initial test context
   * @returns {Promise<Object>} - Test results
   */
  async run(initialContext = {}) {
    this.results.startTime = Date.now();
    console.log(`\n🚀 Starting E2E integration test: ${this.name}`);
    console.log(`Description: ${this.description}`);
    
    let context;
    let setupError = null;
    
    try {
      // Validate components before starting
      this._validateComponents();
      
      // Run setup
      console.log(`\n📋 Setting up test environment...`);
      context = { ...initialContext, ...await this.setup() };
      console.log(`✅ Setup complete`);
    } catch (error) {
      setupError = error instanceof ZKError ? error : new SystemError(`Setup failed: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        category: 'E2E_INTEGRATION_TEST',
        operationId: `setup_${Date.now()}`,
        recoverable: false,
        details: { testName: this.name }
      });
      console.error(`❌ Setup failed: ${setupError.message}`);
      zkErrorLogger.logError(setupError);
    }
    
    // If setup failed, mark all steps as skipped and exit
    if (setupError) {
      this.steps.forEach(step => {
        step.status = 'skipped';
        this.results.skipped++;
      });
      
      this.results.endTime = Date.now();
      this.results.duration = this.results.endTime - this.results.startTime;
      
      return {
        success: false,
        error: setupError,
        results: this.results
      };
    }
    
    // Execute all steps
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const stepNumber = i + 1;
      
      console.log(`\n▶️ Step ${stepNumber}/${this.steps.length}: ${step.name}`);
      
      try {
        await this._executeStep(step, context);
        
        if (step.status === 'passed') {
          console.log(`✅ Step ${stepNumber} passed`);
          this.results.passed++;
        } else {
          console.error(`❌ Step ${stepNumber} failed: ${step.error?.message || 'Unknown error'}`);
          this.results.failed++;
          
          // If step is critical and fails, skip remaining steps
          if (step.options.critical) {
            console.error(`Critical step failed, skipping remaining steps`);
            for (let j = i + 1; j < this.steps.length; j++) {
              this.steps[j].status = 'skipped';
              this.results.skipped++;
            }
            break;
          }
        }
      } catch (error) {
        step.status = 'failed';
        step.error = error;
        this.results.failed++;
        console.error(`❌ Step ${stepNumber} failed with exception: ${error.message}`);
        
        // Convert to ZKError if not already and log
        const stepError = error instanceof ZKError ? error : new SystemError(`Step execution failed: ${error.message}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          category: 'E2E_INTEGRATION_TEST',
          operationId: `step_${stepNumber}_${Date.now()}`,
          recoverable: step.options.retries > 0,
          details: { 
            testName: this.name,
            stepName: step.name,
            stepNumber
          }
        });
        zkErrorLogger.logError(stepError);
        
        // If step is critical and fails, skip remaining steps
        if (step.options.critical) {
          console.error(`Critical step failed, skipping remaining steps`);
          for (let j = i + 1; j < this.steps.length; j++) {
            this.steps[j].status = 'skipped';
            this.results.skipped++;
          }
          break;
        }
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
        category: 'E2E_INTEGRATION_TEST',
        operationId: `teardown_${Date.now()}`,
        recoverable: true,
        details: { testName: this.name }
      });
      zkErrorLogger.logError(teardownError);
    }
    
    // Calculate test results
    this.results.endTime = Date.now();
    this.results.duration = this.results.endTime - this.results.startTime;
    
    const success = this.results.failed === 0;
    
    console.log(`\n📊 Test Results for: ${this.name}`);
    console.log(`Total Steps: ${this.steps.length}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);
    console.log(`Duration: ${this.results.duration}ms`);
    console.log(`Result: ${success ? '✅ PASSED' : '❌ FAILED'}`);
    
    return {
      success,
      results: this.results,
      steps: this.steps
    };
  }

  /**
   * Execute a single test step
   * @param {Object} step - Step object
   * @param {Object} context - Test context
   * @private
   */
  async _executeStep(step, context) {
    step.startTime = Date.now();
    let attempts = 0;
    let success = false;
    let lastError = null;
    
    while (attempts <= step.options.retries && !success) {
      attempts++;
      
      try {
        // Execute the step action
        console.log(attempts > 1 ? `Retry ${attempts-1}/${step.options.retries}` : '');
        const result = await Promise.race([
          step.action(context),
          new Promise((_, reject) => setTimeout(() => reject(new SystemError(`Step timed out after ${step.options.timeout}ms`, {
            code: ErrorCode.NETWORK_TIMEOUT,
            category: 'E2E_INTEGRATION_TEST',
            operationId: `step_timeout_${Date.now()}`,
            recoverable: step.options.retries > 0,
            details: { 
              testName: this.name,
              stepName: step.name,
              timeout: step.options.timeout
            }
          })), step.options.timeout))
        ]);
        
        // Execute validation
        if (step.validation) {
          await step.validation(result, context);
        }
        
        success = true;
      } catch (error) {
        lastError = error;
        console.error(`Step attempt ${attempts} failed: ${error.message}`);
        
        // Wait before retry
        if (attempts <= step.options.retries) {
          const delay = Math.min(1000 * attempts, 5000); // Exponential backoff with max 5s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    step.endTime = Date.now();
    step.duration = step.endTime - step.startTime;
    
    if (success) {
      step.status = 'passed';
    } else {
      step.status = 'failed';
      step.error = lastError;
    }
  }

  /**
   * Validate that required components exist
   * @private
   */
  _validateComponents() {
    const requiredComponents = ['zkUtils', 'zkProofGenerator'];
    
    for (const component of requiredComponents) {
      if (!this.components[component]) {
        throw new SystemError(`Required component missing: ${component}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          category: 'E2E_INTEGRATION_TEST',
          operationId: `validate_components_${Date.now()}`,
          recoverable: false,
          details: { 
            testName: this.name,
            requiredComponents,
            missingComponent: component
          }
        });
      }
    }
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
        <title>E2E Integration Test Report: ${this.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .summary { margin-bottom: 20px; }
          .passed { color: green; }
          .failed { color: red; }
          .skipped { color: orange; }
          .step { margin-bottom: 10px; border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
          .step-header { display: flex; justify-content: space-between; }
          .step-details { margin-top: 10px; }
          .error { background-color: #ffebee; padding: 10px; border-radius: 5px; }
          .success { background-color: #e8f5e9; }
          .metrics { margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>E2E Integration Test Report</h1>
        <div class="summary">
          <h2>${this.name}</h2>
          <p>${this.description}</p>
          <p><strong>Result:</strong> <span class="${success ? 'passed' : 'failed'}">${success ? 'PASSED' : 'FAILED'}</span></p>
          <p><strong>Duration:</strong> ${this.results.duration}ms</p>
          <p><strong>Steps:</strong> ${this.steps.length} total</p>
          <p><strong>Passed:</strong> <span class="passed">${this.results.passed}</span></p>
          <p><strong>Failed:</strong> <span class="failed">${this.results.failed}</span></p>
          <p><strong>Skipped:</strong> <span class="skipped">${this.results.skipped}</span></p>
        </div>
        
        <h2>Steps</h2>
    `;
    
    this.steps.forEach((step, index) => {
      const statusClass = step.status === 'passed' ? 'success' : '';
      
      html += `
        <div class="step ${statusClass}">
          <div class="step-header">
            <h3>Step ${index + 1}: ${step.name}</h3>
            <span class="${step.status}">${step.status.toUpperCase()}</span>
          </div>
          <p>${step.description}</p>
          <div class="step-details">
            <p><strong>Duration:</strong> ${step.duration}ms</p>
      `;
      
      if (step.error) {
        html += `
          <div class="error">
            <p><strong>Error:</strong> ${step.error.message}</p>
            <pre>${step.error.stack}</pre>
          </div>
        `;
      }
      
      html += `
          </div>
        </div>
      `;
    });
    
    html += `
        <div class="metrics">
          <h2>Performance Metrics</h2>
          <p><strong>Average Step Duration:</strong> ${Math.round(this.steps.reduce((sum, step) => sum + (step.duration || 0), 0) / this.steps.length)}ms</p>
          <p><strong>Slowest Step:</strong> ${this.steps.reduce((slowest, step) => (!step.duration || slowest.duration > step.duration) ? slowest : step, { name: 'None', duration: 0 }).name} (${this.steps.reduce((slowest, step) => (!step.duration || slowest.duration > step.duration) ? slowest : step, { duration: 0 }).duration}ms)</p>
        </div>
      </body>
      </html>
    `;
    
    return html;
  }
}

/**
 * Create a generic wallet proof flow test
 * @param {Object} options - Test options
 * @returns {E2EIntegrationTest} - Configured test
 */
function createWalletProofFlowTest(options = {}) {
  const {
    name = 'Wallet Proof Generation and Verification Flow',
    description = 'Tests the complete flow from wallet connection to proof generation and verification',
    components = {},
    proofType = 'standard',
    walletType = 'ethers'
  } = options;
  
  // Create test instance
  const test = new E2EIntegrationTest({
    name,
    description,
    components,
    setup: async () => {
      // Create test wallet
      const wallet = await createWallet(walletType);
      
      return {
        wallet,
        walletAddress: wallet.address,
        proofType,
        proofParams: {
          amount: '1000000000000000000', // 1 ETH
          tokenAddress: '0x0000000000000000000000000000000000000000',
          chainId: 1
        }
      };
    },
    teardown: async (context) => {
      // Clean up any resources
      if (context.wallet && typeof context.wallet.disconnect === 'function') {
        await context.wallet.disconnect();
      }
    }
  });
  
  // Add flow steps
  test.addStep(
    'Initialize wallet connection',
    'Connects to the wallet and retrieves the address',
    async (context) => {
      // Already have the wallet from setup
      return {
        connected: true,
        address: context.walletAddress
      };
    },
    (result, context) => {
      if (!result.connected) {
        throw new InputError('Failed to connect to wallet', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId: `wallet_connection_${Date.now()}`,
          recoverable: true,
          userFixable: true,
          details: { 
            step: 'Initialize wallet connection',
            expected: { connected: true },
            actual: result
          }
        });
      }
      if (!result.address) {
        throw new InputError('No wallet address returned', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId: `wallet_address_${Date.now()}`,
          recoverable: false,
          details: { 
            step: 'Initialize wallet connection',
            expected: { address: 'non-empty string' },
            actual: result
          }
        });
      }
      // Update context with the result
      context.walletAddress = result.address;
    },
    { critical: true }
  );
  
  test.addStep(
    'Prepare proof inputs',
    'Prepares the inputs required for generating a proof',
    async (context) => {
      const { zkUtils } = components;
      
      // Prepare inputs based on proof type
      const inputs = await zkUtils.prepareProofInputs({
        proofType: context.proofType,
        walletAddress: context.walletAddress,
        amount: context.proofParams.amount,
        tokenAddress: context.proofParams.tokenAddress,
        chainId: context.proofParams.chainId
      });
      
      return inputs;
    },
    (result, context) => {
      if (!result) {
        throw new InputError('Failed to prepare proof inputs', {
          code: ErrorCode.INPUT_VALIDATION_FAILED,
          operationId: `prepare_inputs_${Date.now()}`,
          recoverable: false,
          details: {
            step: 'Prepare proof inputs',
            expected: 'Valid proof inputs object',
            actual: result,
            proofType: context.proofType
          }
        });
      }
      // Store inputs in context
      context.proofInputs = result;
    },
    { critical: true }
  );
  
  test.addStep(
    'Generate proof',
    'Generates the ZK proof using the prepared inputs',
    async (context) => {
      const { zkProofGenerator } = components;
      
      const proof = await zkProofGenerator.generateProof(
        context.proofType,
        context.proofInputs
      );
      
      return proof;
    },
    (result, context) => {
      if (!result || !result.proof || !result.publicSignals) {
        throw new SystemError('Failed to generate proof', {
          code: ErrorCode.PROOF_GENERATION_FAILED,
          operationId: `generate_proof_${Date.now()}`,
          recoverable: true,
          details: {
            step: 'Generate proof',
            expected: { proof: 'object', publicSignals: 'array' },
            actual: result,
            proofType: context.proofType,
            inputsAvailable: !!context.proofInputs
          }
        });
      }
      // Store proof in context
      context.proof = result;
    },
    { critical: true, retries: 2 }
  );
  
  test.addStep(
    'Verify proof',
    'Verifies the generated proof',
    async (context) => {
      const { zkUtils } = components;
      
      const verified = await zkUtils.verifyProof(
        context.proofType,
        context.proof.proof,
        context.proof.publicSignals
      );
      
      return { verified };
    },
    (result, context) => {
      if (!result.verified) {
        throw new SystemError('Proof verification failed', {
          code: ErrorCode.VERIFICATION_FAILED,
          operationId: `verify_proof_${Date.now()}`,
          recoverable: false,
          securityCritical: true,
          details: {
            step: 'Verify proof',
            expected: { verified: true },
            actual: result,
            proofType: context.proofType,
            proofAvailable: !!context.proof
          }
        });
      }
    }
  );
  
  return test;
}

export { E2EIntegrationTest, createWalletProofFlowTest };
export default E2EIntegrationTest;