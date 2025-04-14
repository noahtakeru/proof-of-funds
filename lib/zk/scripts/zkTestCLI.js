#!/usr/bin/env node
/**
 * ZK Test CLI
 * Command-line interface for running ZK tests
 */

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createConfigManager } from './common/config.js';
import logger from './common/logger.js';
import reportGenerator from './common/reportGenerator.js';

// Get dirname for ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create the program
const program = new Command();

// Setup program information
program
    .name('zk-test')
    .description('ZK Test Suite CLI')
    .version('1.0.0');

// Helper to resolve path relative to the workspace
function resolvePath(relativePath) {
    return path.resolve(__dirname, '../..', relativePath);
}

// Common setup for all test commands
function setupTestCommand(command) {
    return command
        .option('-c, --config <path>', 'Path to config file')
        .option('-v, --verbose', 'Enable verbose output')
        .option('-o, --output <dir>', 'Output directory for test results')
        .option('--no-html', 'Disable HTML report generation')
        .option('--no-json', 'Disable JSON report generation');
}

// Handle performance tests
program
    .command('performance')
    .description('Run performance tests')
    .option('-i, --iterations <number>', 'Number of test iterations', parseInt)
    .option('-w, --warmup <number>', 'Number of warmup iterations', parseInt)
    .option('--concurrency <number>', 'Maximum concurrency', parseInt)
    .option('--memory-profile', 'Enable memory profiling')
    .option('--proof-types <types>', 'Proof types to test (comma separated)')
    .option('--no-verification', 'Skip verification tests')
    .option('--no-e2e', 'Skip end-to-end tests')
    .action(async (cmdOptions) => {
        try {
            // Load config with command line overrides
            const configManager = createConfigManager({
                configFile: cmdOptions.config,
                overrides: {
                    logging: {
                        level: cmdOptions.verbose ? 'debug' : 'info'
                    },
                    output: {
                        directory: cmdOptions.output,
                        generateHtmlReport: cmdOptions.html !== false,
                        generateJson: cmdOptions.json !== false
                    },
                    tests: {
                        performance: {
                            iterations: cmdOptions.iterations,
                            warmupIterations: cmdOptions.warmup,
                            concurrency: cmdOptions.concurrency,
                            memoryProfile: cmdOptions.memoryProfile
                        }
                    }
                }
            });

            // Ensure directories exist
            configManager.ensureDirectories();

            const config = configManager.getConfig();

            // Configure logger
            logger.setLevel(config.logging.level);
            logger.useColors(config.logging.useColors);

            if (config.logging.logToFile) {
                logger.enableFileLogging(config.logging.logFile);
            }

            logger.info('Starting performance tests');
            logger.debug('Configuration', config.tests.performance);

            // Import tests dynamically
            const { default: runPerformanceTests } = await import('../scripts/run-performance-tests.mjs');

            // Parse proof types if specified
            let proofTypes = undefined;
            if (cmdOptions.proofTypes) {
                proofTypes = cmdOptions.proofTypes.split(',').map(t => t.trim());
            }

            // Run the tests with options
            const results = await runPerformanceTests({
                iterations: config.tests.performance.iterations,
                warmupIterations: config.tests.performance.warmupIterations,
                concurrency: config.tests.performance.concurrency,
                memoryProfile: config.tests.performance.memoryProfile,
                runVerification: cmdOptions.verification !== false,
                runE2E: cmdOptions.e2e !== false,
                proofTypes,
                verbose: config.logging.level === 'debug' || config.logging.level === 'trace',
                outputDir: config.output.directory
            });

            // Generate reports if results are returned
            if (results) {
                const reportsConfig = {
                    outputDir: config.output.directory,
                    generateHtml: config.output.generateHtmlReport,
                    generateJson: config.output.generateJson,
                    reportTitle: 'ZK Performance Test Results'
                };

                const reportPaths = reportGenerator.generateReport(results, 'performance');

                logger.info('Test reports generated:');
                if (reportPaths.html) {
                    logger.info(`- HTML: ${reportPaths.html}`);
                }
                if (reportPaths.json) {
                    logger.info(`- JSON: ${reportPaths.json}`);
                }

                // Compare with baseline if enabled
                if (config.output.compareWithBaseline && fs.existsSync(config.output.baselineFile)) {
                    logger.info('Comparing with baseline...');
                    const comparison = reportGenerator.compareWithBaseline(results, config.output.baselineFile);
                    const comparisonReports = reportGenerator.generateComparisonReport(comparison, 'performance');

                    logger.info('Comparison reports generated:');
                    if (comparisonReports.html) {
                        logger.info(`- HTML: ${comparisonReports.html}`);
                    }
                    if (comparisonReports.json) {
                        logger.info(`- JSON: ${comparisonReports.json}`);
                    }
                }
            }

            logger.info('Performance tests completed');
        } catch (err) {
            logger.error('Error running performance tests:', err);
            process.exit(1);
        }
    });

