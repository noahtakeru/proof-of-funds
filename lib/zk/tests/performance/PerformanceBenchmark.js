// Performance benchmarking framework for ZK proof system
import fs from 'fs';
import path from 'path';
import os from 'os';
import { performance } from 'perf_hooks';
import v8 from 'v8';

export class PerformanceBenchmark {
    /**
     * Create benchmark framework
     * @param {Object} config - Configuration options
     * @param {string} config.outputDir - Directory for benchmark results
     * @param {boolean} config.memoryProfiling - Whether to collect memory metrics
     * @param {boolean} config.verbose - Whether to log detailed information
     */
    constructor(config = {}) {
        this.outputDir = config.outputDir || path.join(process.cwd(), 'benchmark-results');
        this.memoryProfiling = config.memoryProfiling !== false;
        this.verbose = config.verbose || false;
        this.results = {};
        this.currentSuite = null;
        this.baselines = null;

        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Try to load baseline results if available
        this.loadBaselines();
    }

    /**
     * Begin a test suite
     * @param {string} name - Suite name
     * @returns {PerformanceBenchmark} this, for chaining
     */
    suite(name) {
        // Complete previous suite if exists
        if (this.currentSuite) {
            this.log(`Completed suite: ${this.currentSuite}`);
        }

        this.currentSuite = name;
        if (!this.results[name]) {
            this.results[name] = {
                tests: {},
                environment: this.getEnvironmentInfo(),
                startTime: new Date().toISOString()
            };
        }

        this.log(`Starting suite: ${name}`);
        return this;
    }

    /**
     * Run a benchmark test
     * @param {string} name - Test name
     * @param {Function} fn - Test function
     * @param {Object} options - Test options
     * @param {number} options.iterations - Number of iterations
     * @param {number} options.warmupIterations - Number of warmup iterations
     * @param {Object} options.testParams - Parameters for test function
     * @returns {Promise<Object>} Test results
     */
    async benchmark(name, fn, options = {}) {
        if (!this.currentSuite) {
            throw new Error('No active suite, call suite() first');
        }

        const iterations = options.iterations || 5;
        const warmupIterations = options.warmupIterations || 1;
        const testParams = options.testParams || {};

        this.log(`Running benchmark: ${name} (${iterations} iterations, ${warmupIterations} warmup)`);

        const results = {
            name,
            suite: this.currentSuite,
            iterations,
            warmupIterations,
            params: testParams,
            runs: [],
            stats: {},
            startTime: new Date().toISOString()
        };

        try {
            // Run warmup iterations
            for (let i = 0; i < warmupIterations; i++) {
                this.log(`Warmup iteration ${i + 1}/${warmupIterations}`);
                await fn(testParams);
            }

            // Run measured iterations
            for (let i = 0; i < iterations; i++) {
                this.log(`Iteration ${i + 1}/${iterations}`);

                const memoryBefore = this.memoryProfiling ? this.getMemoryUsage() : null;
                const startTime = performance.now();

                // Run the test
                const result = await fn(testParams);

                const endTime = performance.now();
                const executionTime = endTime - startTime;
                const memoryAfter = this.memoryProfiling ? this.getMemoryUsage() : null;

                const runResult = {
                    iteration: i + 1,
                    executionTime,
                    result: this.getResultSummary(result),
                    timestamp: new Date().toISOString()
                };

                if (this.memoryProfiling) {
                    runResult.memory = {
                        before: memoryBefore,
                        after: memoryAfter,
                        diff: this.calculateMemoryDiff(memoryBefore, memoryAfter)
                    };
                }

                results.runs.push(runResult);
                this.log(`Iteration ${i + 1} completed in ${executionTime.toFixed(2)}ms`);
            }

            // Calculate statistics
            results.stats = this.calculateStats(results.runs);
            results.endTime = new Date().toISOString();
            results.totalDuration = this.calculateTotalDuration(results.startTime, results.endTime);

            // Compare with baseline if available
            if (this.baselines &&
                this.baselines[this.currentSuite] &&
                this.baselines[this.currentSuite].tests[name]) {
                results.comparison = this.compareWithBaseline(
                    results.stats,
                    this.baselines[this.currentSuite].tests[name].stats
                );
            }

            // Store results
            this.results[this.currentSuite].tests[name] = results;
            this.results[this.currentSuite].endTime = new Date().toISOString();
            this.results[this.currentSuite].totalDuration = this.calculateTotalDuration(
                this.results[this.currentSuite].startTime,
                this.results[this.currentSuite].endTime
            );

            return results;
        } catch (error) {
            this.log(`Error in benchmark ${name}: ${error.message}`, 'error');

            // Record error
            results.error = {
                message: error.message,
                stack: error.stack
            };
            results.endTime = new Date().toISOString();

            // Store results even if failed
            this.results[this.currentSuite].tests[name] = results;

            throw error;
        }
    }

