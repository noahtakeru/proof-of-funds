/**
 * @fileoverview Security Test Runner
 * 
 * A runner for executing security tests across the ZK proof system,
 * with configurable test suite selection and reporting options.
 * 
 * @author ZK Infrastructure Team
 * @created August 2024
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecurityTestSuite, type SecurityTestResult, type SecurityTestConfig } from './SecurityTestSuite';

/**
 * Test runner configuration
 */
export interface TestRunnerConfig {
    /** Base directory for test outputs */
    outputBaseDir?: string;
    /** Whether to generate HTML reports */
    generateHtmlReports?: boolean;
    /** Whether to run tests in verbose mode */
    verbose?: boolean;
    /** Path to custom test configuration */
    configPath?: string;
    /** List of specific test categories to run */
    categories?: string[];
    /** List of test categories to exclude */
    excludeCategories?: string[];
    /** Custom implementation paths to test */
    implementationPaths?: string[];
}

/**
 * Security Test Runner class
 * 
 * Orchestrates running multiple security test suites and aggregating results
 */
export class SecurityTestRunner {
    private config: TestRunnerConfig;
    private outputDir: string;
    private testConfigs: { [key: string]: SecurityTestConfig };
    private results: SecurityTestResult[] = [];

    /**
     * Creates a new Security Test Runner
     * @param config - Test runner configuration
     */
    constructor(config: TestRunnerConfig = {}) {
        this.config = {
            outputBaseDir: config.outputBaseDir || './security-test-results',
            generateHtmlReports: config.generateHtmlReports !== undefined ? config.generateHtmlReports : true,
            verbose: config.verbose || false,
            categories: config.categories || ['all'],
            excludeCategories: config.excludeCategories || [],
            implementationPaths: config.implementationPaths || []
        };

        // Create output directory with timestamp
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        this.outputDir = path.join(
            this.config.outputBaseDir || '.',
            `security-tests-${timestamp}`
        );

        // Load test configurations
        this.testConfigs = this.loadTestConfigs(config.configPath);

        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        this.log('Security Test Runner initialized');
    }