// Handle security tests
program
    .command('security')
    .description('Run security tests')
    .option('-i, --iterations <number>', 'Number of test iterations', parseInt)
    .option('--vectors <vectors>', 'Attack vectors to test (comma separated)')
    .option('--strict', 'Enable strict mode for security tests')
    .action(async (cmdOptions) => {
        try {
            // Load config with command line overrides
            const configManager = createConfigManager({
                configFile: cmdOptions.config,
                overrides: {
                    logging: {
                        level: cmdOptions.verbose ? 'debug' : 'info'
                    },
                    output: {
                        directory: cmdOptions.output,
                        generateHtmlReport: cmdOptions.html !== false,
                        generateJson: cmdOptions.json !== false
                    },
                    tests: {
                        security: {
                            iterations: cmdOptions.iterations,
                            strictMode: cmdOptions.strict
                        }
                    }
                }
            });

            // Ensure directories exist
            configManager.ensureDirectories();

            const config = configManager.getConfig();

            // Configure logger
            logger.setLevel(config.logging.level);
            logger.useColors(config.logging.useColors);

            if (config.logging.logToFile) {
                logger.enableFileLogging(config.logging.logFile);
            }

            logger.info('Starting security tests');
            logger.debug('Configuration', config.tests.security);

            // Parse attack vectors if specified
            let attackVectors = config.tests.security.attackVectors;
            if (cmdOptions.vectors) {
                attackVectors = cmdOptions.vectors.split(',').map(v => v.trim());
            }

            // Import tests dynamically to avoid import errors if files don't exist
            const { default: runSecurityTests } = await import('../tests/security/SecurityTestRunner.js')
                .catch(err => {
                    logger.error('Failed to import security tests:', err);
                    return { default: null };
                });

            if (!runSecurityTests) {
                throw new Error('Security test runner not found');
            }

            // Run the tests with options
            const results = await runSecurityTests({
                iterations: config.tests.security.iterations,
                attackVectors,
                strictMode: config.tests.security.strictMode,
                verbose: config.logging.level === 'debug' || config.logging.level === 'trace',
                outputDir: config.output.directory
            });

            // Generate reports if results are returned
            if (results) {
                const reportsConfig = {
                    outputDir: config.output.directory,
                    generateHtml: config.output.generateHtmlReport,
                    generateJson: config.output.generateJson,
                    reportTitle: 'ZK Security Test Results'
                };

                const reportPaths = reportGenerator.generateReport(results, 'security');

                logger.info('Test reports generated:');
                if (reportPaths.html) {
                    logger.info(`- HTML: ${reportPaths.html}`);
                }
                if (reportPaths.json) {
                    logger.info(`- JSON: ${reportPaths.json}`);
                }
            }

            logger.info('Security tests completed');
        } catch (err) {
            logger.error('Error running security tests:', err);
            process.exit(1);
        }
    });

