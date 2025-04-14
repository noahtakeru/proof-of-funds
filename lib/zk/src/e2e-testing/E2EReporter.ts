/**
 * E2EReporter.ts
 * 
 * Reporter for End-to-End Integration Tests.
 * This class generates detailed reports and analytics for test runs,
 * with support for different output formats and integrations.
 */

import { TestRunResult } from './E2ETestRunner';
import fs from 'fs';
import path from 'path';

// Event types for test lifecycle events
export interface RunStartEvent {
  suites: string[];
  environments: string[];
  totalTestCases: number;
  concurrency: number;
  timestamp: number;
}

export interface SuiteStartEvent {
  suiteName: string;
  totalTests: number;
  environments: string[];
}

export interface TestStartEvent {
  suiteName: string;
  testName: string;
  environmentName: string;
}

export interface TestRetryEvent extends TestStartEvent {
  attempt: number;
}

export interface TestPassEvent extends TestStartEvent {
  duration: number;
}

export interface TestFailEvent extends TestStartEvent {
  duration: number;
  error: string;
}

export interface SuiteCompleteEvent {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

// Report format types
export type ReportFormat = 'json' | 'markdown' | 'html' | 'console';

export interface ReporterOptions {
  outputDir?: string;
  formats?: ReportFormat[];
  silent?: boolean;
  writeReports?: boolean;
  reportPrefix?: string;
}

/**
 * Reporter for E2E tests with support for different output formats
 */
export class E2EReporter {
  private options: Required<ReporterOptions>;
  private runStartTime: number = 0;
  private suiteStartTimes: Map<string, number> = new Map();
  private testResults: Record<string, any> = {};
  
  constructor(options?: ReporterOptions) {
    this.options = {
      outputDir: options?.outputDir || './reports',
      formats: options?.formats || ['json', 'console'],
      silent: options?.silent || false,
      writeReports: options?.writeReports !== undefined ? options.writeReports : true,
      reportPrefix: options?.reportPrefix || 'e2e-report'
    };
  }
  
  /**
   * Called when a test run starts
   */
  onRunStart(event: RunStartEvent): void {
    this.runStartTime = event.timestamp;
    
    if (!this.options.silent) {
      console.log('┌─────────────────────────────────────────┐');
      console.log('│        E2E Test Run Starting            │');
      console.log('├─────────────────────────────────────────┤');
      console.log(`│ Suites: ${event.suites.length}          │`);
      console.log(`│ Environments: ${event.environments.length} │`);
      console.log(`│ Total Test Cases: ${event.totalTestCases} │`);
      console.log(`│ Concurrency: ${event.concurrency}       │`);
      console.log('└─────────────────────────────────────────┘');
    }
  }
  
  /**
   * Called when a test suite starts
   */
  onSuiteStart(event: SuiteStartEvent): void {
    this.suiteStartTimes.set(event.suiteName, Date.now());
    
    if (!this.options.silent) {
      console.log(`\n📋 Suite: ${event.suiteName}`);
      console.log(`   Tests: ${event.totalTests}`);
      console.log(`   Environments: ${event.environments.join(', ')}`);
      console.log('   ----------------------------------------');
    }
  }
  
  /**
   * Called when a test starts
   */
  onTestStart(event: TestStartEvent): void {
    const key = this.getTestKey(event);
    
    this.testResults[key] = {
      suiteName: event.suiteName,
      testName: event.testName,
      environmentName: event.environmentName,
      startTime: Date.now(),
      status: 'running'
    };
    
    if (!this.options.silent) {
      console.log(`   ▶️  ${event.testName} (${event.environmentName}) - Running...`);
    }
  }
  
  /**
   * Called when a test is retried
   */
  onTestRetry(event: TestRetryEvent): void {
    const key = this.getTestKey(event);
    
    if (this.testResults[key]) {
      this.testResults[key].retries = (this.testResults[key].retries || 0) + 1;
    }
    
    if (!this.options.silent) {
      console.log(`   🔄 ${event.testName} (${event.environmentName}) - Retry #${event.attempt}...`);
    }
  }
  
  /**
   * Called when a test passes
   */
  onTestPass(event: TestPassEvent): void {
    const key = this.getTestKey(event);
    
    if (this.testResults[key]) {
      this.testResults[key].status = 'passed';
      this.testResults[key].endTime = Date.now();
      this.testResults[key].duration = event.duration;
    }
    
    if (!this.options.silent) {
      console.log(`   ✅ ${event.testName} (${event.environmentName}) - Passed in ${this.formatDuration(event.duration)}`);
    }
  }
  
