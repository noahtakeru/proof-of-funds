#!/usr/bin/env node

/**
 * Script to run the Module Format Standardizer on the codebase
 * 
 * Usage:
 *   node run-module-standardizer.js [options]
 * 
 * Options:
 *   --target=<dir>    Specify target directory (default: src)
 *   --dry-run         Preview changes without making them
 *   --verbose         Show detailed logs
 *   --no-rename       Don't rename files, just fix content
 *   --help            Show this help message
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { runModuleStandardization } from './module-formats-enhanced.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const argv = process.argv.slice(2);
const options = {
  dryRun: argv.includes('--dry-run'),
  verbose: argv.includes('--verbose'),
  renameFiles: !argv.includes('--no-rename')
};

// Parse target directory
const targetArg = argv.find(arg => arg.startsWith('--target='));
if (targetArg) {
  options.targetDir = targetArg.split('=')[1];
}

// Show help
if (argv.includes('--help')) {
  console.log(`
Module Format Standardizer

Standardizes JavaScript module formats across the codebase.

Usage:
  node run-module-standardizer.js [options]

Options:
  --target=<dir>    Specify target directory (default: src)
  --dry-run         Preview changes without making them
  --verbose         Show detailed logs
  --no-rename       Don't rename files, just fix content
  --help            Show this help message

Examples:
  # Run in dry-run mode to preview changes
  node run-module-standardizer.js --dry-run --verbose
  
  # Fix a specific directory
  node run-module-standardizer.js --target=src/deployment

  # Fix content without renaming files
  node run-module-standardizer.js --no-rename
  `);
  process.exit(0);
}

console.log('Starting Module Format Standardizer...');
if (options.dryRun) {
  console.log('Running in dry-run mode - no changes will be made');
}

runModuleStandardization(options)
  .then(stats => {
    console.log('\nModule standardization completed successfully!');
    if (stats.errors > 0) {
      console.warn(`Warning: ${stats.errors} errors were encountered during standardization`);
    }
  })
  .catch(error => {
    console.error(`Error running module standardization: ${error.message}`);
    process.exit(1);
  });