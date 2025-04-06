/**
 * Integration Test Setup
 * 
 * This file sets up the environment for integration testing, including
 * loading the necessary libraries and setting up test data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Create directory for test results if it doesn't exist
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESULTS_DIR = path.join(__dirname, 'results');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Setup test console output capture for diagnostics
const consoleOutput = {
  log: [],
  warn: [],
  error: []
};

// Original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

// Function to start capturing console output
export function captureConsole() {
  console.log = (...args) => {
    consoleOutput.log.push(args.join(' '));
    originalConsole.log(...args);
  };
  
  console.warn = (...args) => {
    consoleOutput.warn.push(args.join(' '));
    originalConsole.warn(...args);
  };
  
  console.error = (...args) => {
    consoleOutput.error.push(args.join(' '));
    originalConsole.error(...args);
  };
}

// Function to restore original console methods
export function restoreConsole() {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

// Helper to determine if real circuits are available
export function areCircuitsAvailable() {
  const ZK_ROOT = path.join(__dirname, '../..');
  const BUILD_DIR = path.join(ZK_ROOT, 'build');
  
  // Check if build directory exists
  if (!fs.existsSync(BUILD_DIR)) {
    return false;
  }
  
  // Check for standard circuit artifacts
  const standardWasm = path.join(BUILD_DIR, 'standard/standardProof.wasm');
  const standardZkey = path.join(BUILD_DIR, 'standard/standardProof.zkey');
  
  return fs.existsSync(standardWasm) && fs.existsSync(standardZkey);
}

// Helper to get environment info for test reports
export function getEnvironmentInfo() {
  return {
    environment: typeof window !== 'undefined' ? 'browser' : 'node',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    circuitsAvailable: areCircuitsAvailable()
  };
}

// Clean up after tests
afterAll(() => {
  restoreConsole();
  
  // Save console output for diagnostics
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'console-output.json'),
    JSON.stringify(consoleOutput, null, 2)
  );
});

// Export helpers
export {
  consoleOutput,
  RESULTS_DIR
};