#!/usr/bin/env node

/**
 * ZK Fix Script
 * Consolidated fix utility for ZK modules
 * 
 * Handles module format standardization, test compatibility,
 * regression test generation, and specific module fixes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import { ModuleFormatFixer } from './fixes/module-formats.js';
import { TestCompatibilityFixer } from './fixes/test-compat.js';
import { RegressionTestFixer } from './fixes/regression.js';
import { fixSpecificModules, SpecificModuleFixer } from './fixes/specific-fixes.js';
import logger from './common/logger.js';

// Get dirname for ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define command line options
const argv = minimist(process.argv.slice(2), {
    boolean: [
        'help',
        'version',
        'verbose',
        'dry-run',
        'no-backup',
        'module-formats',
        'test-compat',
        'regression',
        'specific',
        'all'
    ],
    string: [
        'fix',
        'module',
        'file',
        'dir'
    ],
    alias: {
        h: 'help',
        v: 'version',
        d: 'dry-run',
        f: 'fix',
        m: 'module',
        a: 'all'
    },
    default: {
        'backup': true,
        'all': false,
        'module-formats': false,
        'test-compat': false,
        'regression': false,
        'specific': false,
        'verbose': false,
        'dry-run': false
    }
});

// Version info
const VERSION = '1.0.0';

// Help info
const HELP_TEXT = `
ZK Fix Script - Utility for fixing ZK module compatibility issues

Usage: node zk-fix.js [options]

Options:
  -h, --help           Show this help message
  -v, --version        Show version information
  --verbose            Enable verbose logging
  -d, --dry-run        Don't actually modify files, just show what would be done
  --no-backup          Don't create backups of modified files
  
Fix Types:
  -a, --all            Apply all fixes
  --module-formats     Fix module format compatibility issues
  --test-compat        Fix test compatibility issues
  --regression         Generate regression test files
  --specific           Apply specific module fixes
  
Targets:
  -f, --fix <name>     Specific fix to apply (module-formats, test-compat, regression, specific)
  -m, --module <name>  Specific module to fix (for --specific option)
  --file <path>        Apply fixes to a specific file
  --dir <path>         Apply fixes to a specific directory (recursive)
`;

/**
 * Show help text and exit
 */
function showHelp() {
    console.log(HELP_TEXT);
    process.exit(0);
}

/**
 * Show version and exit
 */
function showVersion() {
    console.log(`ZK Fix Script v${VERSION}`);
    process.exit(0);
}

/**
 * Get targets from command line arguments
 * @returns {Object} Targets object
 */
function getTargets() {
    const targets = {
        file: null,
        dir: null,
        module: null
    };

    if (argv.file) {
        const filePath = path.resolve(argv.file);
        if (!fs.existsSync(filePath)) {
            logger.error(`File not found: ${filePath}`);
            process.exit(1);
        }
        targets.file = filePath;
    }

    if (argv.dir) {
        const dirPath = path.resolve(argv.dir);
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            logger.error(`Directory not found: ${dirPath}`);
            process.exit(1);
        }
        targets.dir = dirPath;
    }

    if (argv.module) {
        targets.module = argv.module;
    }

    return targets;
}

/**
 * Get options from command line arguments
 * @returns {Object} Options object
 */
function getOptions() {
    return {
        verbose: argv.verbose,
        dryRun: argv['dry-run'],
        backup: !argv['no-backup'],
        ignoreDirs: ['node_modules', 'dist', 'build', '.git']
    };
}

/**
 * Fix module formats
 * @param {Object} targets - Target options
 * @param {Object} options - Fix options
 * @returns {Promise<Object>} Results of the operation
 */
async function fixModuleFormats(targets, options) {
    logger.info('Starting module format fixes');

    const fixer = new ModuleFormatFixer({
        verbose: options.verbose,
        dryRun: options.dryRun,
        backup: options.backup,
        ignoreDirs: options.ignoreDirs
    });

    if (targets.file) {
        const result = await fixer.fixFile(targets.file);
        return { fixed: result ? 1 : 0, errors: result ? 0 : 1 };
    }

    if (targets.dir) {
        return await fixer.fixDirectory(targets.dir);
    }

    // Default to ZK library directory
    const zkLibDir = path.resolve(__dirname, '../');
    return await fixer.fixDirectory(zkLibDir);
}

/**
 * Fix test compatibility
 * @param {Object} targets - Target options
 * @param {Object} options - Fix options
 * @returns {Promise<Object>} Results of the operation
 */
async function fixTestCompat(targets, options) {
    logger.info('Starting test compatibility fixes');

    const fixer = new TestCompatibilityFixer({
        verbose: options.verbose,
        dryRun: options.dryRun,
        backup: options.backup,
        ignoreDirs: options.ignoreDirs
    });

    if (targets.file) {
        const result = await fixer.fixFile(targets.file);
        return { fixed: result ? 1 : 0, errors: result ? 0 : 1 };
    }

    if (targets.dir) {
        return await fixer.fixDirectory(targets.dir);
    }

    // Default to tests directory
    const testsDir = path.resolve(__dirname, '../tests');
    return await fixer.fixDirectory(testsDir);
}

/**
 * Generate regression tests
 * @param {Object} targets - Target options
 * @param {Object} options - Fix options
 * @returns {Promise<Object>} Results of the operation
 */
async function generateRegressionTests(targets, options) {
    logger.info('Starting regression test generation');

    const fixer = new RegressionTestFixer({
        verbose: options.verbose,
        dryRun: options.dryRun,
        backup: options.backup,
        ignoreDirs: options.ignoreDirs
    });

    if (targets.file) {
        const result = await fixer.processFile(targets.file);
        return { fixed: result ? 1 : 0, errors: result ? 0 : 1 };
    }

    if (targets.dir) {
        return await fixer.processDirectory(targets.dir);
    }

    // Default to tests directory
    const testsDir = path.resolve(__dirname, '../tests');
    return await fixer.processDirectory(testsDir);
}

