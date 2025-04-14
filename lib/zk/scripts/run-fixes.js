#!/usr/bin/env node

/**
 * Script to run code fixes for the ZK library
 * 
 * This script runs the following fixers:
 * 1. ModuleFormatFixer - Converts CommonJS to ESM
 * 2. TestCompatFixer - Updates tests to use Node.js test runner
 * 
 * Usage:
 *   node run-fixes.js [options]
 * 
 * Options:
 *   --modules-only     Only run the module format fixer
 *   --tests-only       Only run the test compatibility fixer
 *   --dry-run          Run without making changes
 *   --verbose          Show detailed output
 *   --no-backup        Don't create backups before making changes
 *   --dir=<path>       Only process specified directory
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'node:util';
import logger from './common/logger.js';
import { ModuleFormatFixer } from './fixes/module-formats.js';
import { TestCompatFixer } from './fixes/test-compat.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go up to the zk lib root directory
const zkLibRoot = path.resolve(__dirname, '..');

// Parse command line arguments
const { values: args } = parseArgs({
    options: {
        'modules-only': { type: 'boolean', default: false },
        'tests-only': { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        'verbose': { type: 'boolean', short: 'v', default: false },
        'no-backup': { type: 'boolean', default: false },
        'dir': { type: 'string' }
    }
});

async function runFixes() {
    console.log('🔧 Running ZK library code fixes 🔧');

    // Determine which directory to process
    const targetDir = args.dir ? path.resolve(process.cwd(), args.dir) : zkLibRoot;

    console.log(`Target directory: ${targetDir}`);
    console.log(`Dry run: ${args['dry-run'] ? 'Yes' : 'No'}`);
    console.log(`Create backups: ${!args['no-backup'] ? 'Yes' : 'No'}`);

    // Configure and run the module format fixer
    if (!args['tests-only']) {
        console.log('\n📦 Running module format fixes...');
        const moduleFormatter = new ModuleFormatFixer({
            verbose: args.verbose,
            dryRun: args['dry-run'],
            backup: !args['no-backup']
        });

        const moduleStats = await moduleFormatter.fixDirectory(targetDir);
        console.log('Module fixes complete:');
        console.log(`  - Files fixed: ${moduleStats.fixed}`);
        console.log(`  - Files skipped: ${moduleStats.skipped}`);
        console.log(`  - Errors: ${moduleStats.errors}`);
    }

    // Configure and run the test compatibility fixer
    if (!args['modules-only']) {
        console.log('\n🧪 Running test compatibility fixes...');
        const testFixer = new TestCompatFixer({
            verbose: args.verbose,
            dryRun: args['dry-run'],
            backup: !args['no-backup']
        });

        const testStats = await testFixer.fixDirectory(targetDir);
        console.log('Test compatibility fixes complete:');
        console.log(`  - Files fixed: ${testStats.fixed}`);
        console.log(`  - Files skipped: ${testStats.skipped}`);
        console.log(`  - Errors: ${testStats.errors}`);
    }

    console.log('\n✅ All fixes complete!');

    if (args['dry-run']) {
        console.log('\n⚠️  This was a dry run. No changes were made.');
        console.log('   Run without --dry-run to apply changes.');
    }
}

// Run the fixes and handle any errors
runFixes().catch(error => {
    logger.error(`Error running fixes: ${error.message}`);
    console.error(error);
    process.exit(1);
}); 