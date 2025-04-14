#!/usr/bin/env node

/**
 * ZK Codebase Auto-Fixer
 * 
 * This script runs all available fixes for the ZK codebase:
 * - Module format standardization
 * - Test compatibility fixes
 * - Dependency management
 * - ESLint auto-fixes
 * 
 * Usage:
 *   node run-fixes.js [--verbose] [--dry-run] [--skip-backup]
 *   
 * Options:
 *   --verbose      Show detailed logs
 *   --dry-run      Show what would be fixed without making changes
 *   --skip-backup  Don't create backups of modified files
 *   --fix=<name>   Only run a specific fix (module-formats, test-compat)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../common/logger.js';

// Import fixers
import { ModuleFormatFixer } from './module-formats.js';
import { TestCompatibilityFixer } from './test-compat.js';

// Get directory name for ESM modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

// Root directory of the project (lib/zk/..)
const ZK_ROOT = path.resolve(__dirname, '../..');
const PROJECT_ROOT = path.resolve(ZK_ROOT, '../..');

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        verbose: false,
        dryRun: false,
        skipBackup: false,
        fix: null
    };

    for (const arg of args) {
        if (arg === '--verbose') {
            options.verbose = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--skip-backup') {
            options.skipBackup = true;
        } else if (arg.startsWith('--fix=')) {
            options.fix = arg.split('=')[1];
        }
    }

    return options;
}

/**
 * Run module format fixes
 * @param {Object} options - Command line options
 * @returns {Promise<Object>} Results
 */
async function runModuleFormatFixes(options) {
    logger.info('Running module format fixes...');

    const fixer = new ModuleFormatFixer({
        verbose: options.verbose,
        dryRun: options.dryRun,
        backup: !options.skipBackup,
        ignoreDirs: ['node_modules', 'dist', 'build', '.git']
    });

    const startTime = Date.now();
    const results = await fixer.fixDirectory(ZK_ROOT);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info(`Module format fixes completed in ${elapsed}s: ${results.fixed} files fixed, ${results.errors} errors`);
    return results;
}

/**
 * Run test compatibility fixes
 * @param {Object} options - Command line options
 * @returns {Promise<Object>} Results
 */
async function runTestCompatFixes(options) {
    logger.info('Running test compatibility fixes...');

    const fixer = new TestCompatibilityFixer({
        verbose: options.verbose,
        dryRun: options.dryRun,
        backup: !options.skipBackup,
        ignoreDirs: ['node_modules', 'dist', 'build', '.git'],
        testFramework: 'jest', // Can be configured based on project
        fixImports: true,
        fixAssertions: true
    });

    const startTime = Date.now();
    const results = await fixer.fixDirectory(ZK_ROOT);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info(`Test compatibility fixes completed in ${elapsed}s: ${results.fixed} files fixed, ${results.errors} errors`);
    return results;
}

/**
 * Run ESLint auto-fixes
 * @param {Object} options - Command line options
 * @returns {Promise<Object>} Results
 */
async function runEslintFixes(options) {
    if (options.dryRun) {
        logger.info('[DRY RUN] Would run ESLint auto-fixes');
        return { fixed: 0, errors: 0 };
    }

    logger.info('Running ESLint auto-fixes...');

    try {
        // Check if ESLint is available
        try {
            await execAsync('npx eslint --version');
        } catch (err) {
            logger.warn('ESLint not found in project, skipping ESLint fixes');
            return { fixed: 0, errors: 0 };
        }

        const startTime = Date.now();
        const { stdout, stderr } = await execAsync(`npx eslint "${ZK_ROOT}/**/*.{js,mjs}" --fix --quiet`);

        if (stderr) {
            logger.warn(`ESLint warnings: ${stderr}`);
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`ESLint auto-fixes completed in ${elapsed}s`);

        // Count fixed files from ESLint output (approximate)
        const fixedCount = stdout.split('\n').filter(line => line.includes('fixed')).length;
        return { fixed: fixedCount, errors: 0 };
    } catch (error) {
        logger.error(`Error running ESLint: ${error.message}`);
        return { fixed: 0, errors: 1 };
    }
}

/**
 * Run all fixes
 * @param {Object} options - Command line options
 * @returns {Promise<Object>} Results
 */
async function runAllFixes(options) {
    logger.info('Starting ZK codebase auto-fixes...');

    if (options.dryRun) {
        logger.info('Running in DRY RUN mode - no files will be modified');
    }

    const results = {
        moduleFormats: { fixed: 0, errors: 0 },
        testCompat: { fixed: 0, errors: 0 },
        eslint: { fixed: 0, errors: 0 },
        totalFixed: 0,
        totalErrors: 0
    };

    const startTime = Date.now();

    // Run fixes based on options
    if (!options.fix || options.fix === 'module-formats') {
        results.moduleFormats = await runModuleFormatFixes(options);
    }

    if (!options.fix || options.fix === 'test-compat') {
        results.testCompat = await runTestCompatFixes(options);
    }

    if (!options.fix || options.fix === 'eslint') {
        results.eslint = await runEslintFixes(options);
    }

    // Calculate totals
    results.totalFixed = results.moduleFormats.fixed + results.testCompat.fixed + results.eslint.fixed;
    results.totalErrors = results.moduleFormats.errors + results.testCompat.errors + results.eslint.errors;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // Output summary
    logger.info('');
    logger.info('=== ZK Codebase Auto-Fixes Summary ===');
    logger.info(`Total execution time: ${elapsed}s`);
    logger.info(`Total files fixed: ${results.totalFixed}`);
    logger.info(`Module format fixes: ${results.moduleFormats.fixed} files`);
    logger.info(`Test compatibility fixes: ${results.testCompat.fixed} files`);
    logger.info(`ESLint auto-fixes: ${results.eslint.fixed} files`);

    if (results.totalErrors > 0) {
        logger.warn(`Encountered ${results.totalErrors} errors during fixes`);
    }

    return results;
}

// Main function
async function main() {
    try {
        const options = parseArgs();

        // Set logger level based on verbosity
        logger.setLevel(options.verbose ? 'debug' : 'info');

        await runAllFixes(options);

        process.exit(0);
    } catch (error) {
        logger.error(`Error running ZK auto-fixes: ${error.message}`);
        if (error.stack) {
            logger.debug(error.stack);
        }
        process.exit(1);
    }
}

// Run main function
main(); 