/**
 * Integration Test Runner
 * 
 * This script runs the integration tests for the ZK proof system.
 * It can run with real cryptographic operations or with mocks,
 * depending on the command line arguments.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = __dirname;
const buildDir = path.join(__dirname, '../../build');

// Test categories
const TEST_CATEGORIES = {
  CIRCUIT: 'circuit',
  MOCK_VALIDATION: 'mock-validation',
  SYSTEM: 'system'
};

// Check if circuit builds are available
function checkCircuitBuilds() {
  const circuitTypes = ['standard', 'threshold', 'maximum'];
  const missingCircuits = [];
  
  for (const type of circuitTypes) {
    const wasmPath = path.join(buildDir, `${type}/${type}Proof.wasm`);
    const zkeyPath = path.join(buildDir, `${type}/${type}Proof.zkey`);
    const vkeyPath = path.join(buildDir, `${type}/verification_key.json`);
    
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath) || !fs.existsSync(vkeyPath)) {
      missingCircuits.push(type);
    }
  }
  
  return {
    allAvailable: missingCircuits.length === 0,
    available: circuitTypes.filter(type => !missingCircuits.includes(type)),
    missing: missingCircuits
  };
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    category: null,
    skipReal: false,
    verbose: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--skip-real') {
      options.skipReal = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--category' || arg === '-c') {
      options.category = args[++i];
    } else if (!options.category) {
      options.category = arg;
    }
  }
  
  return options;
}

// Print help message
function printHelp() {
  console.log(`
Integration Test Runner
======================

Usage: node runIntegrationTests.js [options] [category]

Options:
  --category, -c   Test category to run (circuit, mock-validation, system)
  --skip-real      Skip tests that require real circuit builds
  --verbose, -v    Show verbose output
  --help, -h       Show this help message

Categories:
  circuit          Run circuit tests with real cryptographic operations
  mock-validation  Run tests that validate mock implementations against real ones
  system           Run system tests for client/server switching

Examples:
  node runIntegrationTests.js                   Run all tests
  node runIntegrationTests.js circuit           Run only circuit tests
  node runIntegrationTests.js --skip-real       Run tests that don't require real circuits
  `);
}

// Run tests for a specific category
async function runTests(category, skipReal) {
  console.log(`\n=== Running ${category} tests ===\n`);
  
  let testPath;
  
  if (category === TEST_CATEGORIES.CIRCUIT) {
    testPath = path.join(testDir, 'circuitTests');
  } else if (category === TEST_CATEGORIES.MOCK_VALIDATION) {
    testPath = path.join(testDir, 'mockValidation');
  } else if (category === TEST_CATEGORIES.SYSTEM) {
    testPath = path.join(testDir, 'systemTests');
  } else {
    console.error(`Unknown test category: ${category}`);
    return false;
  }
  
  // Check if we need real circuits
  if (!skipReal) {
    const builds = checkCircuitBuilds();
    
    if (!builds.allAvailable) {
      console.warn(`Warning: Some circuit builds are missing: ${builds.missing.join(', ')}`);
      console.warn('Tests requiring these circuits will be skipped.');
      
      if (builds.available.length === 0) {
        console.error('Error: No circuit builds available. Cannot run real cryptographic tests.');
        
        if (category === TEST_CATEGORIES.CIRCUIT) {
          console.error('Cannot run circuit tests without circuit builds.');
          return false;
        }
      }
    }
  }
  
  try {
    // Find test files
    const testFiles = fs.readdirSync(testPath)
      .filter(file => file.endsWith('.test.js'))
      .map(file => path.join(testPath, file));
    
    if (testFiles.length === 0) {
      console.warn(`No test files found in ${testPath}`);
      return true;
    }
    
    console.log(`Found ${testFiles.length} test files:`);
    testFiles.forEach(file => console.log(`- ${path.basename(file)}`));
    
    // Run each test file with Node.js
    for (const file of testFiles) {
      console.log(`\nRunning test: ${path.basename(file)}`);
      
      // Add a simplified test environment for files that might use Jest
      const jestShim = `
        // Simple Jest-like environment for integration tests
        globalThis.jest = {
          fn: (implementation = () => {}) => implementation,
          mock: (moduleName) => { console.log('Mocked:', moduleName); }
        };
        
        globalThis.describe = (description, fn) => {
          console.log('\\n== ' + description + ' ==');
          fn();
        };
        
        globalThis.test = globalThis.it = async (name, fn) => {
          try {
            console.log('- Testing: ' + name);
            await fn();
            console.log('  ✓ Passed');
          } catch (error) {
            console.error('  ✗ Failed: ' + error.message);
            throw error;
          }
        };
        
        globalThis.expect = (actual) => ({
          toBe: (expected) => {
            if (actual !== expected) {
              throw new Error('Expected ' + expected + ' but got ' + actual);
            }
          },
          toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              throw new Error('Not equal: ' + JSON.stringify(actual) + ' vs ' + JSON.stringify(expected));
            }
          },
          toBeDefined: () => {
            if (actual === undefined) {
              throw new Error('Expected value to be defined but got undefined');
            }
          },
          toBeGreaterThan: (expected) => {
            if (!(actual > expected)) {
              throw new Error('Expected ' + actual + ' to be greater than ' + expected);
            }
          }
        });
      `;
      
      try {
        // Create a simple wrapper script to run the test instead of modifying it
        const wrapper = `
        // Wrapper script to run test with Jest-like environment
        import { jest, describe, test, it, expect } from './jest-shim.mjs';
        import './test-file.mjs';
        `;
        
        const jestShimFile = path.join(os.tmpdir(), `jest-shim-${Date.now()}.mjs`);
        fs.writeFileSync(jestShimFile, `
        // Jest-like environment for tests
        export const jest = {
          fn: (impl = () => {}) => impl,
          mock: (name) => console.log('Mocked:', name)
        };
        
        export function describe(name, fn) {
          console.log('\\n=== ' + name + ' ===');
          fn();
        }
        
        export function test(name, fn) {
          return runTest(name, fn);
        }
        
        export function it(name, fn) {
          return runTest(name, fn);
        }
        
        async function runTest(name, fn) {
          try {
            console.log('- Test: ' + name);
            await fn();
            console.log('  ✓ Passed');
          } catch (error) {
            console.error('  ✗ Failed:', error.message);
            throw error;
          }
        }
        
        export function expect(actual) {
          return {
            toBe: (expected) => {
              if (actual !== expected) {
                throw new Error('Expected ' + expected + ' but got ' + actual);
              }
            },
            toEqual: (expected) => {
              const actualStr = JSON.stringify(actual);
              const expectedStr = JSON.stringify(expected);
              if (actualStr !== expectedStr) {
                throw new Error('Not equal: ' + actualStr + ' vs ' + expectedStr);
              }
            },
            toBeDefined: () => {
              if (actual === undefined) {
                throw new Error('Expected value to be defined');
              }
            },
            toBeGreaterThan: (expected) => {
              if (!(actual > expected)) {
                throw new Error('Expected ' + actual + ' to be > ' + expected);
              }
            },
            toBeLessThan: (expected) => {
              if (!(actual < expected)) {
                throw new Error('Expected ' + actual + ' to be < ' + expected);
              }
            }
          };
        }
        `);
        
        // Create a copy of the test file with .mjs extension
        const testFile = path.join(os.tmpdir(), `test-file-${Date.now()}.mjs`);
        fs.copyFileSync(file, testFile);
        
        // Create wrapper script
        const wrapperFile = path.join(os.tmpdir(), `wrapper-${Date.now()}.mjs`);
        fs.writeFileSync(wrapperFile, wrapper);
        
        // Run the test with a package.json that specifies "type": "module"
        const packageJsonFile = path.join(os.tmpdir(), `package-${Date.now()}.json`);
        fs.writeFileSync(packageJsonFile, '{"type": "module"}');
        
        // Copy the file to a directory with the package.json
        const testDir = path.join(os.tmpdir(), `test-dir-${Date.now()}`);
        fs.mkdirSync(testDir, { recursive: true });
        fs.copyFileSync(jestShimFile, path.join(testDir, 'jest-shim.mjs'));
        fs.copyFileSync(testFile, path.join(testDir, 'test-file.mjs'));
        fs.copyFileSync(wrapperFile, path.join(testDir, 'wrapper.mjs'));
        fs.copyFileSync(packageJsonFile, path.join(testDir, 'package.json'));
        
        // Run the test with Node
        const result = execSync(`cd ${testDir} && node wrapper.mjs`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        // Clean up
        try {
          fs.rmSync(testDir, { recursive: true, force: true });
        } catch (e) {
          // Fallback cleanup if rmSync fails
          try {
            fs.unlinkSync(path.join(testDir, 'jest-shim.mjs'));
            fs.unlinkSync(path.join(testDir, 'test-file.mjs'));
            fs.unlinkSync(path.join(testDir, 'wrapper.mjs'));
            fs.unlinkSync(path.join(testDir, 'package.json'));
            fs.rmdirSync(testDir);
          } catch (e2) {
            console.warn(`Warning: Could not fully clean up temp directory ${testDir}`);
          }
        }
        
        try {
          fs.unlinkSync(jestShimFile);
          fs.unlinkSync(testFile);
          fs.unlinkSync(wrapperFile);
          fs.unlinkSync(packageJsonFile);
        } catch (e) {
          // Ignore errors when cleaning up temp files
        }
        
        console.log(result);
        console.log(`✓ ${path.basename(file)} passed`);
      } catch (error) {
        console.error(`✗ ${path.basename(file)} failed:`);
        console.error(error.stdout || error.message);
        
        // Clean up even on error
        try {
          fs.rmSync(testDir, { recursive: true, force: true });
          fs.unlinkSync(jestShimFile);
          fs.unlinkSync(testFile);
          fs.unlinkSync(wrapperFile);
          fs.unlinkSync(packageJsonFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error running tests: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    printHelp();
    return;
  }
  
  console.log('===================================');
  console.log('ZK Proof System Integration Tests');
  console.log('===================================');
  
  if (options.skipReal) {
    console.log('Skipping tests that require real circuit builds');
  }
  
  let success = true;
  
  if (options.category) {
    // Run specific category
    success = await runTests(options.category, options.skipReal);
  } else {
    // Run all categories
    for (const category of Object.values(TEST_CATEGORIES)) {
      const categorySuccess = await runTests(category, options.skipReal);
      success = success && categorySuccess;
    }
  }
  
  console.log('\n===================================');
  if (success) {
    console.log('✓ All tests passed');
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});