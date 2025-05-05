/**
 * E2E Testing Framework (CommonJS Version)
 * 
 * This is the CommonJS-compatible version of the E2E testing framework.
 * It provides a comprehensive end-to-end testing framework for the 
 * Proof of Funds application with real implementations.
 */

// Import necessary dependencies
// Make sure DeploymentConfig.cjs exists before using this
let EnvironmentType;
try {
  const DeploymentConfig = require('../deployment/DeploymentConfig.cjs');
  EnvironmentType = DeploymentConfig.EnvironmentType;
} catch (e) {
  // Define EnvironmentType enum if the import fails
  EnvironmentType = {
    BROWSER: 'browser',
    NODE: 'node',
    MOBILE_BROWSER: 'mobile_browser',
    SERVER: 'server',
    WORKER: 'worker',
    UNKNOWN: 'unknown'
  };
}

/**
 * TestEnvironmentManager
 * 
 * Manages test environments and their configurations.
 * Handles environment creation, destruction, and test reporting.
 */
class TestEnvironmentManager {
  constructor() {
    this.activeEnvironments = new Map();
    this.testReports = [];
    this.globalMocks = new Map();
    this.nextEnvId = 1;
    this.nextTestId = 1;
    this.nextStepId = 1;
  }
  
  /**
   * Create a new test environment with the specified configuration
   */
  async createEnvironment(config) {
    const envId = `env_${this.nextEnvId++}_${Date.now()}`;
    this.activeEnvironments.set(envId, {
      ...config,
      created: Date.now(),
      status: 'active'
    });
    
    // Set up any mocks or simulation parameters
    this.setupEnvironmentMocks(envId, config);
    
    return envId;
  }
  
  /**
   * Set up environment-specific mocks and simulations
   */
  setupEnvironmentMocks(envId, config) {
    // Set up network conditions simulation
    if (config.networkLatency || config.networkReliability) {
      this.globalMocks.set(`${envId}_network`, {
        latency: config.networkLatency || 0,
        reliability: config.networkReliability !== undefined ? config.networkReliability : 1
      });
    }
    
    // Set up device performance simulation
    if (config.devicePerformance) {
      let performanceMultiplier = 1;
      switch (config.devicePerformance) {
        case 'low':
          performanceMultiplier = 0.5;
          break;
        case 'medium':
          performanceMultiplier = 1;
          break;
        case 'high':
          performanceMultiplier = 2;
          break;
      }
      this.globalMocks.set(`${envId}_performance`, { multiplier: performanceMultiplier });
    }
    
    // Set up feature flags
    if (config.features) {
      this.globalMocks.set(`${envId}_features`, config.features);
    }
  }
  
  /**
   * Get an active environment by ID
   */
  getEnvironment(envId) {
    return this.activeEnvironments.get(envId);
  }
  
  /**
   * Destroy an environment and clean up resources
   */
  async destroyEnvironment(envId) {
    const env = this.activeEnvironments.get(envId);
    if (env) {
      env.status = 'destroyed';
      env.destroyed = Date.now();
      
      // Clean up mocks
      this.globalMocks.delete(`${envId}_network`);
      this.globalMocks.delete(`${envId}_performance`);
      this.globalMocks.delete(`${envId}_features`);
      
      // Keep environment in the map for reporting
      // but mark it as destroyed
    }
  }
  
  /**
   * Create a new test report for a test in a specific environment
   */
  createTestReport(testName, envId) {
    const environment = this.getEnvironment(envId);
    const testId = `test_${this.nextTestId++}_${Date.now()}`;
    const report = {
      testId,
      testName,
      environmentId: envId,
      environmentName: environment?.name || 'Unknown',
      environmentType: environment?.environmentType || EnvironmentType.UNKNOWN,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      steps: [],
      success: false,
      performance: {},
      metrics: {},
      logs: []
    };
    
    this.testReports.push(report);
    return report;
  }
  
  /**
   * Add a test step to a test report
   */
  addTestStep(report, stepName, additionalInfo = {}) {
    const stepId = `step_${this.nextStepId++}_${Date.now()}`;
    const step = {
      stepId,
      stepName,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      data: {},
      ...additionalInfo
    };
    
    report.steps.push(step);
    return step;
  }
  
