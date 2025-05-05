/**
 * Test script for isolated testing of each module individually
 * This bypasses Node.js module caching by spawning separate processes
 * for each test.
 */

import { spawnSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

// List of modules to test
const modulesToTest = [
  './lib/zk/src/zkCircuitInputs.js',
  './lib/zk/src/zkCircuitRegistry.js',
  './lib/zk/src/zkCircuitParameterDerivation.mjs',
  './lib/zk/src/zkUtils.mjs',
  './lib/zk/src/browserCompatibility.mjs'
];

// Results storage
const results = {
  passed: 0,
  failed: 0,
  details: []
};

// Helper function to create test code for a module
function createTestCode(modulePath) {
  return `
    import * as module from '${modulePath}';
    console.log('MODULE_IMPORTED_SUCCESSFULLY');
    process.exit(0);
  `;
}

// Run a test for a single module
function testModule(modulePath) {
  console.log(`Testing ${modulePath}...`);
  
  const testFile = './temp-test.mjs';
  
  try {
    // Create a temporary test file
    writeFileSync(testFile, createTestCode(modulePath));
    
    // Run the test in a separate process
    const result = spawnSync('node', [testFile], { 
      encoding: 'utf8',
      timeout: 5000
    });
    
    // Check if import succeeded
    const success = result.stdout.includes('MODULE_IMPORTED_SUCCESSFULLY');
    
    if (success) {
      results.passed++;
      results.details.push(`✅ ${modulePath}`);
    } else {
      results.failed++;
      results.details.push(`❌ ${modulePath}: ${result.stderr.trim()}`);
    }
    
    // Clean up
    unlinkSync(testFile);
    
  } catch (error) {
    results.failed++;
    results.details.push(`❌ ${modulePath}: ${error.message}`);
    
    // Clean up if file exists
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  }
}

// Run tests for all modules
function runAllTests() {
  console.log('Running isolated tests for each module...\n');
  
  modulesToTest.forEach(testModule);
  
  // Print results
  console.log('\n--- TEST RESULTS ---');
  console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
  results.details.forEach(detail => console.log(detail));
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! All modules can be imported successfully.');
  } else {
    console.log(`\n❌ ${results.failed} modules failed. Implementation is not yet complete.`);
  }
}

// Run the tests
runAllTests();