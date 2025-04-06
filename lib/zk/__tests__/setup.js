/**
 * Jest setup file for ZK tests
 * 
 * This file is loaded before tests run and sets up the testing environment.
 */

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

// Mock ethers library for testing
const mockEthers = {
  utils: {
    isAddress: (address) => {
      // Simple validation for testing - any string that looks like an Ethereum address
      return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address);
    },
    getAddress: (address) => {
      // Return checksummed address (simplified for testing)
      return address; // Just return as-is for testing
    },
    keccak256: (value) => {
      // Simple mock hash function for testing
      if (typeof value === 'string') {
        return '0x' + Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0).toString(16), '');
      }
      return '0x1234567890abcdef1234567890abcdef12345678';
    },
    toUtf8Bytes: (text) => {
      // Convert string to bytes
      return text;
    },
    hexlify: (value) => {
      // Convert to hex string
      if (typeof value === 'string') {
        if (value.startsWith('0x')) return value;
        return '0x' + value;
      }
      return '0x1234';
    },
    arrayify: (value) => {
      // Convert hex to Uint8Array (simplified)
      return new Uint8Array([1, 2, 3, 4]);
    },
    recoverPublicKey: () => {
      // Mock public key recovery
      return '0x1234567890abcdef1234567890abcdef12345678';
    },
    splitSignature: () => {
      // Mock signature splitting
      return {
        r: '0x1234567890abcdef1234567890abcdef12345678',
        s: '0x1234567890abcdef1234567890abcdef12345678',
        v: 27
      };
    }
  },
  BigNumber: {
    from: (value) => {
      // Simple BigNumber mock for testing
      const numValue = Number(value);
      return {
        toString: () => String(numValue),
        lt: (other) => numValue < Number(other.toString()),
        gt: (other) => numValue > Number(other.toString()),
        mul: (other) => ({
          toString: () => String(numValue * Number(other.toString())),
          lt: (o) => numValue * Number(other.toString()) < Number(o.toString()),
          gt: (o) => numValue * Number(other.toString()) > Number(o.toString())
        }),
        div: (other) => ({
          toString: () => String(Math.floor(numValue / Number(other.toString()))),
          lt: (o) => Math.floor(numValue / Number(other.toString())) < Number(o.toString()),
          gt: (o) => Math.floor(numValue / Number(other.toString())) > Number(o.toString())
        })
      };
    }
  }
};

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

// Export mocks for test modules to use
export const testMocks = {
  ethers: mockEthers
};

// Export all helpers
export {
  captureConsole,
  restoreConsole,
  consoleOutput,
  getTestDeviceInfo,
  REPORT_DIR,
  mockEthers
};

// Default export for importing in test files
export default {
  testMocks,
  mockEthers,
  captureConsole,
  restoreConsole,
  consoleOutput,
  getTestDeviceInfo,
  REPORT_DIR
};