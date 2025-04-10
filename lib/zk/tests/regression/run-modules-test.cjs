#!/usr/bin/env node

/**
 * Module System Test Runner
 * 
 * This script runs both ESM and CommonJS tests to verify that our module system 
 * standardization is working correctly.
 */

const { execSync } = require('child_process');
const path = require('path');

// Get the project root directory
const projectRoot = path.resolve(__dirname, '../../');
const rootDir = path.resolve(projectRoot, '../..');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

console.log(`${BLUE}=== Module System Test Runner ===${RESET}`);
console.log(`Project root: ${projectRoot}`);
console.log(`Working directory: ${process.cwd()}`);

// Run the CommonJS test
console.log(`\n${YELLOW}Running CommonJS module test...${RESET}`);
try {
  const cjsOutput = execSync(`node ${projectRoot}/test-modules.cjs`, { encoding: 'utf8' });
  console.log(cjsOutput);
  console.log(`${GREEN}CommonJS test completed successfully${RESET}`);
} catch (error) {
  console.error(`${RED}CommonJS test failed with error:${RESET}`);
  console.error(error.message);
}

// Run the ESM test
console.log(`\n${YELLOW}Running ESM module test...${RESET}`);
try {
  const esmOutput = execSync(`node ${projectRoot}/test-modules.js`, { encoding: 'utf8' });
  console.log(esmOutput);
  console.log(`${GREEN}ESM test completed successfully${RESET}`);
} catch (error) {
  console.error(`${RED}ESM test failed with error:${RESET}`);
  console.error(error.message);
}

console.log(`\n${BLUE}Module system tests completed${RESET}`);
