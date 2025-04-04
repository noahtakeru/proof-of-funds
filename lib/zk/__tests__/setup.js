/**
 * Jest setup file for ZK tests
 * 
 * This file is loaded before tests run and sets up the testing environment.
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Create directory for reports if it doesn't exist
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.join(__dirname, 'reports');

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// Configure Jest timeout for longer-running ZK operations
jest.setTimeout(30000); // 30 seconds

// Mock console for tests
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

const consoleOutput = {
  log: [],
  warn: [],
  error: []
};

// Enhanced console capturing for reports
function captureConsole() {
  console.log = (...args) => {
    consoleOutput.log.push(args.join(' '));
    originalConsole.log(...args);
  };
  
  console.warn = (...args) => {
    // Filter out specific warning messages
    const message = args.join(' ');
    if (message.includes('deprecated') || message.includes('experimental')) {
      return;
    }
    
    consoleOutput.warn.push(args.join(' '));
    originalConsole.warn(...args);
  };
  
  console.error = (...args) => {
    // Filter out specific error messages
    const message = args.join(' ');
    if (message.includes('test error that should be suppressed')) {
      return;
    }
    
    consoleOutput.error.push(args.join(' '));
    originalConsole.error(...args);
  };
}

function restoreConsole() {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

// Set up global mocks for Node.js
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  // Import Node.js utilities using dynamic imports to avoid require()
  const setupNodeUtils = async () => {
    try {
      // TextEncoder/Decoder for Node.js
      if (!global.TextEncoder || !global.TextDecoder) {
        const util = await import('util');
        global.TextEncoder = global.TextEncoder || util.TextEncoder;
        global.TextDecoder = global.TextDecoder || util.TextDecoder;
      }
      
      // Mock browser APIs when running in Node.js
      if (typeof window === 'undefined') {
        const crypto = await import('crypto');
        global.window = {
          crypto: {
            getRandomValues: (buffer) => {
              const bytes = crypto.randomBytes(buffer.length);
              buffer.set(bytes);
              return buffer;
            }
          },
          performance: {
            now: () => Date.now(),
            memory: {
              usedJSHeapSize: 0,
              totalJSHeapSize: 0
            }
          }
        };
      }
    } catch (error) {
      console.error('Error setting up Node.js utilities:', error);
    }
  };
  
  // Execute the async setup
  setupNodeUtils();
  
  // Mock WebAssembly if not available
  if (typeof global.WebAssembly === 'undefined') {
    global.WebAssembly = {
      compile: jest.fn(() => Promise.resolve({})),
      instantiate: jest.fn(() => Promise.resolve({})),
      Module: jest.fn(function() { return {}; }),
      Instance: jest.fn(function() { return {}; })
    };
  }
}

// Setup environment detection for tests
global.__TESTING__ = true;
global.__BROWSER__ = typeof window !== 'undefined';
global.__NODE__ = typeof process !== 'undefined' && process.versions && process.versions.node;

/**
 * Helper to get device info for tests
 * This ensures consistent device reporting in tests
 */
function getTestDeviceInfo() {
  return {
    environment: global.__BROWSER__ ? 'browser' : 'node',
    memoryAvailable: global.__BROWSER__ ? 4096 : 8192, // MB
    processorCores: 4,
    browserName: global.__BROWSER__ ? 'chrome' : null,
    browserVersion: global.__BROWSER__ ? '100.0.0' : null,
    nodeVersion: global.__NODE__ ? process.versions.node : null,
    platform: global.__NODE__ ? process.platform : navigator?.platform
  };
}

// Clean up process when tests finish
afterAll(() => {
  // Restore original console functions
  restoreConsole();
});

export {
  captureConsole,
  restoreConsole,
  consoleOutput,
  getTestDeviceInfo,
  REPORT_DIR
};