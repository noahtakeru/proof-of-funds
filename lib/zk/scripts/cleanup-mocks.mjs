/**
 * Mock and Backup File Cleanup Script
 * 
 * This script helps identify and clean up mock implementations and backup files
 * that were created during the module standardization process.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import glob from 'glob';

// Setup helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const globPromise = promisify(glob);

// Project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// Files to clean up by category
const FILES_TO_CLEAN = {
  // Category 1: Backup files from module standardization
  backupFiles: [
    // Deployment module backups
    'lib/zk/src/deployment/**/*.bak',
    'lib/zk/src/deployment/**/*.js.bak',
    // Utils module backups
    'lib/zk/src/utils/**/*.bak',
    'lib/zk/src/utils/**/*.js.bak',
    // Resources module backups
    'lib/zk/src/resources/**/*.bak',
    'lib/zk/src/resources/**/*.js.bak',
    // Security module backups
    'lib/zk/src/security/**/*.bak',
    'lib/zk/src/security/**/*.js.bak',
    // Root module backups
    'lib/zk/src/*.bak',
    'lib/zk/src/*.js.bak',
    // CJS module backups
    'lib/zk/src/cjs/**/*.bak',
    'lib/zk/src/admin/cjs/**/*.bak',
    'lib/zk/src/analytics/cjs/**/*.bak',
    'lib/zk/src/monitoring/cjs/**/*.bak',
  ],
  
  // Category 2: Core mock files that can be safely removed
  mockFiles: [
    // Test mocks
    'lib/zk/__tests__/mocks.js',
    'lib/zk/__tests__/ceremony/__mocks__/fileMock.js',
    'lib/zk/__tests__/ceremony/__mocks__/styleMock.js',
    // Error test harnesses
    'lib/zk/cjs/zkErrorTestHarness.cjs',
    'lib/zk/src/zkErrorTestHarness.js',
    'lib/zk/src/zkErrorTestHarness.mjs',
    // Test inputs (these should be regenerated with real data)
    'lib/zk/test-inputs/*.json',
  ],
  
  // Category 3: Duplicate JS files that have been replaced by MJS/CJS files
  duplicateFiles: [
    // Deployment files
    'lib/zk/src/deployment/**/*.js',
    // Utils files
    'lib/zk/src/utils/**/*.js',
    // Resources files
    'lib/zk/src/resources/**/*.js',
    // Security files
    'lib/zk/src/security/**/*.js',
  ]
};

// Files to exclude from removal (keep these even if they match patterns)
const EXCLUDE_FILES = [
  // Critical files with mixed mock/real implementations
  'lib/zk/src/zkUtils.js',
  'lib/zk/src/zkSecureInputs.js',
  'lib/zk/src/secureStorage.js',
  'lib/zk/src/TrustedSetupManager.js',
  // Important configuration and utility files
  'lib/zk/src/constants.js',
  'lib/zk/src/index.js',
  // Placeholder for Webpack/Babel config
  'lib/zk/src/index.cjs',
];

// Function to find files matching patterns
async function findFiles(patterns, excludePatterns = []) {
  const allMatchingFiles = [];
  
  for (const pattern of patterns) {
    const files = await globPromise(pattern, { cwd: PROJECT_ROOT });
    allMatchingFiles.push(...files);
  }
  
  // Remove duplicates
  const uniqueFiles = [...new Set(allMatchingFiles)];
  
  // Apply exclusions
  const filteredFiles = uniqueFiles.filter(file => {
    for (const excludePattern of excludePatterns) {
      if (file === excludePattern || file.includes(excludePattern)) {
        return false;
      }
    }
    return true;
  });
  
  return filteredFiles;
}

// Function to delete files
async function deleteFiles(files, dryRun = true) {
  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Deleting ${files.length} files:`);
  
  for (const file of files) {
    const fullPath = path.join(PROJECT_ROOT, file);
    
    try {
      if (!dryRun) {
        await fs.unlink(fullPath);
        console.log(`  ✅ Deleted: ${file}`);
      } else {
        console.log(`  📋 Would delete: ${file}`);
      }
    } catch (error) {
      console.error(`  ❌ Error deleting ${file}: ${error.message}`);
    }
  }
}

// Main function
async function cleanup(options = { dryRun: true, category: 'all' }) {
  console.log(`Mock and Backup File Cleanup Script`);
  console.log(`=================================`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no files will be deleted)' : 'LIVE RUN (files will be deleted)'}`);
  console.log(`Category: ${options.category}`);
  
  try {
    if (options.category === 'all' || options.category === 'backup') {
      const backupFiles = await findFiles(FILES_TO_CLEAN.backupFiles, EXCLUDE_FILES);
      console.log(`\nFound ${backupFiles.length} backup files`);
      await deleteFiles(backupFiles, options.dryRun);
    }
    
    if (options.category === 'all' || options.category === 'mock') {
      const mockFiles = await findFiles(FILES_TO_CLEAN.mockFiles, EXCLUDE_FILES);
      console.log(`\nFound ${mockFiles.length} mock files`);
      await deleteFiles(mockFiles, options.dryRun);
    }
    
    if (options.category === 'all' || options.category === 'duplicate') {
      const duplicateFiles = await findFiles(FILES_TO_CLEAN.duplicateFiles, EXCLUDE_FILES);
      console.log(`\nFound ${duplicateFiles.length} duplicate files`);
      await deleteFiles(duplicateFiles, options.dryRun);
    }
    
    console.log(`\n${options.dryRun ? '[DRY RUN] ' : ''}Cleanup complete!`);
    if (options.dryRun) {
      console.log(`To actually delete these files, run this script with --live`);
    }
  } catch (error) {
    console.error(`Error during cleanup: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: !args.includes('--live'),
  category: 'all'
};

if (args.includes('--backup')) options.category = 'backup';
if (args.includes('--mock')) options.category = 'mock';
if (args.includes('--duplicate')) options.category = 'duplicate';

// Run the cleanup
cleanup(options);