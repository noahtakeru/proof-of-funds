/**
 * Report generator for ZK test results
 * Generates HTML and JSON reports from test results
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Report generator for test results
 */
class ReportGenerator {
    /**
     * Create a new ReportGenerator instance
     * @param {Object} options - Configuration options
     * @param {string} options.outputDir - Output directory for reports
     * @param {boolean} options.generateHtml - Whether to generate HTML reports
     * @param {boolean} options.generateJson - Whether to generate JSON reports
     * @param {string} options.reportTitle - Title for the report
     */
    constructor(options = {}) {
        this.outputDir = options.outputDir || 'results';
        this.generateHtml = options.generateHtml !== false;
        this.generateJson = options.generateJson !== false;
        this.reportTitle = options.reportTitle || 'ZK Test Results';

        // Ensure output directory is absolute
        if (!path.isAbsolute(this.outputDir)) {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            this.outputDir = path.resolve(__dirname, '../../', this.outputDir);
        }

        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generate reports for test results
     * @param {Object} results - Test results to generate reports for
     * @param {string} name - Name of the test suite
     * @returns {Object} Paths to generated reports
     */
    generateReport(results, name) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePrefix = `${name}-${timestamp}`;
        const reports = {};

        // Save JSON report
        if (this.generateJson) {
            const jsonFile = path.join(this.outputDir, `${filePrefix}.json`);
            fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));
            reports.json = jsonFile;
        }

        // Generate HTML report
        if (this.generateHtml) {
            const htmlFile = path.join(this.outputDir, `${filePrefix}.html`);
            const html = this.generateHtmlReport(results, name);
            fs.writeFileSync(htmlFile, html);
            reports.html = htmlFile;
        }

        return reports;
    }

    /**
     * Generate HTML report from test results
     * @param {Object} results - Test results
     * @param {string} name - Name of the test suite
     * @returns {string} HTML report
     */
    generateHtmlReport(results, name) {
        const title = `${this.reportTitle}: ${name}`;
        const timestamp = new Date().toISOString();

        // Generate summary stats
        const summary = this.generateSummary(results);

        // Start building HTML
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 { 
      color: #0066cc; 
      margin-top: 1.5em;
    }
    .summary {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 30px;
      gap: 20px;
    }
    .summary-card {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 15px;
      min-width: 200px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-title {
      font-size: 0.9em;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 5px;
    }
    .summary-value {
      font-size: 1.8em;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 0.9em;
    }
    th, td {
      padding: 12px 15px;
      border-bottom: 1px solid #ddd;
      text-align: left;
    }
    th {
      background-color: #f8f8f8;
      font-weight: bold;
    }
    tr:hover {
      background-color: #f1f1f1;
    }
    .success { color: #28a745; }
    .warning { color: #ffc107; }
    .danger { color: #dc3545; }
    .metric-bar {
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin: 5px 0;
    }
    .metric-fill {
      height: 100%;
      background: linear-gradient(90deg, #0066cc, #4da6ff);
    }
    .chart-container {
      width: 100%;
      height: 300px;
      margin: 30px 0;
    }
    @media (max-width: 768px) {
      .summary { flex-direction: column; }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated on ${timestamp}</p>
  
  <div class="summary">
    ${this.renderSummaryCards(summary)}
  </div>
  
  <h2>Test Results</h2>
  ${this.renderResultTables(results)}
  
  <h2>Performance Metrics</h2>
  <div class="chart-container">
    <canvas id="performanceChart"></canvas>
  </div>
  
  <script>
    ${this.generateChartScript(results)}
  </script>
</body>
</html>`;

        return html;
    }

    /**
     * Generate summary statistics from test results
     * @param {Object} results - Test results
     * @returns {Object} Summary statistics
     */
    generateSummary(results) {
        const summary = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0,
            startTime: null,
            endTime: null,
        };

        // Simplified handling - adapt based on your actual results structure
        if (results.tests) {
            summary.totalTests = results.tests.length;
            summary.passedTests = results.tests.filter(t => t.status === 'passed').length;
            summary.failedTests = results.tests.filter(t => t.status === 'failed').length;
            summary.skippedTests = results.tests.filter(t => t.status === 'skipped').length;

            const executionTimes = results.tests
                .filter(t => t.executionTime)
                .map(t => t.executionTime);

            summary.totalExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0);
            summary.averageExecutionTime = executionTimes.length > 0
                ? summary.totalExecutionTime / executionTimes.length
                : 0;
        }

        if (results.startTime) summary.startTime = results.startTime;
        if (results.endTime) summary.endTime = results.endTime;

        return summary;
    }

    /**
     * Render summary cards HTML
     * @param {Object} summary - Summary statistics
     * @returns {string} HTML for summary cards
     */
    renderSummaryCards(summary) {
        const cards = [
            {
                title: 'Total Tests',
                value: summary.totalTests,
            },
            {
                title: 'Passed',
                value: summary.passedTests,
                class: 'success'
            },
            {
                title: 'Failed',
                value: summary.failedTests,
                class: 'danger'
            },
            {
                title: 'Average Time',
                value: `${summary.averageExecutionTime.toFixed(2)}ms`,
            },
            {
                title: 'Total Time',
                value: `${(summary.totalExecutionTime / 1000).toFixed(2)}s`,
            }
        ];

        return cards.map(card => `
      <div class="summary-card">
        <div class="summary-title">${card.title}</div>
        <div class="summary-value ${card.class || ''}">${card.value}</div>
      </div>
    `).join('');
    }

    /**
     * Render result tables HTML
     * @param {Object} results - Test results
     * @returns {string} HTML for result tables
     */
    renderResultTables(results) {
        if (!results.tests || results.tests.length === 0) {
            return '<p>No test results available.</p>';
        }

        let html = `
      <table>
        <thead>
          <tr>
            <th>Test</th>
            <th>Status</th>
            <th>Execution Time</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
    `;

        results.tests.forEach(test => {
            const statusClass =
                test.status === 'passed' ? 'success' :
                    test.status === 'failed' ? 'danger' : 'warning';

            html += `
        <tr>
          <td>${test.name}</td>
          <td class="${statusClass}">${test.status}</td>
          <td>${test.executionTime ? `${test.executionTime}ms` : 'N/A'}</td>
          <td>${test.details || '-'}</td>
        </tr>
      `;
        });

        html += `
        </tbody>
      </table>
    `;

        return html;
    }

    /**
     * Generate JavaScript for charts
     * @param {Object} results - Test results
     * @returns {string} JavaScript code for charts
     */
    generateChartScript(results) {
        // Simplified chart script - adapt based on your actual results structure
        return `
      // Sample data - replace with actual metrics from results
      const ctx = document.getElementById('performanceChart').getContext('2d');
      
      // Extract data from results if available
      const labels = ${JSON.stringify(results.tests?.map(t => t.name) || [])};
      const executionTimes = ${JSON.stringify(results.tests?.map(t => t.executionTime) || [])};
      
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Execution Time (ms)',
            data: executionTimes,
            backgroundColor: 'rgba(0, 102, 204, 0.7)',
            borderColor: '#0066cc',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Time (ms)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Test'
              }
            }
          }
        }
      });
    `;
    }

    /**
     * Compare current results with baseline
     * @param {Object} currentResults - Current test results
     * @param {string|Object} baseline - Baseline results (path to file or object)
     * @returns {Object} Comparison results
     */
    compareWithBaseline(currentResults, baseline) {
        let baselineResults;

        // Load baseline from file if string is provided
        if (typeof baseline === 'string') {
            try {
                const baselineContent = fs.readFileSync(baseline, 'utf8');
                baselineResults = JSON.parse(baselineContent);
            } catch (err) {
                console.error(`Error loading baseline: ${err.message}`);
                return { error: 'Failed to load baseline' };
            }
        } else {
            baselineResults = baseline;
        }

        // Perform comparison
        const comparison = {
            testResults: [],
            summary: {
                improved: 0,
                regressed: 0,
                unchanged: 0,
                added: 0,
                removed: 0,
            }
        };

        // Map baseline tests by name for easy lookup
        const baselineTestsMap = {};
        if (baselineResults.tests) {
            baselineResults.tests.forEach(test => {
                baselineTestsMap[test.name] = test;
            });
        }

        // Compare each current test with baseline
        if (currentResults.tests) {
            currentResults.tests.forEach(currentTest => {
                const baselineTest = baselineTestsMap[currentTest.name];

                if (!baselineTest) {
                    comparison.summary.added++;
                    comparison.testResults.push({
                        name: currentTest.name,
                        status: 'added',
                        current: currentTest.executionTime,
                        baseline: null,
                        difference: null,
                        percentChange: null
                    });
                } else {
                    // Compare execution times if available
                    if (currentTest.executionTime && baselineTest.executionTime) {
                        const diff = currentTest.executionTime - baselineTest.executionTime;
                        const percentChange = (diff / baselineTest.executionTime) * 100;

                        let status = 'unchanged';
                        if (percentChange < -5) status = 'improved';
                        else if (percentChange > 5) status = 'regressed';

                        comparison.summary[status]++;

                        comparison.testResults.push({
                            name: currentTest.name,
                            status,
                            current: currentTest.executionTime,
                            baseline: baselineTest.executionTime,
                            difference: diff,
                            percentChange
                        });
                    } else {
                        comparison.summary.unchanged++;
                    }
                }

                // Mark baseline test as processed
                delete baselineTestsMap[currentTest.name];
            });
        }

        // Add removed tests
        Object.values(baselineTestsMap).forEach(baselineTest => {
            comparison.summary.removed++;
            comparison.testResults.push({
                name: baselineTest.name,
                status: 'removed',
                current: null,
                baseline: baselineTest.executionTime,
                difference: null,
                percentChange: null
            });
        });

        return comparison;
    }

    /**
     * Generate a comparison report
     * @param {Object} comparison - Comparison results
     * @param {string} name - Name of the comparison
     * @returns {Object} Paths to generated reports
     */
    generateComparisonReport(comparison, name) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePrefix = `${name}-comparison-${timestamp}`;
        const reports = {};

        // Save JSON report
        if (this.generateJson) {
            const jsonFile = path.join(this.outputDir, `${filePrefix}.json`);
            fs.writeFileSync(jsonFile, JSON.stringify(comparison, null, 2));
            reports.json = jsonFile;
        }

        // Generate HTML report
        if (this.generateHtml) {
            const htmlFile = path.join(this.outputDir, `${filePrefix}.html`);
            const html = this.generateComparisonHtml(comparison, name);
            fs.writeFileSync(htmlFile, html);
            reports.html = htmlFile;
        }

        return reports;
    }

    /**
     * Generate HTML for comparison report
     * @param {Object} comparison - Comparison results
     * @param {string} name - Name of the comparison
     * @returns {string} HTML report
     */
    generateComparisonHtml(comparison, name) {
        // Implementation simplified for brevity
        // In a real implementation, this would generate detailed comparison HTML
        const title = `${this.reportTitle}: ${name} - Baseline Comparison`;

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 { color: #0066cc; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
      text-align: left;
    }
    th { background-color: #f8f8f8; }
    .improved { color: #28a745; }
    .regressed { color: #dc3545; }
    .unchanged { color: #6c757d; }
    .added { color: #17a2b8; }
    .removed { color: #ff9800; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Generated on ${new Date().toISOString()}</p>
  
  <h2>Summary</h2>
  <ul>
    <li><span class="improved">Improved: ${comparison.summary.improved}</span></li>
    <li><span class="regressed">Regressed: ${comparison.summary.regressed}</span></li>
    <li><span class="unchanged">Unchanged: ${comparison.summary.unchanged}</span></li>
    <li><span class="added">Added: ${comparison.summary.added}</span></li>
    <li><span class="removed">Removed: ${comparison.summary.removed}</span></li>
  </ul>
  
  <h2>Test Comparison</h2>
  <table>
    <thead>
      <tr>
        <th>Test</th>
        <th>Status</th>
        <th>Current (ms)</th>
        <th>Baseline (ms)</th>
        <th>Difference (ms)</th>
        <th>Change (%)</th>
      </tr>
    </thead>
    <tbody>
      ${comparison.testResults.map(result => `
        <tr>
          <td>${result.name}</td>
          <td class="${result.status}">${result.status}</td>
          <td>${result.current !== null ? result.current.toFixed(2) : 'N/A'}</td>
          <td>${result.baseline !== null ? result.baseline.toFixed(2) : 'N/A'}</td>
          <td>${result.difference !== null ? result.difference.toFixed(2) : 'N/A'}</td>
          <td>${result.percentChange !== null ? result.percentChange.toFixed(2) + '%' : 'N/A'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
    }
}

// Create default instance
const defaultReportGenerator = new ReportGenerator();

export { ReportGenerator };
export default defaultReportGenerator; 