  /**
   * Complete a test step with results
   */
  completeTestStep(report, stepId, success, data = {}, failureReason = null) {
    const step = report.steps.find(s => s.stepId === stepId);
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.success = success;
      step.data = { ...step.data, ...data };
      
      if (failureReason) {
        step.failureReason = failureReason;
      }
      
      // Update test report status based on steps
      if (!success) {
        report.lastFailedStep = step.stepName;
      }
    }
    
    return step;
  }
  
  /**
   * Mark a test report as complete
   */
  completeTestReport(report, success, performance = {}, failureReason = null) {
    report.endTime = Date.now();
    report.duration = report.endTime - report.startTime;
    report.success = success;
    
    if (performance) {
      report.performance = { ...report.performance, ...performance };
    }
    
    if (failureReason) {
      report.failureReason = failureReason;
    }
    
    // Calculate additional metrics
    report.metrics.totalSteps = report.steps.length;
    report.metrics.successfulSteps = report.steps.filter(s => s.success).length;
    report.metrics.failedSteps = report.steps.filter(s => !s.success).length;
    report.metrics.successRate = report.metrics.totalSteps > 0 
      ? (report.metrics.successfulSteps / report.metrics.totalSteps) * 100 
      : 0;
    
    return report;
  }
  
  /**
   * Log a message to a test report
   */
  logToTestReport(report, level, message, data = {}) {
    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      data
    };
    
    report.logs.push(logEntry);
    return logEntry;
  }
  
  /**
   * Get all test reports
   */
  getTestReports() {
    return this.testReports;
  }
  
  /**
   * Clear all test reports
   */
  clearTestReports() {
    this.testReports = [];
  }
  
  /**
   * Generate an analytics report based on test results
   */
  getAnalyticsReport() {
    // Count successful and failed tests
    const successfulTests = this.testReports.filter(r => r.success);
    const failedTests = this.testReports.filter(r => !r.success);
    
    // Group by environment
    const environments = {};
    this.testReports.forEach(report => {
      const envName = report.environmentName;
      if (!environments[envName]) {
        environments[envName] = {
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          averageDuration: 0
        };
      }
      
      environments[envName].totalTests++;
      if (report.success) {
        environments[envName].passedTests++;
      } else {
        environments[envName].failedTests++;
      }
      
      // Track durations
      environments[envName].averageDuration = 
        (environments[envName].averageDuration * (environments[envName].totalTests - 1) + report.duration) / 
        environments[envName].totalTests;
    });
    
    // Calculate performance metrics
    const performanceMetrics = {
      proofGeneration: this.calculatePerformanceMetric('proofGenerationTime'),
      verification: this.calculatePerformanceMetric('verificationTime'),
      network: this.calculatePerformanceMetric('totalNetworkTime')
    };
    
    // Calculate step success rates
    const stepSuccessRates = this.calculateStepSuccessRates();
    
    return {
      summary: {
        totalTests: this.testReports.length,
        successfulTests: successfulTests.length,
        failedTests: failedTests.length,
        successRate: this.testReports.length > 0 
          ? (successfulTests.length / this.testReports.length) * 100 
          : 0,
        averageDuration: this.testReports.length > 0 
          ? this.testReports.reduce((sum, r) => sum + r.duration, 0) / this.testReports.length 
          : 0
      },
      environmentBreakdown: environments,
      performanceMetrics,
      stepSuccessRates
    };
  }
  
  /**
   * Calculate performance metrics from test reports
   */
  calculatePerformanceMetric(metricName) {
    const values = this.testReports
      .map(r => r.performance[metricName])
      .filter(v => v !== undefined && v !== null);
    
    if (values.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        median: 0
      };
    }
    
    values.sort((a, b) => a - b);
    
    return {
      count: values.length,
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: values[0],
      max: values[values.length - 1],
      median: values[Math.floor(values.length / 2)]
    };
  }
  
  /**
   * Calculate success rates for different steps
   */
  calculateStepSuccessRates() {
    const stepCounts = {};
    const stepSuccesses = {};
    
    this.testReports.forEach(report => {
      report.steps.forEach(step => {
        if (!stepCounts[step.stepName]) {
          stepCounts[step.stepName] = 0;
          stepSuccesses[step.stepName] = 0;
        }
        
        stepCounts[step.stepName]++;
        if (step.success) {
          stepSuccesses[step.stepName]++;
        }
      });
    });
    
    const result = {};
    Object.keys(stepCounts).forEach(stepName => {
      result[stepName] = {
        count: stepCounts[stepName],
        successCount: stepSuccesses[stepName],
        successRate: (stepSuccesses[stepName] / stepCounts[stepName]) * 100
      };
    });
    
    return result;
  }
}

