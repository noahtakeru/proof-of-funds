#!/usr/bin/env node

/**
 * Code Fixes Runner
 * 
 * This script runs fixes to improve code quality, compatibility, and structure:
 * - Module format fixes (CommonJS to ESM conversion)
 * - Test compatibility fixes (updating tests to use Node.js test runner)
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { parseArgs } from 'node:util';
import logger from './common/logger.js';
import { ModuleFormatFixer } from './fixes/module-formats.js';
import { TestCompatFixer } from './fixes/test-compat.js';
import {
    errorHandler,
    ZkError,
    ConfigurationError,
    tryExecAsync
} from './common/error-handler.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

// Create a script-specific logger
const scriptLogger = logger.child('code-fixes-runner');

/**
 * Parse command line arguments
 * @returns {object} Parsed command line arguments
 */
function parseArguments() {
    const options = {
        fixModules: {
            type: 'boolean',
            short: 'm',
            default: false,
        },
        fixTests: {
            type: 'boolean',
            short: 't',
            default: false,
        },
        all: {
            type: 'boolean',
            short: 'a',
            default: false,
        },
        verbose: {
            type: 'boolean',
            short: 'v',
            default: false,
        },
        dryRun: {
            type: 'boolean',
            short: 'd',
            default: false,
        },
        targetDir: {
            type: 'string',
            short: 'p',
            default: 'lib/zk',
        },
    };

    try {
        const { values } = parseArgs({ options });

        // If 'all' is specified, enable all fixers
        if (values.all) {
            values.fixModules = true;
            values.fixTests = true;
        }

        // If no specific fixer is enabled, default to all
        if (!values.fixModules && !values.fixTests) {
            values.fixModules = true;
            values.fixTests = true;
            scriptLogger.info('No specific fixes selected, running all fixes.');
        }

        return values;
    } catch (error) {
        throw new ConfigurationError('Failed to parse command line arguments', {
            cause: error,
            module: 'code-fixes-runner',
            operation: 'parseArguments'
        });
    }
}

/**
 * Run the module format fixer
 * @param {object} options - Command line options
 * @returns {Promise<object>} - Stats from the fixer
 */
async function runModuleFormatFixer(options) {
    return tryExecAsync(async () => {
        const targetPath = path.resolve(rootDir, options.targetDir);
        scriptLogger.info(`Running module format fixer on ${targetPath}...`);

        const fixer = new ModuleFormatFixer({
            verbose: options.verbose,
            dryRun: options.dryRun,
        });

        const stats = await fixer.fixDirectory(targetPath);

        scriptLogger.info('Module format fix complete:');
        scriptLogger.info(`  - Files fixed: ${stats.fixed}`);
        scriptLogger.info(`  - Files skipped: ${stats.skipped}`);
        scriptLogger.info(`  - Errors: ${stats.errors}`);

        return stats;
    }, {
        module: 'code-fixes-runner',
        operation: 'runModuleFormatFixer',
        context: { options },
        onError: (error) => {
            scriptLogger.error(`Error running module format fixer: ${error.message}`);
            return { fixed: 0, skipped: 0, errors: 1 };
        }
    });
}

/**
 * Run the test compatibility fixer
 * @param {object} options - Command line options
 * @returns {Promise<object>} - Stats from the fixer
 */
async function runTestCompatFixer(options) {
    return tryExecAsync(async () => {
        const targetPath = path.resolve(rootDir, options.targetDir);
        scriptLogger.info(`Running test compatibility fixer on ${targetPath}...`);

        const fixer = new TestCompatFixer({
            verbose: options.verbose,
            dryRun: options.dryRun,
        });

        const stats = await fixer.fixDirectory(targetPath);

        scriptLogger.info('Test compatibility fix complete:');
        scriptLogger.info(`  - Files fixed: ${stats.fixed}`);
        scriptLogger.info(`  - Files skipped: ${stats.skipped}`);
        scriptLogger.info(`  - Errors: ${stats.errors}`);

        return stats;
    }, {
        module: 'code-fixes-runner',
        operation: 'runTestCompatFixer',
        context: { options },
        onError: (error) => {
            scriptLogger.error(`Error running test compatibility fixer: ${error.message}`);
            return { fixed: 0, skipped: 0, errors: 1 };
        }
    });
}

/**
 * Main function to run code fixes
 */
async function main() {
    return tryExecAsync(async () => {
        const startTime = Date.now();
        const options = parseArguments();

        if (options.dryRun) {
            scriptLogger.info('Running in dry-run mode. No changes will be made.');
        }

        scriptLogger.info(`Target directory: ${options.targetDir}`);

        // Track overall statistics
        const stats = {
            modulesFixer: { fixed: 0, skipped: 0, errors: 0 },
            testsFixer: { fixed: 0, skipped: 0, errors: 0 }
        };

        // Run the module format fixer if enabled
        if (options.fixModules) {
            stats.modulesFixer = await runModuleFormatFixer(options);
        }

        // Run the test compatibility fixer if enabled
        if (options.fixTests) {
            stats.testsFixer = await runTestCompatFixer(options);
        }

        // Log summary
        const totalFixed = stats.modulesFixer.fixed + stats.testsFixer.fixed;
        const totalErrors = stats.modulesFixer.errors + stats.testsFixer.errors;
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        scriptLogger.info('');
        scriptLogger.info(`🎉 Code fixes completed in ${duration}s`);
        scriptLogger.info(`Total files fixed: ${totalFixed}`);
        if (totalErrors > 0) {
            scriptLogger.warn(`Total errors: ${totalErrors}`);
        }

        if (options.dryRun) {
            scriptLogger.info('No changes were made (dry-run mode).');
        }

        // If we have error statistics, log them
        if (errorHandler.getErrorStats().total > 0) {
            const errorStats = errorHandler.getErrorStats();
            scriptLogger.info('');
            scriptLogger.info('Error statistics:');
            scriptLogger.info(`Total errors encountered: ${errorStats.total}`);

            if (Object.keys(errorStats.byCategory).length > 0) {
                scriptLogger.info('Errors by category:');
                for (const [category, count] of Object.entries(errorStats.byCategory)) {
                    scriptLogger.info(`  - ${category}: ${count}`);
                }
            }

            if (errorStats.topErrors.length > 0) {
                scriptLogger.info('Top errors:');
                for (const { key, count } of errorStats.topErrors.slice(0, 5)) {
                    scriptLogger.info(`  - ${key}: ${count} occurrences`);
                }
            }
        }

        return { totalFixed, totalErrors };
    }, {
        module: 'code-fixes-runner',
        operation: 'main',
        onError: (error) => {
            scriptLogger.error(`Error running code fixes: ${error.message}`);
            if (error.stack) {
                scriptLogger.debug(error.stack);
            }
            return { totalFixed: 0, totalErrors: 1 };
        }
    });
}

// Configure error handler
errorHandler.logSeverityThreshold = 'INFO';
errorHandler.logErrors = true;

// Set logger level based on environment
logger.setLevel(process.env.LOG_LEVEL || 'INFO');

// Run the main function
main().catch(error => {
    // This is only reached if our error handling system fails completely
    console.error(`Critical unhandled error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
}); 