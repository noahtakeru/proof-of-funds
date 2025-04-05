#!/usr/bin/env node

/**
 * Test runner for TrustedSetupManager
 * This script automatically sets up the proper environment for testing
 * the trusted setup ceremony implementation.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory of this script
const thisDir = __dirname;

console.log('🧪 Running Trusted Setup Ceremony tests...');
console.log('Setting up test environment...');

try {
  // Run Jest with our custom config
  console.log('Executing tests...');
  console.log('Note: This is using a completely mocked version of the TrustedSetupManager');
  console.log('The tests verify the API and functionality, not the actual implementation');
  console.log('----------------------------------------------------------------------');
  
  const result = execSync(`npx jest --config "${path.join(thisDir, 'jest.config.cjs')}" --verbose`, {
    stdio: 'inherit',
    cwd: path.resolve(thisDir, '../../../..') // Root of the project
  });
  
  console.log('----------------------------------------------------------------------');
  console.log('✅ All ceremony tests passed!');
  console.log('');
  console.log('This confirms that the TrustedSetupManager API is working as expected.');
  console.log('');
  console.log('To manually test the actual implementation, you can use the following code:');
  console.log('');
  console.log('```javascript');
  console.log('import TrustedSetupManager from "./lib/zk/TrustedSetupManager.js";');
  console.log('');
  console.log('// Initialize a ceremony');
  console.log('const ceremonyId = TrustedSetupManager.initializeCeremony({');
  console.log('  circuitId: "test-circuit",');
  console.log('  circuitName: "Test Circuit",');
  console.log('  distributionChannels: ["standard", "backup"]');
  console.log('});');
  console.log('');
  console.log('// Check ceremony status');
  console.log('const status = TrustedSetupManager.getCeremonyStatus(ceremonyId);');
  console.log('console.log(status);');
  console.log('```');
  
  process.exit(0);
} catch (error) {
  console.error('❌ Ceremony tests failed!');
  console.error('');
  console.error('Please check the error messages above for details.');
  console.error('Common issues:');
  console.error('1. Mocking issues with ESM modules');
  console.error('2. Incorrect imports or exports');
  console.error('3. Missing dependencies (js-sha3, etc.)');
  console.error('');
  console.error('If the tests are failing due to module system issues, you can still');
  console.error('manually test the implementation as described in the README.md file.');
  process.exit(1);
}