    /**
     * Run multiple benchmarks in a batch
     * @param {Array<Object>} benchmarks - Benchmark definitions
     * @returns {Promise<Object>} Batch results
     */
    async batchBenchmark(benchmarks) {
        if (!this.currentSuite) {
            throw new Error('No active suite, call suite() first');
        }

        const batchResults = {
            suite: this.currentSuite,
            benchmarks: [],
            startTime: new Date().toISOString()
        };

        for (const benchmark of benchmarks) {
            try {
                const result = await this.benchmark(benchmark.name, benchmark.fn, benchmark.options);
                batchResults.benchmarks.push({
                    name: benchmark.name,
                    success: true,
                    stats: result.stats
                });
            } catch (error) {
                batchResults.benchmarks.push({
                    name: benchmark.name,
                    success: false,
                    error: error.message
                });
            }
        }

        batchResults.endTime = new Date().toISOString();
        batchResults.totalDuration = this.calculateTotalDuration(
            batchResults.startTime,
            batchResults.endTime
        );

        return batchResults;
    }

    /**
     * Save benchmark results to file
     * @param {string} [filename] - Optional filename
     * @returns {string} Path to saved file
     */
    saveResults(filename) {
        // Generate filename if not provided
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            filename = `benchmark-results-${timestamp}.json`;
        }

        const filePath = path.join(this.outputDir, filename);

        // Add summary stats for each suite
        for (const [suiteName, suite] of Object.entries(this.results)) {
            suite.summary = this.calculateSuiteSummary(suite);
        }

        // Generate final output
        const output = {
            timestamp: new Date().toISOString(),
            environment: this.getEnvironmentInfo(),
            suites: this.results
        };

        // Save to file
        fs.writeFileSync(filePath, JSON.stringify(output, null, 2));

        this.log(`Results saved to ${filePath}`);

