/**
 * WorkflowExecutor.ts
 * 
 * Executes test workflows defined as sequences of steps.
 * This class handles the actual execution of test cases, including timeouts,
 * performance tracking, and reporting.
 */

import { TestCase } from './TestDefinitions';
import { 
  TestEnvironmentManager, 
  TestReport, 
  TestStepReport 
} from './TestEnvironmentManager';

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class WorkflowExecutor {
  constructor(private environmentManager: TestEnvironmentManager) {}
  
  /**
   * Execute a test workflow (test case) and record results in the test report
   */
  async executeWorkflow(
    testCase: TestCase, 
    report: TestReport, 
    globalTimeoutMs: number
  ): Promise<void> {
    const defaultStepTimeout = testCase.defaultStepTimeoutMs || 30000; // 30 second default
    
    try {
      // Run test case setup if defined
      if (testCase.setup) {
        await testCase.setup();
      }
      
      let allStepsSuccessful = true;
      
      // Execute each step in sequence
      for (const step of testCase.steps) {
        // Check if we should skip this step
        const skipDueToPreviousFailure = step.skipOnPreviousFailure && !allStepsSuccessful;
        const skipDueToCondition = step.skipCondition && step.skipCondition(report);
        
        if (skipDueToPreviousFailure || skipDueToCondition) {
          // Create a skipped step report
          const stepReport = this.environmentManager.addTestStep(report, step.name);
          this.environmentManager.completeTestStep(
            report, 
            stepReport.stepId, 
            true, // Mark as successful even though skipped
            { skipped: true, reason: skipDueToPreviousFailure ? 'Previous step failed' : 'Skip condition met' }
          );
          continue;
        }
        
        // Create the step report
        const stepReport = this.environmentManager.addTestStep(report, step.name);
        
        try {
          // Execute the step with timeout
          const timeoutMs = step.timeoutMs || defaultStepTimeout;
          const success = await this.executeStepWithTimeout(step, report, stepReport, timeoutMs);
          
          if (!success) {
            allStepsSuccessful = false;
          }
        } catch (error) {
          // Handle step execution errors
          this.environmentManager.completeTestStep(
            report, 
            stepReport.stepId, 
            false, 
            { error: (error as Error).message }, 
            (error as Error).message
          );
          
          allStepsSuccessful = false;
        } finally {
          // Run step cleanup if defined
          if (step.cleanup) {
            try {
              await step.cleanup();
            } catch (cleanupError) {
              console.error(`Error in step cleanup: ${(cleanupError as Error).message}`);
            }
          }
        }
      }
      
      // Complete the test report
      this.environmentManager.completeTestReport(report, allStepsSuccessful);
    } catch (error) {
      // Handle workflow execution errors
      this.environmentManager.completeTestReport(
        report, 
        false, 
        {}, 
        `Workflow execution error: ${(error as Error).message}`
      );
    } finally {
      // Run test case teardown if defined
      if (testCase.teardown) {
        try {
          await testCase.teardown();
        } catch (teardownError) {
          console.error(`Error in test teardown: ${(teardownError as Error).message}`);
        }
      }
    }
  }
  
  /**
   * Execute a single step with timeout
   */
  private async executeStepWithTimeout(
    step: { name: string; execute: (report: TestReport, stepReport: TestStepReport) => Promise<boolean> }, 
    report: TestReport, 
    stepReport: TestStepReport, 
    timeoutMs: number
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(`Step "${step.name}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      // Execute the step
      step.execute(report, stepReport)
        .then(success => {
          clearTimeout(timeoutId);
          
          // Complete the step report
          this.environmentManager.completeTestStep(
            report, 
            stepReport.stepId, 
            success, 
            stepReport.data,
            success ? undefined : stepReport.failureReason
          );
          
          resolve(success);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}