/**
 * Test reporter utility for ZK tests
 * Generates formatted reports for test results
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

// Current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Report generator for ZK test results
 */
export class Reporter {
    /**
     * Create a new reporter instance
     * @param {Object} options - Reporter options
     * @param {string} options.outputDir - Directory to save reports
     * @param {boolean} options.verbose - Log verbose output
     * @param {string} options.format - Report format ('json', 'html', 'text')
     */
    constructor(options = {}) {
        this.outputDir = options.outputDir || path.join(__dirname, '../../reports');
        this.verbose = options.verbose || false;
        this.format = options.format || 'json';
        this.testResults = [];

        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
            if (this.verbose) {
                logger.info(`Created output directory: ${this.outputDir}`);
            }
        }
    }

    /**
     * Add a test result to the reporter
     * @param {Object} result - Test result object
     */
    addResult(result) {
        if (!result.timestamp) {
            result.timestamp = new Date().toISOString();
        }

        this.testResults.push(result);

        if (this.verbose) {
            logger.debug(`Added test result: ${result.name}`);
        }
    }

    /**
     * Add multiple test results
     * @param {Array<Object>} results - Array of test result objects 
     */
    addResults(results) {
        results.forEach(result => this.addResult(result));
    }

    /**
     * Generate summary statistics for test results
     * @returns {Object} Summary statistics
     */
    generateSummary() {
        const summary = {
            totalTests: this.testResults.length,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            executionTime: 0,
            avgExecutionTime: 0,
            startTime: null,
            endTime: null
        };

        this.testResults.forEach(result => {
            if (result.status === 'passed') summary.passedTests++;
            else if (result.status === 'failed') summary.failedTests++;
            else if (result.status === 'skipped') summary.skippedTests++;

            if (result.executionTime) {
                summary.executionTime += result.executionTime;
            }

            const timestamp = new Date(result.timestamp);
            if (!summary.startTime || timestamp < summary.startTime) {
                summary.startTime = timestamp;
            }
            if (!summary.endTime || timestamp > summary.endTime) {
                summary.endTime = timestamp;
            }
        });

        if (summary.totalTests > 0) {
            summary.avgExecutionTime = summary.executionTime / summary.totalTests;
        }

        return summary;
    }

    /**
     * Format test results as JSON
     * @returns {string} JSON-formatted results
     */
    formatAsJson() {
        const report = {
            summary: this.generateSummary(),
            results: this.testResults
        };

        return JSON.stringify(report, null, 2);
    }

    /**
     * Format test results as plain text
     * @returns {string} Text-formatted results
     */
    formatAsText() {
        const summary = this.generateSummary();
        let report = `ZK TEST REPORT - ${new Date().toISOString()}\n`;
        report += '='.repeat(50) + '\n\n';

        report += `SUMMARY:\n`;
        report += `---------\n`;
        report += `Total tests: ${summary.totalTests}\n`;
        report += `Passed: ${summary.passedTests}\n`;
        report += `Failed: ${summary.failedTests}\n`;
        report += `Skipped: ${summary.skippedTests}\n`;
        report += `Total execution time: ${summary.executionTime.toFixed(2)}ms\n`;
        report += `Average execution time: ${summary.avgExecutionTime.toFixed(2)}ms\n\n`;

        report += 'DETAILED RESULTS:\n';
        report += '----------------\n';

        this.testResults.forEach((result, index) => {
            report += `${index + 1}. ${result.name} - ${result.status.toUpperCase()}\n`;
            if (result.description) {
                report += `   Description: ${result.description}\n`;
            }
            if (result.executionTime) {
                report += `   Time: ${result.executionTime.toFixed(2)}ms\n`;
            }
            if (result.error) {
                report += `   Error: ${result.error}\n`;
            }
            report += '\n';
        });

        return report;
    }

    /**
     * Format test results as HTML
     * @returns {string} HTML-formatted results
     */
    formatAsHtml() {
        const summary = this.generateSummary();

        // Basic HTML template
        let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ZK Test Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .test-result { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
        .passed { border-left: 5px solid #4CAF50; }
        .failed { border-left: 5px solid #F44336; }
        .skipped { border-left: 5px solid #FFC107; }
        .error { color: #F44336; white-space: pre-wrap; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>ZK Test Report</h1>
      
      <div class="summary">
        <h2>Summary</h2>
        <table>
          <tr><td>Total tests:</td><td>${summary.totalTests}</td></tr>
          <tr><td>Passed:</td><td>${summary.passedTests}</td></tr>
          <tr><td>Failed:</td><td>${summary.failedTests}</td></tr>
          <tr><td>Skipped:</td><td>${summary.skippedTests}</td></tr>
          <tr><td>Total execution time:</td><td>${summary.executionTime.toFixed(2)}ms</td></tr>
          <tr><td>Average execution time:</td><td>${summary.avgExecutionTime.toFixed(2)}ms</td></tr>
        </table>
      </div>
      
      <h2>Detailed Results</h2>
    `;

        this.testResults.forEach(result => {
            html += `
      <div class="test-result ${result.status}">
        <h3>${result.name}</h3>
        <p><strong>Status:</strong> ${result.status.toUpperCase()}</p>
        ${result.description ? `<p><strong>Description:</strong> ${result.description}</p>` : ''}
        ${result.executionTime ? `<p><strong>Execution time:</strong> ${result.executionTime.toFixed(2)}ms</p>` : ''}
        ${result.error ? `<p><strong>Error:</strong></p><pre class="error">${result.error}</pre>` : ''}
        
        ${result.metrics ? this.formatMetricsHtml(result.metrics) : ''}
      </div>
      `;
        });

        html += `
    </body>
    </html>
    `;

        return html;
    }

    /**
     * Format metrics as HTML table
     * @param {Object} metrics - Test metrics
     * @returns {string} HTML for metrics table
     */
    formatMetricsHtml(metrics) {
        if (!metrics || Object.keys(metrics).length === 0) {
            return '';
        }

        let html = `
    <h4>Metrics</h4>
    <table>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
    `;

        Object.entries(metrics).forEach(([key, value]) => {
            html += `
      <tr>
        <td>${key}</td>
        <td>${typeof value === 'number' ? value.toFixed(2) : value}</td>
      </tr>
      `;
        });

        html += `</table>`;
        return html;
    }

    /**
     * Save report to a file
     * @param {string} filename - Optional filename (default: generated from date)
     * @returns {string} Path to the saved report file
     */
    saveReport(filename) {
        if (!filename) {
            const date = new Date().toISOString().replace(/[:.]/g, '-');
            filename = `zk-test-report-${date}`;
        }

        // Add appropriate extension if not present
        if (!filename.includes('.')) {
            if (this.format === 'json') filename += '.json';
            else if (this.format === 'html') filename += '.html';
            else filename += '.txt';
        }

        const reportPath = path.join(this.outputDir, filename);
        let content;

        // Generate content based on format
        if (this.format === 'json') {
            content = this.formatAsJson();
        } else if (this.format === 'html') {
            content = this.formatAsHtml();
        } else {
            content = this.formatAsText();
        }

        // Save to file
        fs.writeFileSync(reportPath, content);

        if (this.verbose) {
            logger.info(`Report saved to: ${reportPath}`);
        }

        return reportPath;
    }

    /**
     * Generate a comparison report between two test runs
     * @param {string} baselinePath - Path to baseline report file
     * @param {string} currentPath - Path to current report file (optional, uses this instance if not provided)
     * @returns {Object} Comparison results
     */
    compareWithBaseline(baselinePath, currentPath) {
        try {
            // Load baseline report
            const baselineContent = fs.readFileSync(baselinePath, 'utf8');
            const baseline = JSON.parse(baselineContent);

            // Load current report or use this instance
            let current;
            if (currentPath) {
                const currentContent = fs.readFileSync(currentPath, 'utf8');
                current = JSON.parse(currentContent);
            } else {
                current = {
                    summary: this.generateSummary(),
                    results: this.testResults
                };
            }

            // Compare summaries
            const comparison = {
                testCountDiff: current.summary.totalTests - baseline.summary.totalTests,
                passedDiff: current.summary.passedTests - baseline.summary.passedTests,
                failedDiff: current.summary.failedTests - baseline.summary.failedTests,
                executionTimeDiff: current.summary.executionTime - baseline.summary.executionTime,
                avgExecutionTimeDiff: current.summary.avgExecutionTime - baseline.summary.avgExecutionTime,
                tests: []
            };

            // Create a map of baseline tests by name
            const baselineTestMap = {};
            baseline.results.forEach(test => {
                baselineTestMap[test.name] = test;
            });

            // Compare individual tests
            current.results.forEach(test => {
                const baselineTest = baselineTestMap[test.name];
                const testComparison = {
                    name: test.name,
                    status: test.status,
                    inBaseline: !!baselineTest
                };

                if (baselineTest) {
                    testComparison.statusChanged = test.status !== baselineTest.status;
                    if (test.executionTime && baselineTest.executionTime) {
                        testComparison.executionTimeDiff = test.executionTime - baselineTest.executionTime;
                        testComparison.executionTimePercentChange =
                            ((test.executionTime - baselineTest.executionTime) / baselineTest.executionTime) * 100;
                    }

                    // Compare metrics if available
                    if (test.metrics && baselineTest.metrics) {
                        testComparison.metrics = {};
                        Object.keys(test.metrics).forEach(key => {
                            if (baselineTest.metrics[key] !== undefined) {
                                testComparison.metrics[key] = {
                                    current: test.metrics[key],
                                    baseline: baselineTest.metrics[key],
                                    diff: test.metrics[key] - baselineTest.metrics[key],
                                    percentChange:
                                        ((test.metrics[key] - baselineTest.metrics[key]) / baselineTest.metrics[key]) * 100
                                };
                            }
                        });
                    }
                }

                comparison.tests.push(testComparison);
            });

            // Find tests in baseline but not in current
            baseline.results.forEach(test => {
                const found = current.results.some(t => t.name === test.name);
                if (!found) {
                    comparison.tests.push({
                        name: test.name,
                        status: 'removed',
                        inBaseline: true,
                        inCurrent: false
                    });
                }
            });

            return comparison;
        } catch (error) {
            logger.error(`Failed to compare with baseline: ${error.message}`);
            return null;
        }
    }
}

/**
 * Create a new reporter instance with default options
 * @param {Object} options - Reporter options
 * @returns {Reporter} New reporter instance
 */
export function createReporter(options = {}) {
    return new Reporter(options);
}

// Default export
export default createReporter; 