        return filePath;
    }

    /**
     * Generate markdown report from results
     * @param {string} [filename] - Optional filename
     * @returns {string} Path to saved report
     */
    generateReport(filename) {
        // Generate filename if not provided
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            filename = `benchmark-report-${timestamp}.md`;
        }

        const filePath = path.join(this.outputDir, filename);

        // Generate report content
        let report = `# Performance Benchmark Report\n\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;

        // Environment information
        const env = this.getEnvironmentInfo();
        report += `## Environment\n\n`;
        report += `- **Node.js**: ${env.nodeVersion}\n`;
        report += `- **OS**: ${env.os} ${env.osVersion}\n`;
        report += `- **CPU**: ${env.cpu} (${env.cpuCores} cores)\n`;
        report += `- **Memory**: ${env.totalMemory} GB\n\n`;

        // Suites
        for (const [suiteName, suite] of Object.entries(this.results)) {
            report += `## Suite: ${suiteName}\n\n`;
            report += `Duration: ${suite.totalDuration || 'N/A'}\n\n`;

            // Add summary if available
            if (suite.summary) {
                report += `### Summary\n\n`;
                report += `- **Total Tests**: ${suite.summary.totalTests}\n`;
                report += `- **Successful Tests**: ${suite.summary.successfulTests}\n`;
                report += `- **Failed Tests**: ${suite.summary.failedTests}\n`;
                report += `- **Average Execution Time**: ${suite.summary.averageExecutionTime.toFixed(2)} ms\n`;

                if (suite.summary.memoryUsage) {
                    report += `- **Average Memory Usage**: ${(suite.summary.memoryUsage.average / (1024 * 1024)).toFixed(2)} MB\n`;
                }

                report += `\n`;
            }

            // Add test details
            report += `### Tests\n\n`;

            for (const [testName, test] of Object.entries(suite.tests)) {
                report += `#### ${testName}\n\n`;

                if (test.error) {
                    report += `❌ **FAILED**: ${test.error.message}\n\n`;
                } else {
                    report += `✅ **SUCCESS**\n\n`;
                    report += `- **Iterations**: ${test.iterations}\n`;
                    report += `- **Average Time**: ${test.stats.mean.toFixed(2)} ms\n`;
                    report += `- **Median Time**: ${test.stats.median.toFixed(2)} ms\n`;
                    report += `- **Min Time**: ${test.stats.min.toFixed(2)} ms\n`;
                    report += `- **Max Time**: ${test.stats.max.toFixed(2)} ms\n`;
                    report += `- **Standard Deviation**: ${test.stats.standardDeviation.toFixed(2)} ms\n`;

                    if (test.stats.memoryUsage) {
                        report += `- **Average Memory Usage**: ${(test.stats.memoryUsage.average / (1024 * 1024)).toFixed(2)} MB\n`;
                    }

                    // Add comparison with baseline if available
                    if (test.comparison) {
                        report += `\n**Comparison with Baseline**:\n\n`;

                        const timeChange = test.comparison.meanDiff;
                        const timeChangePercent = test.comparison.meanDiffPercent;

                        if (timeChange < 0) {
                            report += `- **Time**: 🚀 ${Math.abs(timeChangePercent).toFixed(2)}% faster (${Math.abs(timeChange).toFixed(2)} ms improvement)\n`;
                        } else if (timeChange > 0) {
                            report += `- **Time**: ⚠️ ${timeChangePercent.toFixed(2)}% slower (${timeChange.toFixed(2)} ms regression)\n`;
                        } else {
                            report += `- **Time**: ✓ No significant change\n`;
                        }

                        if (test.comparison.memoryDiff) {
                            const memoryChange = test.comparison.memoryDiff;
                            const memoryChangePercent = test.comparison.memoryDiffPercent;

                            if (memoryChange < 0) {
                                report += `- **Memory**: 🚀 ${Math.abs(memoryChangePercent).toFixed(2)}% less memory (${(Math.abs(memoryChange) / (1024 * 1024)).toFixed(2)} MB improvement)\n`;
                            } else if (memoryChange > 0) {
                                report += `- **Memory**: ⚠️ ${memoryChangePercent.toFixed(2)}% more memory (${(memoryChange / (1024 * 1024)).toFixed(2)} MB increase)\n`;
                            } else {
                                report += `- **Memory**: ✓ No significant change\n`;
                            }
                        }
                    }
                }

                report += `\n`;
            }
        }

        // Save to file
        fs.writeFileSync(filePath, report);

        this.log(`Report saved to ${filePath}`);

        return filePath;
    }

    /**
     * Set baseline results for comparison
     * @param {Object} baseline - Baseline results
     */
    setBaseline(baseline) {
        this.baselines = baseline;
    }

    /**
     * Load baseline results from file
     * @param {string} [filePath] - Optional path to baseline file
     * @returns {boolean} Success status
     */
    loadBaselines(filePath) {
        try {
            // If no explicit path, look for default baseline
            if (!filePath) {
                filePath = path.join(this.outputDir, 'baseline.json');
            }

            if (!fs.existsSync(filePath)) {
                this.log('No baseline file found, comparisons will not be available', 'warn');
                return false;
            }

            const baseline = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.baselines = baseline.suites;

            this.log(`Loaded baseline from ${filePath}`);
            return true;
        } catch (error) {
            this.log(`Error loading baseline: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Save current results as baseline
     * @param {string} [filename] - Optional filename
     * @returns {string} Path to saved baseline
     */
    saveAsBaseline(filename = 'baseline.json') {
        const filePath = this.saveResults(filename);
        this.log(`Saved results as new baseline: ${filePath}`);
        return filePath;
    }

    /**
     * Get current memory usage
     * @returns {Object} Memory usage stats
     */
    getMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();

        return {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
            arrayBuffers: memoryUsage.arrayBuffers,
            heapSizeLimit: heapStats.heap_size_limit,
            totalHeapSize: heapStats.total_heap_size,
            totalAvailableSize: heapStats.total_available_size
        };
    }

    /**
     * Calculate memory usage difference
     * @param {Object} before - Memory usage before
     * @param {Object} after - Memory usage after
     * @returns {Object} Memory usage difference
     */
    calculateMemoryDiff(before, after) {
        return {
            rss: after.rss - before.rss,
            heapTotal: after.heapTotal - before.heapTotal,
            heapUsed: after.heapUsed - before.heapUsed,
            external: after.external - before.external,
            arrayBuffers: after.arrayBuffers - before.arrayBuffers
        };
    }

    /**
     * Get environment information
     * @returns {Object} Environment info
     */
    getEnvironmentInfo() {
        return {
            nodeVersion: process.version,
            os: process.platform,
            osVersion: os.release(),
            cpu: os.cpus()[0].model,
            cpuCores: os.cpus().length,
            totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10, // In GB
            hostname: os.hostname()
        };
    }

    /**
     * Calculate statistics from test runs
     * @param {Array} runs - Test runs
     * @returns {Object} Statistics
     */
    calculateStats(runs) {
        const executionTimes = runs.map(run => run.executionTime);

        // Basic stats
        const sum = executionTimes.reduce((a, b) => a + b, 0);
        const mean = sum / executionTimes.length;
        const min = Math.min(...executionTimes);
        const max = Math.max(...executionTimes);

        // Sort for median and percentiles
        const sorted = [...executionTimes].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];

        // Standard deviation
        const variance = executionTimes.reduce((sum, time) => {
            return sum + Math.pow(time - mean, 2);
        }, 0) / executionTimes.length;
        const standardDeviation = Math.sqrt(variance);

        // Calculate percentiles
        const percentile95 = sorted[Math.floor(sorted.length * 0.95)];
        const percentile99 = sorted[Math.floor(sorted.length * 0.99)];

        // Memory usage stats if available
        let memoryUsage = null;
        if (this.memoryProfiling) {
            const heapUsedDiffs = runs.map(run => run.memory.diff.heapUsed);
            const totalMemorySum = heapUsedDiffs.reduce((a, b) => a + b, 0);
            memoryUsage = {
                average: totalMemorySum / heapUsedDiffs.length,
                min: Math.min(...heapUsedDiffs),
                max: Math.max(...heapUsedDiffs)
            };
        }

        return {
            mean,
            median,
            min,
            max,
            standardDeviation,
            variance,
            percentile95,
            percentile99,
            memoryUsage
        };
    }

    /**
     * Calculate total duration between timestamps
     * @param {string} startTime - ISO start time
     * @param {string} endTime - ISO end time
     * @returns {string} Formatted duration
     */
    calculateTotalDuration(startTime, endTime) {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        const durationMs = end - start;

        // Format as human-readable duration
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s ${durationMs % 1000}ms`;
        }
    }

    /**
     * Compare results with baseline
     * @param {Object} current - Current stats
     * @param {Object} baseline - Baseline stats
     * @returns {Object} Comparison results
     */
    compareWithBaseline(current, baseline) {
        const meanDiff = current.mean - baseline.mean;
        const meanDiffPercent = (meanDiff / baseline.mean) * 100;

        let memoryDiff = null;
        let memoryDiffPercent = null;

        if (current.memoryUsage && baseline.memoryUsage) {
            memoryDiff = current.memoryUsage.average - baseline.memoryUsage.average;
            memoryDiffPercent = (memoryDiff / baseline.memoryUsage.average) * 100;
        }

        return {
            meanDiff,
            meanDiffPercent,
            memoryDiff,
            memoryDiffPercent
        };
    }

    /**
     * Calculate summary for a test suite
     * @param {Object} suite - Test suite
     * @returns {Object} Summary statistics
     */
    calculateSuiteSummary(suite) {
        const tests = Object.values(suite.tests);
        const totalTests = tests.length;
        const successfulTests = tests.filter(test => !test.error).length;
        const failedTests = totalTests - successfulTests;

        // Calculate average execution time for successful tests
        const executionTimes = tests
            .filter(test => !test.error)
            .map(test => test.stats.mean);

        const totalExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0);
        const averageExecutionTime = executionTimes.length > 0 ? totalExecutionTime / executionTimes.length : 0;

        // Memory usage summary if available
        let memoryUsage = null;
        if (this.memoryProfiling) {
            const memoryStats = tests
                .filter(test => !test.error && test.stats.memoryUsage)
                .map(test => test.stats.memoryUsage.average);

            if (memoryStats.length > 0) {
                const totalMemory = memoryStats.reduce((sum, mem) => sum + mem, 0);
                memoryUsage = {
                    average: totalMemory / memoryStats.length,
                    total: totalMemory
                };
            }
        }

        return {
            totalTests,
            successfulTests,
            failedTests,
            averageExecutionTime,
            memoryUsage
        };
    }

    /**
     * Get a simplified summary of result data
     * @param {*} result - Result data
     * @returns {*} Simplified result
     */
    getResultSummary(result) {
        // If result is simple type, return as is
        if (result === null || result === undefined || typeof result !== 'object' || Array.isArray(result)) {
            return result;
        }

        // For objects, filter out large properties
        const summary = {};
        for (const [key, value] of Object.entries(result)) {
            // Skip large arrays or buffers
            if (Array.isArray(value) && value.length > 100) {
                summary[key] = `Array[${value.length}]`;
            } else if (value instanceof Buffer || ArrayBuffer.isView(value)) {
                summary[key] = `Buffer[${value.byteLength || value.length}]`;
            } else if (typeof value === 'object' && value !== null) {
                summary[key] = this.getResultSummary(value);
            } else {
                summary[key] = value;
            }
        }

        return summary;
    }

    /**
     * Log a message if verbose mode is enabled
     * @param {string} message - Message to log
     * @param {string} level - Log level
     */
    log(message, level = 'info') {
        if (!this.verbose) return;

        const timestamp = new Date().toISOString();

        switch (level) {
            case 'error':
                console.error(`[${timestamp}] ERROR: ${message}`);
                break;
            case 'warn':
                console.warn(`[${timestamp}] WARN: ${message}`);
                break;
            default:
                console.log(`[${timestamp}] INFO: ${message}`);
        }
    }
} 