/**
 * Apply specific module fixes
 * @param {Object} targets - Target options
 * @param {Object} options - Fix options
 * @returns {Promise<Object>} Results of the operation
 */
async function applySpecificFixes(targets, options) {
    logger.info('Starting specific module fixes');

    // If module is specified, only fix that module
    if (targets.module) {
        const fixer = new SpecificModuleFixer({
            verbose: options.verbose,
            dryRun: options.dryRun,
            backup: options.backup,
            ignoreDirs: options.ignoreDirs
        });

        if (targets.file) {
            const result = fixer.fixModule(targets.module, targets.file);
            return { fixed: result.fixed, errors: result.errors };
        }

        const result = fixer.fixModule(targets.module);
        return { fixed: result.fixed, errors: result.errors };
    }

    // Fix all registered modules
    return await fixSpecificModules({
        ...options,
        file: targets.file,
        dir: targets.dir
    });
}

/**
 * Run all fixes
 * @param {Object} targets - Target options
 * @param {Object} options - Fix options
 * @returns {Promise<Object>} Results of the operation
 */
async function runAllFixes(targets, options) {
    const results = {
        moduleFormats: { fixed: 0, errors: 0 },
        testCompat: { fixed: 0, errors: 0 },
        regression: { fixed: 0, errors: 0 },
        specific: { fixed: 0, errors: 0 },
        total: { fixed: 0, errors: 0 }
    };

    // Run all fixes in sequence
    logger.info('Running all fixes');

    try {
        // Module formats
        results.moduleFormats = await fixModuleFormats(targets, options);

        // Test compatibility
        results.testCompat = await fixTestCompat(targets, options);

        // Regression tests
        results.regression = await generateRegressionTests(targets, options);

        // Specific module fixes
        results.specific = await applySpecificFixes(targets, options);

        // Calculate totals
        results.total.fixed =
            results.moduleFormats.fixed +
            results.testCompat.fixed +
            results.regression.fixed +
            results.specific.fixed;

        results.total.errors =
            results.moduleFormats.errors +
            results.testCompat.errors +
            results.regression.errors +
            results.specific.errors;

        return results;
    } catch (error) {
        logger.error('Error running all fixes:', error.message);
        return results;
    }
}

/**
 * Main function
 */
async function main() {
    // Show help or version if requested
    if (argv.help) {
        showHelp();
    }

    if (argv.version) {
        showVersion();
    }

    // Configure logger
    logger.setLevel(argv.verbose ? 'debug' : 'info');

    // Get options and targets
    const options = getOptions();
    const targets = getTargets();

    try {
        let results = {};

        // Check which fixes to apply
        if (argv.all || (argv._ && argv._.includes('all'))) {
            // Run all fixes
            results = await runAllFixes(targets, options);

            logger.info('All fixes completed:');
            logger.info(`  Module formats: ${results.moduleFormats.fixed} fixed, ${results.moduleFormats.errors} errors`);
            logger.info(`  Test compatibility: ${results.testCompat.fixed} fixed, ${results.testCompat.errors} errors`);
            logger.info(`  Regression tests: ${results.regression.fixed} fixed, ${results.regression.errors} errors`);
            logger.info(`  Specific modules: ${results.specific.fixed} fixed, ${results.specific.errors} errors`);
            logger.info(`  Total: ${results.total.fixed} fixed, ${results.total.errors} errors`);
        } else {
            // Check for specific fix option
            const fixOption = argv.fix || (argv._ && argv._[0]);

            if (fixOption) {
                // Apply specific fix
                switch (fixOption) {
                    case 'module-formats':
                        results = await fixModuleFormats(targets, options);
                        break;
                    case 'test-compat':
                        results = await fixTestCompat(targets, options);
                        break;
                    case 'regression':
                        results = await generateRegressionTests(targets, options);
                        break;
                    case 'specific':
                        results = await applySpecificFixes(targets, options);
                        break;
                    default:
                        logger.error(`Unknown fix type: ${fixOption}`);
                        showHelp();
                        process.exit(1);
                }

                logger.info(`${fixOption} fixes completed: ${results.fixed} fixed, ${results.errors} errors`);
            } else if (argv['module-formats']) {
                // Module format fixes
                results = await fixModuleFormats(targets, options);
                logger.info(`Module format fixes completed: ${results.fixed} fixed, ${results.errors} errors`);
            } else if (argv['test-compat']) {
                // Test compatibility fixes
                results = await fixTestCompat(targets, options);
                logger.info(`Test compatibility fixes completed: ${results.fixed} fixed, ${results.errors} errors`);
            } else if (argv.regression) {
                // Regression test generation
                results = await generateRegressionTests(targets, options);
                logger.info(`Regression test generation completed: ${results.fixed} fixed, ${results.errors} errors`);
            } else if (argv.specific) {
                // Specific module fixes
                results = await applySpecificFixes(targets, options);
                logger.info(`Specific module fixes completed: ${results.fixed} fixed, ${results.errors} errors`);
            } else {
                // No fix type specified
                logger.error('No fix type specified');
                showHelp();
                process.exit(1);
            }
        }

        // Return success code if there were no errors
        process.exit(results.errors > 0 ? 1 : 0);
    } catch (error) {
        logger.error('Error running fix script:', error.message);
        process.exit(1);
    }
}

// Run main function
main().catch(error => {
    logger.error('Unhandled error:', error.message);
    process.exit(1);
}); 