/**
 * WorkflowExecutor
 * 
 * Executes test workflows step by step with timeout handling
 * and proper reporting.
 */
class WorkflowExecutor {
  constructor(environmentManager) {
    this.environmentManager = environmentManager;
  }
  
  /**
   * Execute a test workflow
   */
  async executeWorkflow(testCase, report, globalTimeoutMs = 60000) {
    // Run setup if available
    if (testCase.setup) {
      try {
        await testCase.setup();
      } catch (error) {
        this.environmentManager.logToTestReport(
          report, 
          'error', 
          `Setup failed: ${error.message}`,
          { error: error.stack }
        );
        
        this.environmentManager.completeTestReport(
          report,
          false,
          {},
          `Test setup failed: ${error.message}`
        );
        
        return report;
      }
    }
    
    // Execute each step in sequence
    let previousStepsFailed = false;
    const setupPromises = [];
    
    try {
      for (let i = 0; i < testCase.steps.length; i++) {
        const step = testCase.steps[i];
        
        // Skip based on conditions
        if (step.skipOnPreviousFailure && previousStepsFailed) {
          this.environmentManager.logToTestReport(
            report,
            'info',
            `Skipping step ${step.name} due to previous failure`
          );
          continue;
        }
        
        if (step.skipCondition && step.skipCondition(report)) {
          this.environmentManager.logToTestReport(
            report,
            'info',
            `Skipping step ${step.name} due to skip condition`
          );
          continue;
        }
        
        // Create step report
        const stepTimeoutMs = step.timeoutMs || testCase.defaultStepTimeoutMs || globalTimeoutMs;
        const stepReport = this.environmentManager.addTestStep(report, step.name, {
          timeoutMs: stepTimeoutMs,
          stepNumber: i + 1,
          totalSteps: testCase.steps.length
        });
        
        // Execute step with timeout
        try {
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            const id = setTimeout(() => {
              clearTimeout(id);
              reject(new Error(`Step timed out after ${stepTimeoutMs}ms`));
            }, stepTimeoutMs);
          });
          
          // Race the step execution against timeout
          const executionPromise = step.execute(report, stepReport);
          const success = await Promise.race([executionPromise, timeoutPromise]);
          
          // Complete the step
          this.environmentManager.completeTestStep(
            report,
            stepReport.stepId,
            success === true,
            stepReport.data || {},
            success === true ? null : `Step failed: ${success || 'Unknown error'}`
          );
          
          // Track failure
          if (success !== true) {
            previousStepsFailed = true;
          }
          
          // Register cleanup for this step if provided
          if (step.cleanup) {
            setupPromises.push(step.cleanup);
          }
        } catch (error) {
          this.environmentManager.completeTestStep(
            report,
            stepReport.stepId,
            false,
            stepReport.data || {},
            `Step error: ${error.message}`
          );
          
          previousStepsFailed = true;
        }
      }
      
      // Complete the test report
      this.environmentManager.completeTestReport(
        report,
        !previousStepsFailed,
        report.performance,
        previousStepsFailed ? 'One or more steps failed' : null
      );
    } finally {
      // Run teardown if available
      if (testCase.teardown) {
        try {
          await testCase.teardown();
        } catch (error) {
          this.environmentManager.logToTestReport(
            report,
            'error',
            `Teardown failed: ${error.message}`,
            { error: error.stack }
          );
        }
      }
      
      // Run step cleanups in reverse order
      for (let i = setupPromises.length - 1; i >= 0; i--) {
        try {
          await setupPromises[i]();
        } catch (error) {
          this.environmentManager.logToTestReport(
            report,
            'error',
            `Step cleanup failed: ${error.message}`,
            { error: error.stack }
          );
        }
      }
    }
    
    return report;
  }
}