  /**
   * Called when a test fails
   */
  onTestFail(event: TestFailEvent): void {
    const key = this.getTestKey(event);
    
    if (this.testResults[key]) {
      this.testResults[key].status = 'failed';
      this.testResults[key].endTime = Date.now();
      this.testResults[key].duration = event.duration;
      this.testResults[key].error = event.error;
    }
    
    if (!this.options.silent) {
      console.log(`   ❌ ${event.testName} (${event.environmentName}) - Failed in ${this.formatDuration(event.duration)}`);
      console.log(`      Error: ${event.error}`);
    }
  }
  
  /**
   * Called when a suite completes
   */
  onSuiteComplete(event: SuiteCompleteEvent): void {
    const suiteStartTime = this.suiteStartTimes.get(event.suiteName) || 0;
    const duration = Date.now() - suiteStartTime;
    
    if (!this.options.silent) {
      console.log('   ----------------------------------------');
      console.log(`   Suite Result: ${event.passedTests}/${event.totalTests} tests passed`);
      console.log(`   Duration: ${this.formatDuration(duration)}`);
    }
  }
  
  /**
   * Called when a test run completes
   */
  onRunComplete(result: TestRunResult): void {
    const { summary } = result;
    
    if (!this.options.silent) {
      console.log('\n┌─────────────────────────────────────────┐');
      console.log('│        E2E Test Run Complete            │');
      console.log('├─────────────────────────────────────────┤');
      console.log(`│ Total Suites: ${summary.totalSuites}    │`);
      console.log(`│ Total Tests: ${summary.totalTests}      │`);
      console.log(`│ Passed: ${summary.passedTests}          │`);
      console.log(`│ Failed: ${summary.failedTests}          │`);
      console.log(`│ Skipped: ${summary.skippedTests}        │`);
      console.log(`│ Duration: ${this.formatDuration(summary.duration)} │`);
      console.log('└─────────────────────────────────────────┘');
    }
    
    // Write reports if enabled
    if (this.options.writeReports) {
      this.writeReports(result);
    }
  }
  
  /**
   * Write test reports in the specified formats
   */
  private writeReports(result: TestRunResult): void {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    
    // Generate reports in the specified formats
    for (const format of this.options.formats) {
      if (format === 'json') {
        this.writeJsonReport(result, timestamp);
      } else if (format === 'markdown') {
        this.writeMarkdownReport(result, timestamp);
      } else if (format === 'html') {
        this.writeHtmlReport(result, timestamp);
      }
      // 'console' format is handled by the event methods
    }
  }
  
  /**
   * Write a JSON report
   */
  private writeJsonReport(result: TestRunResult, timestamp: string): void {
    const filePath = path.join(
      this.options.outputDir, 
      `${this.options.reportPrefix}-${timestamp}.json`
    );
    
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    
    if (!this.options.silent) {
      console.log(`\nJSON report written to: ${filePath}`);
    }
  }
  
