#!/usr/bin/env node
/**
 * @fileoverview Test runner for MemoryEfficientCache tests
 * 
 * This script runs the tests for the MemoryEfficientCache implementation
 * and reports the results.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Running MemoryEfficientCache Tests...');

// Path to the test file
const testFile = resolve(__dirname, 'MemoryEfficientCacheTest.js');

// Run the test with Node.js with experimental modules flag
const testProcess = spawn('node', ['--experimental-modules', testFile], {
    stdio: 'inherit'
});

// Handle process exit
testProcess.on('close', (code) => {
    if (code === 0) {
        console.log('✅ Tests completed successfully');
        process.exit(0);
    } else {
        console.error(`❌ Tests failed with code ${code}`);
        process.exit(1);
    }
}); 