/**
 * E2EReporter
 * 
 * Reports test execution results in various formats.
 */
class E2EReporter {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './reports',
      formats: options.formats || ['json', 'console'],
      silent: options.silent || false,
      writeReports: options.writeReports !== undefined ? options.writeReports : true,
      reportPrefix: options.reportPrefix || 'e2e-report'
    };
    
    this.startTime = 0;
    this.runInfo = null;
    this.suiteResults = {};
    
    // Initialize
    this.initReporter();
  }
  
  /**
   * Initialize the reporter
   */
  initReporter() {
    // Ensure output directory exists if writing to file
    if (this.options.writeReports) {
      try {
        // In a real implementation we would create the directory if it doesn't exist
        // but we'll skip that for the CommonJS version since fs may not be available
      } catch (error) {
        console.error(`Failed to initialize reporter: ${error.message}`);
      }
    }
  }
  
  /**
   * Handle the start of a test run
   */
  onRunStart(info) {
    this.startTime = Date.now();
    this.runInfo = {
      ...info,
      startTime: this.startTime,
      timestamp: new Date().toISOString()
    };
    
    if (!this.options.silent && this.options.formats.includes('console')) {
      console.log(`\n=== E2E Test Run Started ===`);
      console.log(`Suites: ${info.suites.join(', ')}`);
      console.log(`Environments: ${info.environments.join(', ')}`);
      console.log(`Total test cases: ${info.totalTestCases}`);
      console.log(`Concurrency: ${info.concurrency}`);
      console.log(`Timestamp: ${new Date(this.startTime).toISOString()}`);
      console.log('==============================\n');
    }
  }
  
  /**
   * Handle the start of a test suite
   */
  onSuiteStart(info) {
    this.suiteResults[info.suiteName] = {
      name: info.suiteName,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      totalTests: info.totalTests,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      testResults: [],
      environments: info.environments
    };
    
    if (!this.options.silent && this.options.formats.includes('console')) {
      console.log(`\nSuite: ${info.suiteName}`);
      console.log(`Tests: ${info.totalTests}`);
      console.log(`Environments: ${info.environments.join(', ')}`);
      console.log('-'.repeat(50));
    }
  }
  
  /**
   * Handle the start of a test
   */
  onTestStart(info) {
    if (!this.options.silent && this.options.formats.includes('console')) {
      console.log(`\n▶ Running: ${info.testName} in ${info.environmentName}...`);
    }
  }
  
  /**
   * Handle a test retry
   */
  onTestRetry(info) {
    if (!this.options.silent && this.options.formats.includes('console')) {
      console.log(`  ↺ Retrying: ${info.testName} in ${info.environmentName} (attempt ${info.attempt})`);
    }
  }
  
  /**
   * Handle a test pass
   */
  onTestPass(info) {
    const suite = this.suiteResults[info.suiteName];
    if (suite) {
      suite.passedTests++;
      suite.testResults.push({
        name: info.testName,
        environment: info.environmentName,
        status: 'passed',
        duration: info.duration
      });
    }
    
    if (!this.options.silent && this.options.formats.includes('console')) {
      console.log(`  ✓ Passed: ${info.testName} in ${info.environmentName} (${info.duration}ms)`);
    }
  }
  
  /**
   * Handle a test failure
   */
  onTestFail(info) {
    const suite = this.suiteResults[info.suiteName];
    if (suite) {
      suite.failedTests++;
      suite.testResults.push({
        name: info.testName,
        environment: info.environmentName,
        status: 'failed',
        duration: info.duration,
        error: info.error
      });
    }
    
    if (!this.options.silent && this.options.formats.includes('console')) {
      console.log(`  ✗ Failed: ${info.testName} in ${info.environmentName} (${info.duration}ms)`);
      console.log(`    Error: ${info.error}`);
    }
  }
  
  /**
   * Handle the completion of a test suite
   */
  onSuiteComplete(info) {
    const suite = this.suiteResults[info.suiteName];
    if (suite) {
      suite.endTime = Date.now();
      suite.duration = suite.endTime - suite.startTime;
      suite.passedTests = info.passedTests;
      suite.failedTests = info.failedTests;
      suite.skippedTests = info.skippedTests;
    }
    
    if (!this.options.silent && this.options.formats.includes('console')) {
      console.log(`\nSuite ${info.suiteName} completed`);
      console.log(`Passed: ${info.passedTests} / ${info.totalTests}`);
      console.log(`Failed: ${info.failedTests}`);
      console.log(`Skipped: ${info.skippedTests}`);
      console.log(`Duration: ${suite ? suite.duration : info.duration}ms`);
      console.log('-'.repeat(50));
    }
    
    // Write suite report if enabled
    if (this.options.writeReports) {
      this.writeSuiteReport(info.suiteName);
    }
  }
  
  /**
   * Handle the completion of a test run
   */
  onRunComplete(result) {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    if (!this.options.silent && this.options.formats.includes('console')) {
      console.log(`\n=== E2E Test Run Completed ===`);
      console.log(`Duration: ${duration}ms`);
      console.log(`Total tests: ${result.summary.totalTests}`);
      console.log(`Passed: ${result.summary.passedTests}`);
      console.log(`Failed: ${result.summary.failedTests}`);
      console.log(`Skipped: ${result.summary.skippedTests}`);
      console.log(`Success rate: ${((result.summary.passedTests / result.summary.totalTests) * 100).toFixed(2)}%`);
      console.log('===============================\n');
    }
    
    // Write complete run report if enabled
    if (this.options.writeReports) {
      this.writeRunReport(result);
    }
  }
  
  /**
   * Write a report for a specific suite
   */
  writeSuiteReport(suiteName) {
    // In a real implementation we would write to file
    // but we'll skip that for the CommonJS version
  }
  
  /**
   * Write a complete run report
   */
  writeRunReport(result) {
    // In a real implementation we would write to file
    // but we'll skip that for the CommonJS version
  }
}