// Handle regression tests
program
    .command('regression')
    .description('Run regression tests')
    .option('--fail-fast', 'Stop on first test failure')
    .option('--test-pattern <pattern>', 'Regex pattern for test files')
    .action(async (cmdOptions) => {
        try {
            // Load config with command line overrides
            const configManager = createConfigManager({
                configFile: cmdOptions.config,
                overrides: {
                    logging: {
                        level: cmdOptions.verbose ? 'debug' : 'info'
                    },
                    output: {
                        directory: cmdOptions.output,
                        generateHtmlReport: cmdOptions.html !== false,
                        generateJson: cmdOptions.json !== false
                    },
                    tests: {
                        regression: {
                            failFast: cmdOptions.failFast
                        }
                    }
                }
            });

            // Ensure directories exist
            configManager.ensureDirectories();

            const config = configManager.getConfig();

            // Configure logger
            logger.setLevel(config.logging.level);
            logger.useColors(config.logging.useColors);

            if (config.logging.logToFile) {
                logger.enableFileLogging(config.logging.logFile);
            }

            logger.info('Starting regression tests');

            // Import tests dynamically to avoid import errors if files don't exist
            const { default: runRegressionTests } = await import('../tests/regression/runner.js')
                .catch(err => {
                    logger.error('Failed to import regression tests:', err);
                    return { default: null };
                });

            if (!runRegressionTests) {
                throw new Error('Regression test runner not found');
            }

            // Run the tests with options
            const results = await runRegressionTests({
                failFast: config.tests.regression.failFast,
                testPattern: cmdOptions.testPattern,
                verbose: config.logging.level === 'debug' || config.logging.level === 'trace',
                outputDir: config.output.directory
            });

            // Generate reports if results are returned
            if (results) {
                const reportsConfig = {
                    outputDir: config.output.directory,
                    generateHtml: config.output.generateHtmlReport,
                    generateJson: config.output.generateJson,
                    reportTitle: 'ZK Regression Test Results'
                };

                const reportPaths = reportGenerator.generateReport(results, 'regression');

                logger.info('Test reports generated:');
                if (reportPaths.html) {
                    logger.info(`- HTML: ${reportPaths.html}`);
                }
                if (reportPaths.json) {
                    logger.info(`- JSON: ${reportPaths.json}`);
                }
            }

            logger.info('Regression tests completed');
        } catch (err) {
            logger.error('Error running regression tests:', err);
            process.exit(1);
        }
    });

// Command to run all tests
program
    .command('all')
    .description('Run all tests (performance, security, regression)')
    .action(async (cmdOptions) => {
        try {
            // First run performance tests
            await program.parseAsync(['node', 'zk-test', 'performance', ...process.argv.slice(3)]);

            // Then run security tests
            await program.parseAsync(['node', 'zk-test', 'security', ...process.argv.slice(3)]);

            // Finally run regression tests
            await program.parseAsync(['node', 'zk-test', 'regression', ...process.argv.slice(3)]);

            logger.info('All tests completed successfully');
        } catch (err) {
            logger.error('Error running all tests:', err);
            process.exit(1);
        }
    });

// Command to create a new test configuration
program
    .command('init')
    .description('Initialize a new test configuration')
    .option('-o, --output <path>', 'Output path for the configuration file', 'zk-test-config.json')
    .action((cmdOptions) => {
        try {
            const configManager = createConfigManager();
            const configPath = resolvePath(cmdOptions.output);

            // Save default config to the specified path
            const success = configManager.saveToFile(configPath);

            if (success) {
                console.log(`Configuration file created at: ${configPath}`);
            } else {
                console.error('Failed to create configuration file');
                process.exit(1);
            }
        } catch (err) {
            console.error('Error initializing configuration:', err);
            process.exit(1);
        }
    });

// Apply common options to all commands
setupTestCommand(program);

// Parse arguments and execute
program.parse(process.argv);

// If no arguments provided, show help
if (process.argv.length <= 2) {
    program.help();
} 