    /**
     * Run all security tests
     * @returns Promise resolving to aggregated test results
     */
    public async run(): Promise<SecurityTestResult[]> {
        this.log('Starting security test run');
        this.results = [];

        try {
            // Run tests for each configuration
            for (const [testName, testConfig] of Object.entries(this.testConfigs)) {
                // Skip if test category is not included or is excluded
                if (!this.shouldRunTest(testConfig)) {
                    this.log(`Skipping test: ${testName}`);
                    continue;
                }

                this.log(`Running test: ${testName}`);

                // Configure test with output directory
                const configWithOutput = {
                    ...testConfig,
                    outputDir: path.join(this.outputDir, testName),
                    verbose: this.config.verbose
                };

                // Create test suite
                const testSuite = new SecurityTestSuite(configWithOutput);

                // Run test
                let testResults: SecurityTestResult[];
                if (configWithOutput.implementationPath) {
                    // Single implementation test
                    const result = await testSuite.validateSecurity(configWithOutput.implementationPath);
                    testResults = [result];
                } else {
                    // Multi-test suite
                    testResults = await testSuite.runSecurityChecks();
                }

                // Save results
                this.results.push(...testResults);
                this.log(`Completed test: ${testName} - ${testResults.length} results`);
            }

            // Run tests for each implementation path if specified
            for (const implPath of (this.config.implementationPaths || [])) {
                this.log(`Testing implementation: ${implPath}`);

                // Configure test with output directory
                const configWithOutput = {
                    outputDir: path.join(this.outputDir, path.basename(implPath)),
                    verbose: this.config.verbose
                };

                // Create test suite and run test
                const testSuite = new SecurityTestSuite(configWithOutput);
                const result = await testSuite.validateSecurity(implPath);

                // Save result
                this.results.push(result);
                this.log(`Completed implementation test: ${implPath} - ${result.passed ? 'PASSED' : 'FAILED'}`);
            }

            // Generate summary report
            if (this.config.generateHtmlReports) {
                this.generateSummaryReport();
            }

            return this.results;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`Error running security tests: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get test results
     * @returns Array of test results
     */
    public getResults(): SecurityTestResult[] {
        return this.results;
    }

    /**
     * Load test configurations from file or use defaults
     * @param configPath - Path to configuration file
     * @returns Object with test configurations
     * @private
     */
    private loadTestConfigs(configPath?: string): { [key: string]: SecurityTestConfig } {
        if (configPath && fs.existsSync(configPath)) {
            try {
                const fileContent = fs.readFileSync(configPath, 'utf8');
                return JSON.parse(fileContent);
            } catch (error) {
                this.log(`Error loading config file: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Default configurations
        return {
            'core-validation': {
                includeCategories: ['core', 'validation'],
                excludeCategories: [],
                iterations: 10
            },
            'attack-vectors': {
                includeCategories: ['attack', 'security'],
                excludeCategories: [],
                iterations: 5
            },
            'performance-security': {
                includeCategories: ['performance', 'security'],
                excludeCategories: [],
                iterations: 3
            }
        };
    }

    /**
     * Check if a test should be run based on categories
     * @param testConfig - Test configuration
     * @returns Whether the test should be run
     * @private
     */
    private shouldRunTest(testConfig: SecurityTestConfig): boolean {
        // If no categories specified or 'all' is included, run all tests
        if (!this.config.categories || this.config.categories.includes('all')) {
            // Unless the test is explicitly excluded
            if (this.config.excludeCategories && testConfig.includeCategories) {
                return !testConfig.includeCategories.some(
                    category => this.config.excludeCategories?.includes(category)
                );
            }
            return true;
        }

        // Check if any of the test's categories match the requested categories
        if (testConfig.includeCategories) {
            const hasMatchingCategory = testConfig.includeCategories.some(
                category => this.config.categories?.includes(category)
            );

            if (!hasMatchingCategory) {
                return false;
            }
        }

        // Check if any of the test's categories are in the excluded list
        if (this.config.excludeCategories && testConfig.includeCategories) {
            const isExcluded = testConfig.includeCategories.some(
                category => this.config.excludeCategories?.includes(category)
            );

            if (isExcluded) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate HTML summary report
     * @private
     */
    private generateSummaryReport(): void {
        if (!this.results.length) {
            this.log('No results to generate report from');
            return;
        }

        try {
            const reportPath = path.join(this.outputDir, 'summary-report.html');

            // Count passed and failed tests
            const passedCount = this.results.filter(r => r.passed).length;
            const failedCount = this.results.filter(r => !r.passed).length;
            const totalCount = this.results.length;
            const passRate = totalCount > 0 ? (passedCount / totalCount) * 100 : 0;

            // Get all unique vulnerabilities
            const allVulnerabilities = Array.from(
                new Set(
                    this.results
                        .flatMap(r => r.vulnerabilities)
                        .filter(Boolean)
                )
            );

            // Get all unique recommendations
            const allRecommendations = Array.from(
                new Set(
                    this.results
                        .flatMap(r => r.recommendations)
                        .filter(Boolean)
                )
            );

            // Generate HTML content
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Security Test Summary Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                    h1, h2, h3 { color: #333; }
                    .summary { 
                        background-color: #f5f5f5; 
                        padding: 20px; 
                        border-radius: 5px; 
                        margin: 20px 0; 
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    }
                    .metrics {
                        display: flex;
                        justify-content: space-between;
                        flex-wrap: wrap;
                        margin: 20px 0;
                    }
                    .metric {
                        background-color: #fff;
                        border-radius: 5px;
                        padding: 15px;
                        margin: 10px 0;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        flex-basis: 30%;
                    }
                    .metric h3 {
                        margin-top: 0;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 10px;
                    }
                    .pass-rate {
                        font-size: 2em;
                        font-weight: bold;
                        text-align: center;
                        margin: 10px 0;
                        color: ${passRate >= 80 ? '#4CAF50' : passRate >= 60 ? '#FF9800' : '#F44336'};
                    }
                    .test-list {
                        margin: 20px 0;
                    }
                    .test {
                        margin: 15px 0;
                        padding: 15px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                    }
                    .passed { border-left: 5px solid #4CAF50; }
                    .failed { border-left: 5px solid #F44336; }
                    .vulnerabilities, .recommendations {
                        background-color: #fff;
                        padding: 15px;
                        margin: 15px 0;
                        border-radius: 5px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    }
                    .vulnerabilities h3 {
                        color: #F44336;
                    }
                    .recommendations h3 {
                        color: #4CAF50;
                    }
                    ul { margin: 10px 0; padding-left: 20px; }
                    li { margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <h1>Security Test Summary Report</h1>
                <div class="summary">
                    <h2>Overview</h2>
                    <p>Generated: ${new Date().toISOString()}</p>
                    
                    <div class="metrics">
                        <div class="metric">
                            <h3>Tests Run</h3>
                            <div class="value">${totalCount}</div>
                        </div>
                        <div class="metric">
                            <h3>Tests Passed</h3>
                            <div class="value">${passedCount}</div>
                        </div>
                        <div class="metric">
                            <h3>Tests Failed</h3>
                            <div class="value">${failedCount}</div>
                        </div>
                    </div>
                    
                    <h3>Pass Rate</h3>
                    <div class="pass-rate">${passRate.toFixed(1)}%</div>
                </div>
                
                ${allVulnerabilities.length > 0 ? `
                <div class="vulnerabilities">
                    <h3>Identified Vulnerabilities</h3>
                    <ul>
                        ${allVulnerabilities.map(v => `<li>${v}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${allRecommendations.length > 0 ? `
                <div class="recommendations">
                    <h3>Security Recommendations</h3>
                    <ul>
                        ${allRecommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                <h2>Test Results</h2>
                <div class="test-list">
                    ${this.results.map(result => `
                        <div class="test ${result.passed ? 'passed' : 'failed'}">
                            <h3>${result.name} ${result.passed ? '✅' : '❌'}</h3>
                            ${result.description ? `<p>${result.description}</p>` : ''}
                            <p>Execution time: ${result.executionTime}ms</p>
                            <p>Criticality: ${result.criticality}/5</p>
                            
                            ${result.vulnerabilities && result.vulnerabilities.length > 0 ? `
                                <h4>Vulnerabilities</h4>
                                <ul>
                                    ${result.vulnerabilities.map(v => `<li>${v}</li>`).join('')}
                                </ul>
                            ` : ''}
                            
                            ${result.recommendations && result.recommendations.length > 0 ? `
                                <h4>Recommendations</h4>
                                <ul>
                                    ${result.recommendations.map(r => `<li>${r}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </body>
            </html>
            `;

            fs.writeFileSync(reportPath, html);
            this.log(`Generated summary report at: ${reportPath}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`Error generating summary report: ${errorMessage}`);
        }
    }

    /**
     * Log a message if verbose mode is enabled
     * @param message - Message to log
     * @private
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[SecurityTestRunner] ${message}`);
        }
    }
}

/**
 * Run security checks with default configuration
 * @returns Promise resolving to test results
 */
export async function runSecurityChecks(): Promise<SecurityTestResult[]> {
    const runner = new SecurityTestRunner({
        verbose: true,
        generateHtmlReports: true
    });

    return await runner.run();
} 