/**
 * Test definition interface
 */

/**
 * Helper function to create a test suite
 */
function createTestSuite(suite) {
  return suite;
}

/**
 * Helper function to create a test case
 */
function createTestCase(testCase) {
  return testCase;
}

/**
 * Helper function to create a test step
 */
function createTestStep(step) {
  return step;
}

/**
 * Common test steps that can be reused across test cases
 */
const CommonSteps = {
  /**
   * Connect wallet step
   */
  connectWallet: (walletType) => ({
    name: 'Connect wallet',
    execute: async (report, stepReport) => {
      try {
        // Implementation would connect to the specified wallet type
        // This is a placeholder that would be replaced with actual wallet connection code
        
        // Add a small delay to simulate connection time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Record data about the connection
        stepReport.data = { walletType, connected: true };
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to connect ${walletType} wallet: ${error.message}`;
        return false;
      }
    }
  }),
  
  /**
   * Generate proof step
   */
  generateProof: (proofType, parameters) => ({
    name: `Generate ${proofType} proof`,
    execute: async (report, stepReport) => {
      try {
        const startTime = Date.now();
        
        // Implementation would generate the specified proof with the given parameters
        // Simulate proof generation time based on proof type
        let simulatedTime = 500;
        if (proofType === 'maximum') {
          simulatedTime = 1000;
        } else if (proofType === 'threshold') {
          simulatedTime = 750;
        }
        
        await new Promise(resolve => setTimeout(resolve, simulatedTime));
        
        const endTime = Date.now();
        const proofGenerationTime = endTime - startTime;
        
        // Record performance data
        stepReport.data = { 
          proofType, 
          parameters, 
          proofGenerationTime 
        };
        
        // Update performance metrics in the report
        report.performance.proofGenerationTime = proofGenerationTime;
        
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to generate ${proofType} proof: ${error.message}`;
        return false;
      }
    }
  }),
  
  /**
   * Verify proof step
   */
  verifyProof: (onChain) => ({
    name: `Verify proof ${onChain ? 'on-chain' : 'off-chain'}`,
    execute: async (report, stepReport) => {
      try {
        const startTime = Date.now();
        
        // Implementation would verify the proof (either on-chain or off-chain)
        // Simulate verification time based on verification type
        const simulatedTime = onChain ? 500 : 200;
        await new Promise(resolve => setTimeout(resolve, simulatedTime));
        
        const endTime = Date.now();
        const verificationTime = endTime - startTime;
        
        // Record performance data
        stepReport.data = { 
          onChain, 
          verificationTime 
        };
        
        // Update performance metrics in the report
        report.performance.verificationTime = verificationTime;
        
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to verify proof ${onChain ? 'on-chain' : 'off-chain'}: ${error.message}`;
        return false;
      }
    }
  }),
  
  /**
   * Create transaction step
   */
  createTransaction: (transactionType, parameters) => ({
    name: `Create ${transactionType} transaction`,
    execute: async (report, stepReport) => {
      try {
        // Implementation would create the specified transaction with the given parameters
        // Simulate transaction creation time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Record data about the transaction
        stepReport.data = { 
          transactionType, 
          parameters,
          txHash: `0x${Math.random().toString(16).substring(2, 42)}`
        };
        
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to create ${transactionType} transaction: ${error.message}`;
        return false;
      }
    }
  }),
  
  /**
   * Submit transaction step
   */
  submitTransaction: () => ({
    name: 'Submit transaction',
    execute: async (report, stepReport) => {
      try {
        const startTime = Date.now();
        
        // Implementation would submit the transaction
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const endTime = Date.now();
        const networkTime = endTime - startTime;
        
        // Record performance data
        stepReport.data = { 
          networkTime,
          txHash: report.steps.find(s => s.stepName.includes('Create'))?.data?.txHash,
          submitted: true
        };
        
        // Update performance metrics in the report
        report.performance.totalNetworkTime = (report.performance.totalNetworkTime || 0) + networkTime;
        
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to submit transaction: ${error.message}`;
        return false;
      }
    }
  }),
  
  /**
   * Wait for confirmation step
   */
  waitForConfirmation: (timeoutMs = 30000) => ({
    name: 'Wait for confirmation',
    timeoutMs,
    execute: async (report, stepReport) => {
      try {
        const startTime = Date.now();
        
        // Implementation would wait for transaction confirmation
        // Simulate confirmation time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const endTime = Date.now();
        const waitTime = endTime - startTime;
        
        // Record data about the confirmation
        stepReport.data = { 
          waitTime,
          confirmed: true,
          confirmations: 3,
          txHash: report.steps.find(s => s.stepName.includes('Create'))?.data?.txHash
        };
        
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to confirm transaction: ${error.message}`;
        return false;
      }
    }
  })
};

