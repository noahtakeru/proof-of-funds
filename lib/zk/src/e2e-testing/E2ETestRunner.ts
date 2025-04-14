/**
 * E2ETestRunner.ts
 * 
 * Main runner for End-to-End Integration Tests.
 * This class orchestrates the execution of E2E tests across different environments
 * and provides comprehensive reporting and analytics.
 */

import { 
  TestEnvironmentManager, 
  TestEnvironmentConfig, 
  TestReport 
} from './TestEnvironmentManager';
import { TestCase, TestSuite } from './TestDefinitions';
import { E2EReporter } from './E2EReporter';
import { WorkflowExecutor } from './WorkflowExecutor';

export interface TestRunConfiguration {
  suites: string[]; // Names of test suites to run
  environments: TestEnvironmentConfig[]; // Environments to run tests in
  concurrency?: number; // Number of concurrent tests to run
  timeoutMs?: number; // Global timeout for tests
  reporter?: E2EReporter; // Custom reporter
  retryCount?: number; // Number of retries for failed tests
  tags?: string[]; // Tags to filter test cases
}

export interface TestRunResult {
  summary: {
    totalSuites: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    startTime: number;
    endTime: number;
    duration: number;
  };
  suiteResults: SuiteResult[];
  analytics: any;
}

export interface SuiteResult {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  testReports: TestReport[];
}

export class E2ETestRunner {
  private environmentManager: TestEnvironmentManager;
  private workflowExecutor: WorkflowExecutor;
  private reporter: E2EReporter;
  private testSuites: Map<string, TestSuite> = new Map();
  
  constructor() {
    this.environmentManager = new TestEnvironmentManager();
    this.workflowExecutor = new WorkflowExecutor(this.environmentManager);
    this.reporter = new E2EReporter();
  }
  
  /**
   * Register a test suite with the runner
   */
  registerTestSuite(suite: TestSuite): void {
    this.testSuites.set(suite.name, suite);
  }
  
  /**
   * Get a registered test suite by name
   */
  getTestSuite(name: string): TestSuite | undefined {
    return this.testSuites.get(name);
  }
  
  /**
   * Set a custom reporter for test results
   */
  setReporter(reporter: E2EReporter): void {
    this.reporter = reporter;
  }
  
  /**
   * Run tests with the specified configuration
   */
  async runTests(config: TestRunConfiguration): Promise<TestRunResult> {
    const startTime = Date.now();
    const suitesToRun: TestSuite[] = [];
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
    const suiteResults: SuiteResult[] = [];
    
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
        duration: 0 // Calculated by reporter
      });
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Collect analytics
    const analytics = this.environmentManager.getAnalyticsReport();
    
    // Calculate summary
    const summary = this.calculateSummary(suiteResults, startTime, endTime, duration);
    
    // Create test run result
    const result: TestRunResult = {
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
  private async runTestSuite(
    suite: TestSuite, 
    environments: TestEnvironmentConfig[],
    options: {
      concurrency: number;
      timeout: number;
      retryCount: number;
      tags?: string[];
    }
  ): Promise<SuiteResult> {
    const testCases = this.filterTestCases(suite.testCases, options.tags);
    const testReports: TestReport[] = [];
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    
    // Report suite start
    this.reporter.onSuiteStart({
      suiteName: suite.name,
      totalTests: testCases.length * environments.length,
      environments: environments.map(e => e.name)
    });
    
    // Create a batch of test executions
    const testExecutions: Array<() => Promise<TestReport>> = [];
    
    for (const testCase of testCases) {
      for (const environment of environments) {
        // Create a function that will execute the test when called
        const executeTest = async (): Promise<TestReport> => {
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
            let testReport: TestReport | null = null;
            let success = false;
            let error: Error | null = null;
            
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
                error = err as Error;
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
    
    // Create the suite result
    return {
      suiteName: suite.name,
      totalTests: testCases.length * environments.length,
      passedTests,
      failedTests,
      skippedTests,
      testReports
    };
  }
  
  /**
   * Filter test cases by tags
   */
  private filterTestCases(testCases: TestCase[], tags?: string[]): TestCase[] {
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
  private countTestCases(suites: TestSuite[], tags?: string[]): number {
    return suites.reduce((count, suite) => {
      return count + this.filterTestCases(suite.testCases, tags).length;
    }, 0);
  }
  
  /**
   * Execute functions in batches with specified concurrency
   */
  private async executeInBatches<T>(
    fns: Array<() => Promise<T>>, 
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    
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
  private calculateSummary(
    suiteResults: SuiteResult[],
    startTime: number,
    endTime: number,
    duration: number
  ): TestRunResult['summary'] {
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