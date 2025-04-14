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

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

/**
 * Parse command line arguments
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
            logger.info('No specific fixes selected, running all fixes.');
        }

        return values;
    } catch (error) {
        logger.error(`Error parsing arguments: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Run the module format fixer
 * @param {object} options - Command line options
 * @returns {Promise<object>} - Stats from the fixer
 */
async function runModuleFormatFixer(options) {
    const targetPath = path.resolve(rootDir, options.targetDir);
    logger.info(`Running module format fixer on ${targetPath}...`);

    const fixer = new ModuleFormatFixer({
        verbose: options.verbose,
        dryRun: options.dryRun,
    });

    const stats = await fixer.fixDirectory(targetPath);

    logger.info('Module format fix complete:');
    logger.info(`  - Files fixed: ${stats.fixed}`);
    logger.info(`  - Files skipped: ${stats.skipped}`);
    logger.info(`  - Errors: ${stats.errors}`);

    return stats;
}

/**
 * Run the test compatibility fixer
 * @param {object} options - Command line options
 * @returns {Promise<object>} - Stats from the fixer
 */
async function runTestCompatFixer(options) {
    const targetPath = path.resolve(rootDir, options.targetDir);
    logger.info(`Running test compatibility fixer on ${targetPath}...`);

    const fixer = new TestCompatFixer({
        verbose: options.verbose,
        dryRun: options.dryRun,
    });

    const stats = await fixer.fixDirectory(targetPath);

    logger.info('Test compatibility fix complete:');
    logger.info(`  - Files fixed: ${stats.fixed}`);
    logger.info(`  - Files skipped: ${stats.skipped}`);
    logger.info(`  - Errors: ${stats.errors}`);

    return stats;
}

/**
 * Main function to run code fixes
 */
async function main() {
    try {
        const startTime = Date.now();
        const options = parseArguments();

        if (options.dryRun) {
            logger.info('Running in dry-run mode. No changes will be made.');
        }

        logger.info(`Target directory: ${options.targetDir}`);

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

        logger.info('');
        logger.info(`🎉 Code fixes completed in ${duration}s`);
        logger.info(`Total files fixed: ${totalFixed}`);
        if (totalErrors > 0) {
            logger.warn(`Total errors: ${totalErrors}`);
        }

        if (options.dryRun) {
            logger.info('No changes were made (dry-run mode).');
        }

    } catch (error) {
        logger.error(`Error running code fixes: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    }
}

// Run the main function
main().catch(error => {
    logger.error(`Unhandled error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
}); 