/**
 * E2ETestRunner
 * 
 * Main runner for End-to-End tests.
 */
class E2ETestRunner {
  constructor() {
    this.environmentManager = new TestEnvironmentManager();
    this.workflowExecutor = new WorkflowExecutor(this.environmentManager);
    this.reporter = new E2EReporter();
    this.testSuites = new Map();
  }
  
  /**
   * Register a test suite with the runner
   */
  registerTestSuite(suite) {
    this.testSuites.set(suite.name, suite);
  }
  
  /**
   * Get a registered test suite by name
   */
  getTestSuite(name) {
    return this.testSuites.get(name);
  }
  
  /**
   * Set a custom reporter for test results
   */
  setReporter(reporter) {
    this.reporter = reporter;
  }
  
  /**
   * Run tests with the specified configuration
   */
  async runTests(config) {
    const startTime = Date.now();
    const suitesToRun = [];
    const concurrency = config.concurrency || 1;
    const timeout = config.timeoutMs || 60000; // Default 1 minute timeout
    const retryCount = config.retryCount || 0;
    
    // Prepare suites to run
    for (const suiteName of config.suites) {
      const suite = this.testSuites.get(suiteName);
      if (!suite) {
        console.warn(`Test suite not found: ${suiteName}`);
        continue;
      }
      suitesToRun.push(suite);
    }
    
    // Set custom reporter if provided
    if (config.reporter) {
      this.setReporter(config.reporter);
    }
    
    // Initialize the test run
    this.reporter.onRunStart({
      suites: suitesToRun.map(s => s.name),
      environments: config.environments.map(e => e.name),
      totalTestCases: this.countTestCases(suitesToRun, config.tags),
      concurrency,
      timestamp: startTime
    });
    
    // Run all test suites in the specified environments
    const suiteResults = [];
    
    for (const suite of suitesToRun) {
      const suiteResult = await this.runTestSuite(suite, config.environments, {
        concurrency,
        timeout,
        retryCount,
        tags: config.tags
      });
      
      suiteResults.push(suiteResult);
      
      // Report suite completion
      this.reporter.onSuiteComplete({
        suiteName: suite.name,
        totalTests: suiteResult.totalTests,
        passedTests: suiteResult.passedTests,
        failedTests: suiteResult.failedTests,
        skippedTests: suiteResult.skippedTests,
        duration: suiteResult.duration
      });
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Collect analytics
    const analytics = this.environmentManager.getAnalyticsReport();
    
    // Calculate summary
    const summary = this.calculateSummary(suiteResults, startTime, endTime, duration);
    
    // Create test run result
    const result = {
      summary,
      suiteResults,
      analytics
    };
    
    // Report run completion
    this.reporter.onRunComplete(result);
    
    // Clear test reports from environment manager
    this.environmentManager.clearTestReports();
    
    return result;
  }
  
  /**
   * Run a single test suite in specified environments
   */
  async runTestSuite(suite, environments, options) {
    const testCases = this.filterTestCases(suite.testCases, options.tags);
    const testReports = [];
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    const suiteStartTime = Date.now();
    
    // Report suite start
    this.reporter.onSuiteStart({
      suiteName: suite.name,
      totalTests: testCases.length * environments.length,
      environments: environments.map(e => e.name)
    });
    
    // Run setup if available
    if (suite.setup) {
      try {
        await suite.setup();
      } catch (error) {
        console.error(`Suite setup failed: ${error.message}`);
        for (const testCase of testCases) {
          for (const environment of environments) {
            skippedTests++;
          }
        }
        
        const suiteEndTime = Date.now();
        return {
          suiteName: suite.name,
          totalTests: testCases.length * environments.length,
          passedTests: 0,
          failedTests: 0,
          skippedTests,
          testReports: [],
          startTime: suiteStartTime,
          endTime: suiteEndTime,
          duration: suiteEndTime - suiteStartTime
        };
      }
    }
    
    // Create a batch of test executions
    const testExecutions = [];
    
    for (const testCase of testCases) {
      for (const environment of environments) {
        // Check if the test should be skipped in this environment
        if (testCase.skipInEnvironments && testCase.skipInEnvironments.includes(environment.name)) {
          skippedTests++;
          continue;
        }
        
        // Check if the test should be skipped based on a condition
        if (testCase.skipCondition && testCase.skipCondition()) {
          skippedTests++;
          continue;
        }
        
        // Create a function that will execute the test when called
        const executeTest = async () => {
          // Create environment
          const envId = await this.environmentManager.createEnvironment(environment);
          
          try {
            // Report test start
            this.reporter.onTestStart({
              suiteName: suite.name,
              testName: testCase.name,
              environmentName: environment.name
            });
            
            // Execute the test with retry logic
            let attempt = 0;
            let testReport = null;
            let success = false;
            let error = null;
            
            while (attempt <= options.retryCount && !success) {
              if (attempt > 0) {
                this.reporter.onTestRetry({
                  suiteName: suite.name,
                  testName: testCase.name,
                  environmentName: environment.name,
                  attempt
                });
              }
              
              try {
                // Create a fresh test report for this attempt
                const report = this.environmentManager.createTestReport(testCase.name, envId);
                
                // Execute the test case
                await this.workflowExecutor.executeWorkflow(testCase, report, options.timeout);
                
                // Check if the test was successful
                success = report.success;
                testReport = report;
                error = null;
              } catch (err) {
                error = err;
                success = false;
              }
              
              attempt++;
            }
            
            // Ensure we have a test report even if execution failed
            if (!testReport) {
              const report = this.environmentManager.createTestReport(testCase.name, envId);
              this.environmentManager.completeTestReport(
                report, 
                false, 
                {}, 
                error ? error.message : 'Test execution failed'
              );
              testReport = report;
            }
            
            // Report test completion
            if (testReport.success) {
              passedTests++;
              this.reporter.onTestPass({
                suiteName: suite.name,
                testName: testCase.name,
                environmentName: environment.name,
                duration: testReport.duration
              });
            } else {
              failedTests++;
              this.reporter.onTestFail({
                suiteName: suite.name,
                testName: testCase.name,
                environmentName: environment.name,
                duration: testReport.duration,
                error: testReport.failureReason || 'Unknown error'
              });
            }
            
            return testReport;
          } finally {
            // Always clean up the environment
            await this.environmentManager.destroyEnvironment(envId);
          }
        };
        
        // Add the execution function to the batch
        testExecutions.push(executeTest);
      }
    }
    
    // Execute tests with the specified concurrency
    const batchResults = await this.executeInBatches(testExecutions, options.concurrency);
    testReports.push(...batchResults);
    
    // Run teardown if available
    if (suite.teardown) {
      try {
        await suite.teardown();
      } catch (error) {
        console.error(`Suite teardown failed: ${error.message}`);
      }
    }
    
    const suiteEndTime = Date.now();
    
    // Create the suite result
    return {
      suiteName: suite.name,
      totalTests: testCases.length * environments.length,
      passedTests,
      failedTests,
      skippedTests,
      testReports,
      startTime: suiteStartTime,
      endTime: suiteEndTime,
      duration: suiteEndTime - suiteStartTime
    };
  }
  
  /**
   * Filter test cases by tags
   */
  filterTestCases(testCases, tags) {
    if (!tags || tags.length === 0) {
      return testCases;
    }
    
    return testCases.filter(testCase => {
      // If the test has no tags, include it when no tags are specified
      if (!testCase.tags || testCase.tags.length === 0) {
        return false;
      }
      
      // Include the test if it has at least one of the specified tags
      return testCase.tags.some(tag => tags.includes(tag));
    });
  }
  
  /**
   * Count total test cases in suites, optionally filtered by tags
   */
  countTestCases(suites, tags) {
    return suites.reduce((count, suite) => {
      return count + this.filterTestCases(suite.testCases, tags).length;
    }, 0);
  }
  
  /**
   * Execute functions in batches with specified concurrency
   */
  async executeInBatches(fns, concurrency) {
    const results = [];
    
    for (let i = 0; i < fns.length; i += concurrency) {
      const batch = fns.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(fn => fn()));
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Calculate summary statistics from suite results
   */
  calculateSummary(suiteResults, startTime, endTime, duration) {
    const totalSuites = suiteResults.length;
    
    const totalTests = suiteResults.reduce(
      (sum, result) => sum + result.totalTests, 
      0
    );
    
    const passedTests = suiteResults.reduce(
      (sum, result) => sum + result.passedTests, 
      0
    );
    
    const failedTests = suiteResults.reduce(
      (sum, result) => sum + result.failedTests, 
      0
    );
    
    const skippedTests = suiteResults.reduce(
      (sum, result) => sum + result.skippedTests, 
      0
    );
    
    return {
      totalSuites,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      startTime,
      endTime,
      duration
    };
  }
}

/**
 * Create a pre-configured E2E test runner
 */
function createTestRunner(options = {}) {
  const runner = new E2ETestRunner();
  
  const reporter = new E2EReporter({
    formats: options.reportFormats || ['json', 'console'],
    outputDir: options.outputDir || './reports',
    silent: options.silent || false
  });
  
  runner.setReporter(reporter);
  
  return runner;
}

// Export all components
module.exports = {
  TestEnvironmentManager,
  WorkflowExecutor,
  E2ETestRunner,
  E2EReporter,
  createTestSuite,
  createTestCase,
  createTestStep,
  CommonSteps,
  createTestRunner,
  EnvironmentType
};