  /**
   * Write a Markdown report
   */
  private writeMarkdownReport(result: TestRunResult, timestamp: string): void {
    const filePath = path.join(
      this.options.outputDir, 
      `${this.options.reportPrefix}-${timestamp}.md`
    );
    
    const { summary } = result;
    
    let markdown = `# E2E Test Report\n\n`;
    markdown += `Generated: ${new Date(summary.startTime).toLocaleString()}\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Total Suites**: ${summary.totalSuites}\n`;
    markdown += `- **Total Tests**: ${summary.totalTests}\n`;
    markdown += `- **Passed**: ${summary.passedTests}\n`;
    markdown += `- **Failed**: ${summary.failedTests}\n`;
    markdown += `- **Skipped**: ${summary.skippedTests}\n`;
    markdown += `- **Duration**: ${this.formatDuration(summary.duration)}\n`;
    markdown += `- **Success Rate**: ${summary.totalTests > 0 ? ((summary.passedTests / summary.totalTests) * 100).toFixed(2) : 0}%\n\n`;
    
    markdown += `## Suite Results\n\n`;
    
    for (const suite of result.suiteResults) {
      markdown += `### ${suite.suiteName}\n\n`;
      markdown += `- **Total Tests**: ${suite.totalTests}\n`;
      markdown += `- **Passed**: ${suite.passedTests}\n`;
      markdown += `- **Failed**: ${suite.failedTests}\n`;
      markdown += `- **Skipped**: ${suite.skippedTests}\n\n`;
      
      if (suite.testReports.length > 0) {
        markdown += `#### Test Details\n\n`;
        markdown += `| Test | Environment | Result | Duration | Steps |\n`;
        markdown += `| ---- | ----------- | ------ | -------- | ----- |\n`;
        
        for (const report of suite.testReports) {
          const success = report.success ? '✅' : '❌';
          markdown += `| ${report.testName} | ${report.environment.name} | ${success} | ${this.formatDuration(report.duration)} | ${report.steps.length} |\n`;
        }
        
        markdown += `\n`;
      }
    }
    
    markdown += `## Performance Metrics\n\n`;
    
    if (result.analytics.performanceMetrics) {
      const metrics = result.analytics.performanceMetrics;
      
      for (const [metricName, metricData] of Object.entries(metrics)) {
        markdown += `### ${this.formatMetricName(metricName)}\n\n`;
        markdown += `- **Average**: ${this.formatDuration((metricData as any).avg)}\n`;
        markdown += `- **Min**: ${this.formatDuration((metricData as any).min)}\n`;
        markdown += `- **Max**: ${this.formatDuration((metricData as any).max)}\n`;
        markdown += `- **Total**: ${this.formatDuration((metricData as any).total)}\n\n`;
      }
    }
    
    markdown += `## Environment Breakdown\n\n`;
    
    if (result.analytics.environmentBreakdown) {
      markdown += `| Environment | Total | Passed | Failed | Success Rate |\n`;
      markdown += `| ----------- | ----- | ------ | ------ | ------------ |\n`;
      
      for (const [envName, envData] of Object.entries(result.analytics.environmentBreakdown)) {
        const total = (envData as any).total;
        const passed = (envData as any).successful;
        const failed = (envData as any).failed;
        const successRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0';
        
        markdown += `| ${envName} | ${total} | ${passed} | ${failed} | ${successRate}% |\n`;
      }
    }
    
    fs.writeFileSync(filePath, markdown);
    
    if (!this.options.silent) {
      console.log(`Markdown report written to: ${filePath}`);
    }
  }
  
  /**
   * Write an HTML report
   */
  private writeHtmlReport(result: TestRunResult, timestamp: string): void {
    const filePath = path.join(
      this.options.outputDir, 
      `${this.options.reportPrefix}-${timestamp}.html`
    );
    
    const { summary } = result;
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3, h4 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 2em;
    }
    .summary-item {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      flex: 1;
      min-width: 120px;
      text-align: center;
    }
    .summary-item h3 {
      margin: 0;
      font-size: 14px;
      text-transform: uppercase;
      color: #666;
    }
    .summary-item p {
      margin: 5px 0 0;
      font-size: 24px;
      font-weight: bold;
    }
    .success {
      color: #28a745;
    }
    .failure {
      color: #dc3545;
    }
    .progress-bar {
      height: 10px;
      background-color: #e9ecef;
      border-radius: 5px;
      margin-top: 10px;
    }
    .progress {
      height: 100%;
      border-radius: 5px;
      background-color: #28a745;
    }
    .test-details {
      margin-top: 1em;
    }
    .test-details details {
      margin-bottom: 0.5em;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 10px;
    }
    .test-details summary {
      cursor: pointer;
      padding: 5px;
      font-weight: bold;
    }
    .environment-breakdown, .performance-metrics {
      margin-top: 2em;
    }
  </style>
</head>
<body>
  <h1>E2E Test Report</h1>
  <p>Generated: ${new Date(summary.startTime).toLocaleString()}</p>
  
  <h2>Summary</h2>
  <div class="summary">
    <div class="summary-item">
      <h3>Total Suites</h3>
      <p>${summary.totalSuites}</p>
    </div>
    <div class="summary-item">
      <h3>Total Tests</h3>
      <p>${summary.totalTests}</p>
    </div>
    <div class="summary-item">
      <h3>Passed</h3>
      <p class="success">${summary.passedTests}</p>
    </div>
    <div class="summary-item">
      <h3>Failed</h3>
      <p class="failure">${summary.failedTests}</p>
    </div>
    <div class="summary-item">
      <h3>Skipped</h3>
      <p>${summary.skippedTests}</p>
    </div>
    <div class="summary-item">
      <h3>Duration</h3>
      <p>${this.formatDuration(summary.duration)}</p>
    </div>
  </div>
  
  <div class="progress-bar">
    <div class="progress" style="width: ${summary.totalTests > 0 ? (summary.passedTests / summary.totalTests) * 100 : 0}%"></div>
  </div>
  <p>Success Rate: ${summary.totalTests > 0 ? ((summary.passedTests / summary.totalTests) * 100).toFixed(2) : 0}%</p>
  
