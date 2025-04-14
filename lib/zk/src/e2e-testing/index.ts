/**
 * E2E Testing Framework
 * 
 * This module provides a comprehensive end-to-end testing framework for
 * the Proof of Funds application, with support for different environments,
 * detailed reporting, and workflow-based testing.
 */

// Export all components
export * from './TestEnvironmentManager';
export * from './E2ETestRunner';
export * from './TestDefinitions';
export * from './WorkflowExecutor';
export * from './E2EReporter';

// Also export a convenience function to create and configure a test runner
import { E2ETestRunner } from './E2ETestRunner';
import { E2EReporter, ReportFormat } from './E2EReporter';

/**
 * Create a pre-configured E2E test runner
 */
export function createTestRunner(options?: {
  reportFormats?: ReportFormat[];
  outputDir?: string;
  silent?: boolean;
}): E2ETestRunner {
  const runner = new E2ETestRunner();
  
  if (options) {
    const reporter = new E2EReporter({
      formats: options.reportFormats || ['json', 'console'],
      outputDir: options.outputDir || './reports',
      silent: options.silent || false
    });
    
    runner.setReporter(reporter);
  }
  
  return runner;
}