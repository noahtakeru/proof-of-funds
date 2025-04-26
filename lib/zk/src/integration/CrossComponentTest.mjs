/**
 * CrossComponentTest.js
 * 
 * A specialized testing framework for validating interactions between different
 * components of the ZK infrastructure. This framework focuses on ensuring 
 * that components work properly together, with emphasis on API compatibility,
 * data flow, and error propagation.
 * 
 * This framework is designed to:
 * 1. Validate integration points between modules
 * 2. Test data flow between components
 * 3. Verify correct error propagation across boundaries
 * 4. Ensure component dependency handling
 */

import { zkErrorLogger } from '../zkErrorLogger.mjs';
import { ZKError, SystemError, InputError, ErrorCode } from '../zkErrorHandler.mjs';

/**
 * Represents a component interaction to test
 * @typedef {Object} ComponentInteraction
 * @property {string} fromComponent - Name of the source component
 * @property {string} toComponent - Name of the target component
 * @property {string} interaction - Type of interaction 
 * @property {Function} testFunction - Function to test the interaction
 * @property {Object} expected - Expected results
 */

/**
 * Cross-component testing framework
 * @class
 */
class CrossComponentTest {
  /**
   * Create a new cross-component test
   * @param {Object} config - Test configuration
   * @param {string} config.name - Test name
   * @param {string} config.description - Test description
   * @param {Object} config.components - Components to test
   * @param {Function} config.setup - Setup function
   * @param {Function} config.teardown - Teardown function
   */
  constructor({ name, description, components = {}, setup = () => ({}), teardown = () => { } }) {
    this.name = name;
    this.description = description;
    this.components = components;
    this.setup = setup;
    this.teardown = teardown;
    this.interactions = [];
    this.dependencies = this._buildDependencyGraph();

    // Results tracking
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      interactionResults: []
    };
  }

  /**
   * Add a component interaction to test
   * @param {ComponentInteraction} interaction - The interaction to test
   * @returns {CrossComponentTest} - Returns this for method chaining
   */
  addInteraction(interaction) {
    this.interactions.push({
      ...interaction,
      id: `${interaction.fromComponent}->${interaction.toComponent}:${interaction.interaction}`,
      status: 'pending'
    });

    // Update dependency graph
    this.dependencies = this._buildDependencyGraph();

    return this;
  }

  /**
   * Add multiple interactions at once
   * @param {ComponentInteraction[]} interactions - Array of interactions
   * @returns {CrossComponentTest} - Returns this for method chaining
   */
  addInteractions(interactions) {
    interactions.forEach(interaction => this.addInteraction(interaction));
    return this;
  }

  /**
   * Run all component interaction tests
   * @returns {Promise<Object>} - Test results
   */
  async run() {
    console.log(`\n🔄 Starting cross-component test: ${this.name}`);
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
        operationId: `setup_${Date.now()}`,
        recoverable: false,
        details: { testName: this.name }
      });
      zkErrorLogger.logError(setupError);

      // Mark all interactions as skipped
      this.interactions.forEach(interaction => {
        interaction.status = 'skipped';
        this.results.skipped++;
      });

      return {
        success: false,
        error,
        results: this.results
      };
    }

    // Get optimal execution order to respect dependencies
    const executionOrder = this._getExecutionOrder();
    console.log(`\n🔄 Executing ${this.interactions.length} interactions in dependency order\n`);

    // Execute interactions in order
    for (const interactionId of executionOrder) {
      const interaction = this.interactions.find(i => i.id === interactionId);
      if (!interaction) continue;

      console.log(`▶️ Testing interaction: ${interaction.fromComponent} → ${interaction.toComponent} (${interaction.interaction})`);

      try {
        // Get components
        const fromComponent = this.components[interaction.fromComponent];
        const toComponent = this.components[interaction.toComponent];

        if (!fromComponent) {
          throw new InputError(`Source component not found: ${interaction.fromComponent}`, {
            code: ErrorCode.INPUT_RESOURCE_NOT_FOUND,
            operationId: `component_check_${interaction.id}_${Date.now()}`,
            recoverable: false,
            details: {
              missingComponent: interaction.fromComponent,
              availableComponents: Object.keys(this.components)
            }
          });
        }

        if (!toComponent) {
          throw new InputError(`Target component not found: ${interaction.toComponent}`, {
            code: ErrorCode.INPUT_RESOURCE_NOT_FOUND,
            operationId: `component_check_${interaction.id}_${Date.now()}`,
            recoverable: false,
            details: {
              missingComponent: interaction.toComponent,
              availableComponents: Object.keys(this.components)
            }
          });
        }

        // Execute test function
        const result = await interaction.testFunction({
          from: fromComponent,
          to: toComponent,
          context
        });

        // Validate result against expectations
        const validationResult = this._validateResult(result, interaction.expected);

        if (validationResult.valid) {
          interaction.status = 'passed';
          interaction.result = result;
          this.results.passed++;
          console.log(`✅ Interaction passed`);
        } else {
          interaction.status = 'failed';
          interaction.result = result;
          interaction.error = new InputError(`Validation failed: ${validationResult.reason}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId: `validation_${interaction.id}_${Date.now()}`,
            recoverable: true,
            userFixable: true,
            details: {
              testName: this.name,
              interactionId: interaction.id,
              expected: interaction.expected,
              actual: result
            }
          });
          this.results.failed++;
          console.error(`❌ Interaction failed: ${validationResult.reason}`);

          // Log error
          zkErrorLogger.logError(interaction.error);

          // Skip dependent interactions
          const dependentInteractions = this._getDependentInteractions(interaction.id);
          for (const dependentId of dependentInteractions) {
            const dependent = this.interactions.find(i => i.id === dependentId);
            if (dependent && dependent.status === 'pending') {
              dependent.status = 'skipped';
              this.results.skipped++;
              console.log(`⏩ Skipping dependent interaction: ${dependent.fromComponent} → ${dependent.toComponent} (${dependent.interaction})`);
            }
          }
        }

        // Store interaction result
        this.results.interactionResults.push({
          interaction: interaction.id,
          status: interaction.status,
          result: result,
          error: interaction.error
        });
      } catch (error) {
        interaction.status = 'failed';
        interaction.error = error instanceof ZKError ? error : new SystemError(`Interaction execution failed: ${error.message}`, {
          code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
          operationId: `execution_${interaction.id}_${Date.now()}`,
          recoverable: false,
          details: {
            testName: this.name,
            interactionId: interaction.id,
            originalError: error.message
          }
        });
        this.results.failed++;
        console.error(`❌ Interaction failed with exception: ${error.message}`);

        // Log error
        zkErrorLogger.logError(interaction.error);

        // Skip dependent interactions
        const dependentInteractions = this._getDependentInteractions(interaction.id);
        for (const dependentId of dependentInteractions) {
          const dependent = this.interactions.find(i => i.id === dependentId);
          if (dependent && dependent.status === 'pending') {
            dependent.status = 'skipped';
            this.results.skipped++;
            console.log(`⏩ Skipping dependent interaction: ${dependent.fromComponent} → ${dependent.toComponent} (${dependent.interaction})`);
          }
        }

        // Store interaction result
        this.results.interactionResults.push({
          interaction: interaction.id,
          status: interaction.status,
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
    console.log(`\n📊 Test Results for: ${this.name}`);
    console.log(`Total Interactions: ${this.interactions.length}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);
    console.log(`Result: ${success ? '✅ PASSED' : '❌ FAILED'}`);

    return {
      success,
      results: this.results,
      interactions: this.interactions
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
   * Builds a dependency graph for interactions
   * @returns {Map<string, string[]>} Dependency graph
   * @private
   */
  _buildDependencyGraph() {
    const dependencies = new Map();

    // Initialize all interactions with empty dependency arrays
    this.interactions.forEach(interaction => {
      dependencies.set(interaction.id, []);
    });

    // Find dependencies based on component relationships
    this.interactions.forEach(interactionA => {
      this.interactions.forEach(interactionB => {
        // Skip self
        if (interactionA.id === interactionB.id) return;

        // If interactionA outputs to a component that interactionB takes as input,
        // then interactionB depends on interactionA
        if (interactionA.toComponent === interactionB.fromComponent) {
          const deps = dependencies.get(interactionB.id) || [];
          if (!deps.includes(interactionA.id)) {
            deps.push(interactionA.id);
            dependencies.set(interactionB.id, deps);
          }
        }
      });
    });

    return dependencies;
  }

  /**
   * Gets an optimal execution order respecting dependencies
   * @returns {string[]} Ordered interaction IDs
   * @private
   */
  _getExecutionOrder() {
    const visited = new Set();
    const order = [];

    // Topological sort
    const visit = (interactionId) => {
      if (visited.has(interactionId)) return;
      visited.add(interactionId);

      // Visit dependencies first
      const deps = this.dependencies.get(interactionId) || [];
      for (const dep of deps) {
        visit(dep);
      }

      order.push(interactionId);
    };

    // Visit all interactions
    this.interactions.forEach(interaction => {
      visit(interaction.id);
    });

    return order;
  }

  /**
   * Gets all interactions that depend on the given interaction
   * @param {string} interactionId - ID of the interaction
   * @returns {string[]} IDs of dependent interactions
   * @private
   */
  _getDependentInteractions(interactionId) {
    const dependents = [];

    // Find all interactions that have this interaction as a dependency
    this.interactions.forEach(interaction => {
      const deps = this.dependencies.get(interaction.id) || [];
      if (deps.includes(interactionId)) {
        dependents.push(interaction.id);

        // Recursively add interactions that depend on this one
        const transitiveDependents = this._getDependentInteractions(interaction.id);
        dependents.push(...transitiveDependents);
      }
    });

    // Remove duplicates
    return [...new Set(dependents)];
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
        <title>Cross-Component Test Report: ${this.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .summary { margin-bottom: 20px; }
          .passed { color: green; }
          .failed { color: red; }
          .skipped { color: orange; }
          .interaction { margin-bottom: 10px; border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
          .interaction-header { display: flex; justify-content: space-between; }
          .interaction-details { margin-top: 10px; }
          .error { background-color: #ffebee; padding: 10px; border-radius: 5px; }
          .success { background-color: #e8f5e9; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Cross-Component Test Report</h1>
        <div class="summary">
          <h2>${this.name}</h2>
          <p>${this.description}</p>
          <p><strong>Result:</strong> <span class="${success ? 'passed' : 'failed'}">${success ? 'PASSED' : 'FAILED'}</span></p>
          <p><strong>Interactions:</strong> ${this.interactions.length} total</p>
          <p><strong>Passed:</strong> <span class="passed">${this.results.passed}</span></p>
          <p><strong>Failed:</strong> <span class="failed">${this.results.failed}</span></p>
          <p><strong>Skipped:</strong> <span class="skipped">${this.results.skipped}</span></p>
        </div>
        
        <h2>Component Dependencies</h2>
        <table>
          <tr>
            <th>Interaction</th>
            <th>Dependencies</th>
          </tr>
    `;

    this.interactions.forEach(interaction => {
      const deps = this.dependencies.get(interaction.id) || [];

      html += `
        <tr>
          <td>${interaction.fromComponent} → ${interaction.toComponent} (${interaction.interaction})</td>
          <td>${deps.length > 0 ? deps.join('<br>') : 'None'}</td>
        </tr>
      `;
    });

    html += `
        </table>
        
        <h2>Interactions</h2>
    `;

    this.interactions.forEach(interaction => {
      const statusClass = interaction.status === 'passed' ? 'success' : '';

      html += `
        <div class="interaction ${statusClass}">
          <div class="interaction-header">
            <h3>${interaction.fromComponent} → ${interaction.toComponent} (${interaction.interaction})</h3>
            <span class="${interaction.status}">${interaction.status.toUpperCase()}</span>
          </div>
          <div class="interaction-details">
      `;

      if (interaction.result) {
        html += `
          <pre>${JSON.stringify(interaction.result, null, 2)}</pre>
        `;
      }

      if (interaction.error) {
        html += `
          <div class="error">
            <p><strong>Error:</strong> ${interaction.error.message}</p>
            <pre>${interaction.error.stack}</pre>
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
 * Creates a data flow test between components
 * @param {Object} options - Test options
 * @returns {CrossComponentTest} - Configured test
 */
function createDataFlowTest(options = {}) {
  const {
    name = 'Data Flow Between Components',
    description = 'Tests data flow between key components',
    components = {}
  } = options;

  // Create test instance
  const test = new CrossComponentTest({
    name,
    description,
    components,
    setup: async () => {
      // Prepare test data
      return {
        testData: {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          amount: '1000000000000000000', // 1 ETH
          tokenAddress: '0x0000000000000000000000000000000000000000',
          chainId: 1
        }
      };
    }
  });

  // Add key data flow interactions if components exist
  if (components.zkUtils && components.zkProofGenerator) {
    test.addInteraction({
      fromComponent: 'zkUtils',
      toComponent: 'zkProofGenerator',
      interaction: 'prepareInputs',
      testFunction: async ({ from, to, context }) => {
        // Test zkUtils preparing inputs for zkProofGenerator
        const inputs = await from.prepareProofInputs({
          proofType: 'standard',
          ...context.testData
        });

        // Verify zkProofGenerator can use these inputs
        const isValid = await to.validateInputs('standard', inputs);

        return {
          inputs,
          isValid
        };
      },
      expected: {
        inputs: val => val !== null && typeof val === 'object',
        isValid: true
      }
    });
  }

  if (components.zkProofGenerator && components.zkUtils) {
    test.addInteraction({
      fromComponent: 'zkProofGenerator',
      toComponent: 'zkUtils',
      interaction: 'generateAndSerialize',
      testFunction: async ({ from, to, context }) => {
        // Generate a proof
        const inputs = await to.prepareProofInputs({
          proofType: 'standard',
          ...context.testData
        });

        const proof = await from.generateProof('standard', inputs);

        // Test serialization/deserialization round trip
        const serialized = to.serializeZKProof(proof.proof, proof.publicSignals);
        const deserialized = to.deserializeZKProof(serialized.proof, serialized.publicSignals);

        return {
          proof,
          serialized,
          deserialized,
          roundTripSuccessful: JSON.stringify(proof) === JSON.stringify(deserialized)
        };
      },
      expected: {
        proof: val => val && val.proof && val.publicSignals,
        serialized: val => val && typeof val.proof === 'string',
        roundTripSuccessful: true
      }
    });
  }

  if (components.zkSecureInputs && components.zkProofGenerator) {
    test.addInteraction({
      fromComponent: 'zkSecureInputs',
      toComponent: 'zkProofGenerator',
      interaction: 'secureInputPreparation',
      testFunction: async ({ from, to, context }) => {
        // Generate secure inputs
        const secureInputs = await from.generateSecureInputs({
          walletAddress: context.testData.walletAddress,
          amount: context.testData.amount,
          nonce: Date.now().toString()
        });

        // Confirm the proof generator can work with secure inputs
        const isValid = await to.validateSecureInputs(secureInputs);

        return {
          secureInputs,
          isValid
        };
      },
      expected: {
        secureInputs: val => val !== null && typeof val === 'object',
        isValid: true
      }
    });
  }

  return test;
}

/**
 * Creates an error propagation test between components
 * @param {Object} options - Test options
 * @returns {CrossComponentTest} - Configured test
 */
function createErrorPropagationTest(options = {}) {
  const {
    name = 'Error Propagation Between Components',
    description = 'Tests error handling and propagation between components',
    components = {}
  } = options;

  // Create test instance
  const test = new CrossComponentTest({
    name,
    description,
    components
  });

  // Add error propagation tests
  if (components.zkUtils && components.zkErrorHandler) {
    test.addInteraction({
      fromComponent: 'zkUtils',
      toComponent: 'zkErrorHandler',
      interaction: 'errorHandling',
      testFunction: async ({ from, to }) => {
        // Induce an error in zkUtils and check if it's properly converted to a zkError
        try {
          // Call with invalid input to trigger an error
          await from.prepareProofInputs({
            proofType: 'invalidType',
            walletAddress: '0x0',
            amount: 'invalid'
          });
          return { errorCaught: false };
        } catch (error) {
          // Check if error is properly handled and converted
          const zkError = to.fromError(error);

          return {
            errorCaught: true,
            originalError: error,
            zkError,
            isZKError: to.isZKError(zkError),
            hasErrorCode: Boolean(zkError.code),
            severity: zkError.severity
          };
        }
      },
      expected: {
        errorCaught: true,
        isZKError: true,
        hasErrorCode: true
      }
    });
  }

  if (components.zkErrorHandler && components.zkErrorLogger) {
    test.addInteraction({
      fromComponent: 'zkErrorHandler',
      toComponent: 'zkErrorLogger',
      interaction: 'errorLogging',
      testFunction: async ({ from, to }) => {
        // Create a ZK error and check if it's properly logged
        const error = new Error('Test error for logging');
        const zkError = from.fromError(error, {
          code: 'TEST_ERROR',
          severity: 'ERROR',
          category: 'TEST'
        });

        // Log the error
        const logResult = to.logError(zkError);

        return {
          zkError,
          logResult,
          logged: Boolean(logResult)
        };
      },
      expected: {
        logged: true
      }
    });
  }

  return test;
}

export { CrossComponentTest, createDataFlowTest, createErrorPropagationTest };
export default CrossComponentTest;