  <h2>Suite Results</h2>`;
  
  for (const suite of result.suiteResults) {
    html += `
  <h3>${suite.suiteName}</h3>
  <div class="summary">
    <div class="summary-item">
      <h3>Total Tests</h3>
      <p>${suite.totalTests}</p>
    </div>
    <div class="summary-item">
      <h3>Passed</h3>
      <p class="success">${suite.passedTests}</p>
    </div>
    <div class="summary-item">
      <h3>Failed</h3>
      <p class="failure">${suite.failedTests}</p>
    </div>
    <div class="summary-item">
      <h3>Skipped</h3>
      <p>${suite.skippedTests}</p>
    </div>
  </div>
  
  <div class="progress-bar">
    <div class="progress" style="width: ${suite.totalTests > 0 ? (suite.passedTests / suite.totalTests) * 100 : 0}%"></div>
  </div>
  
  <h4>Test Details</h4>
  <div class="test-details">
    <table>
      <thead>
        <tr>
          <th>Test</th>
          <th>Environment</th>
          <th>Result</th>
          <th>Duration</th>
          <th>Steps</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>`;
    
    for (const report of suite.testReports) {
      const success = report.success ? '✅ Pass' : '❌ Fail';
      const statusClass = report.success ? 'success' : 'failure';
      
      html += `
        <tr>
          <td>${report.testName}</td>
          <td>${report.environment.name}</td>
          <td class="${statusClass}">${success}</td>
          <td>${this.formatDuration(report.duration)}</td>
          <td>${report.steps.length}</td>
          <td>
            <details>
              <summary>Steps</summary>
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Status</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>`;
      
      for (const step of report.steps) {
        const stepSuccess = step.success ? '✅ Pass' : '❌ Fail';
        const stepStatusClass = step.success ? 'success' : 'failure';
        
        html += `
                  <tr>
                    <td>${step.stepName}</td>
                    <td class="${stepStatusClass}">${stepSuccess}</td>
                    <td>${this.formatDuration(step.duration)}</td>
                  </tr>`;
      }
      
      html += `
                </tbody>
              </table>
            </details>
          </td>
        </tr>`;
    }
    
    html += `
      </tbody>
    </table>
  </div>`;
  }
  
  html += `
  <h2>Performance Metrics</h2>
  <div class="performance-metrics">`;
  
  if (result.analytics.performanceMetrics) {
    const metrics = result.analytics.performanceMetrics;
    
    html += `
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Average</th>
          <th>Min</th>
          <th>Max</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>`;
    
    for (const [metricName, metricData] of Object.entries(metrics)) {
      html += `
        <tr>
          <td>${this.formatMetricName(metricName)}</td>
          <td>${this.formatDuration((metricData as any).avg)}</td>
          <td>${this.formatDuration((metricData as any).min)}</td>
          <td>${this.formatDuration((metricData as any).max)}</td>
          <td>${this.formatDuration((metricData as any).total)}</td>
        </tr>`;
    }
    
    html += `
      </tbody>
    </table>`;
  }
  
  html += `
  </div>
  
  <h2>Environment Breakdown</h2>
  <div class="environment-breakdown">`;
  
  if (result.analytics.environmentBreakdown) {
    html += `
    <table>
      <thead>
        <tr>
          <th>Environment</th>
          <th>Total</th>
          <th>Passed</th>
          <th>Failed</th>
          <th>Success Rate</th>
        </tr>
      </thead>
      <tbody>`;
    
    for (const [envName, envData] of Object.entries(result.analytics.environmentBreakdown)) {
      const total = (envData as any).total;
      const passed = (envData as any).successful;
      const failed = (envData as any).failed;
      const successRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0';
      
      html += `
        <tr>
          <td>${envName}</td>
          <td>${total}</td>
          <td>${passed}</td>
          <td>${failed}</td>
          <td>${successRate}%</td>
        </tr>`;
    }
    
    html += `
      </tbody>
    </table>`;
  }
  
  html += `
  </div>
  
</body>
</html>`;
    
    fs.writeFileSync(filePath, html);
    
    if (!this.options.silent) {
      console.log(`HTML report written to: ${filePath}`);
    }
  }
  
  /**
   * Format a duration in milliseconds to a human-readable string
   */
  private formatDuration(durationMs: number): string {
    if (durationMs < 1000) {
      return `${durationMs.toFixed(0)}ms`;
    } else if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  }
  
  /**
   * Format a metric name for display
   */
  private formatMetricName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  }
  
  /**
   * Get a unique key for a test
   */
  private getTestKey(event: TestStartEvent): string {
    return `${event.suiteName}:${event.testName}:${event.environmentName}`;
  }
}