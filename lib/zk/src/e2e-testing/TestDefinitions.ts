/**
 * TestDefinitions.ts
 * 
 * Defines the structure of E2E test suites and test cases.
 * This module provides the interfaces and types needed to define
 * comprehensive end-to-end tests for the ZK proof system.
 */

import { TestReport, TestStepReport } from './TestEnvironmentManager';

export interface TestStep {
  name: string;
  execute: (report: TestReport, stepReport: TestStepReport) => Promise<boolean>;
  // If timeout is not specified, the test case's timeout will be used
  timeoutMs?: number;
  // Skip this step if previous steps have failed
  skipOnPreviousFailure?: boolean;
  // Skip this step based on a condition
  skipCondition?: (report: TestReport) => boolean;
  // Cleanup function to run after this step, regardless of success/failure
  cleanup?: () => Promise<void>;
}

export interface TestCase {
  name: string;
  description?: string;
  // Tags for filtering tests
  tags?: string[];
  // Steps to execute in order
  steps: TestStep[];
  // Default timeout for each step
  defaultStepTimeoutMs?: number;
  // Setup function to run before the test case
  setup?: () => Promise<void>;
  // Teardown function to run after the test case, regardless of success/failure
  teardown?: () => Promise<void>;
  // Skip this test case based on a condition
  skipCondition?: () => boolean;
  // Skip this test case in specific environments
  skipInEnvironments?: string[];
  // Performance metrics to collect
  collectMetrics?: {
    proofGenerationTime?: boolean;
    verificationTime?: boolean;
    memoryUsage?: boolean;
    cpuUsage?: boolean;
    networkTime?: boolean;
  };
}

export interface TestSuite {
  name: string;
  description?: string;
  testCases: TestCase[];
  // Setup function to run once before all test cases in the suite
  setup?: () => Promise<void>;
  // Teardown function to run once after all test cases in the suite
  teardown?: () => Promise<void>;
}

/**
 * Helper function to create a test suite
 */
export function createTestSuite(suite: TestSuite): TestSuite {
  return suite;
}

/**
 * Helper function to create a test case
 */
export function createTestCase(testCase: TestCase): TestCase {
  return testCase;
}

/**
 * Helper function to create a test step
 */
export function createTestStep(step: TestStep): TestStep {
  return step;
}

/**
 * Common test steps that can be reused across test cases
 */
export const CommonSteps = {
  /**
   * Connect wallet step
   */
  connectWallet: (walletType: string): TestStep => ({
    name: 'Connect wallet',
    execute: async (report, stepReport) => {
      try {
        // Implementation would connect to the specified wallet type
        // This is a placeholder that would be replaced with actual wallet connection code
        
        // Record data about the connection
        stepReport.data = { walletType, connected: true };
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to connect ${walletType} wallet: ${(error as Error).message}`;
        return false;
      }
    }
  }),
  
  /**
   * Generate proof step
   */
  generateProof: (proofType: string, parameters: any): TestStep => ({
    name: `Generate ${proofType} proof`,
    execute: async (report, stepReport) => {
      try {
        const startTime = performance.now();
        
        // Implementation would generate the specified proof with the given parameters
        // This is a placeholder that would be replaced with actual proof generation code
        
        const endTime = performance.now();
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
        stepReport.failureReason = `Failed to generate ${proofType} proof: ${(error as Error).message}`;
        return false;
      }
    }
  }),
  
  /**
   * Verify proof step
   */
  verifyProof: (onChain: boolean): TestStep => ({
    name: `Verify proof ${onChain ? 'on-chain' : 'off-chain'}`,
    execute: async (report, stepReport) => {
      try {
        const startTime = performance.now();
        
        // Implementation would verify the proof (either on-chain or off-chain)
        // This is a placeholder that would be replaced with actual proof verification code
        
        const endTime = performance.now();
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
        stepReport.failureReason = `Failed to verify proof ${onChain ? 'on-chain' : 'off-chain'}: ${(error as Error).message}`;
        return false;
      }
    }
  }),
  
  /**
   * Create transaction step
   */
  createTransaction: (transactionType: string, parameters: any): TestStep => ({
    name: `Create ${transactionType} transaction`,
    execute: async (report, stepReport) => {
      try {
        // Implementation would create the specified transaction with the given parameters
        // This is a placeholder that would be replaced with actual transaction creation code
        
        // Record data about the transaction
        stepReport.data = { transactionType, parameters };
        
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to create ${transactionType} transaction: ${(error as Error).message}`;
        return false;
      }
    }
  }),
  
  /**
   * Submit transaction step
   */
  submitTransaction: (): TestStep => ({
    name: 'Submit transaction',
    execute: async (report, stepReport) => {
      try {
        const startTime = performance.now();
        
        // Implementation would submit the transaction
        // This is a placeholder that would be replaced with actual transaction submission code
        
        const endTime = performance.now();
        const networkTime = endTime - startTime;
        
        // Record performance data
        stepReport.data = { networkTime };
        
        // Update performance metrics in the report
        report.performance.totalNetworkTime = (report.performance.totalNetworkTime || 0) + networkTime;
        
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to submit transaction: ${(error as Error).message}`;
        return false;
      }
    }
  }),
  
  /**
   * Wait for confirmation step
   */
  waitForConfirmation: (timeoutMs: number = 30000): TestStep => ({
    name: 'Wait for confirmation',
    timeoutMs,
    execute: async (report, stepReport) => {
      try {
        const startTime = performance.now();
        
        // Implementation would wait for transaction confirmation
        // This is a placeholder that would be replaced with actual confirmation code
        
        const endTime = performance.now();
        const waitTime = endTime - startTime;
        
        // Record data about the confirmation
        stepReport.data = { waitTime };
        
        return true;
      } catch (error) {
        stepReport.failureReason = `Failed to confirm transaction: ${(error as Error).message}`;
        return false;
      }
    }
  })
};