/**
 * Jest setup file
 */

// Increase timeout for all tests due to ZK operations being potentially slow
jest.setTimeout(30000);

// Add a global mock for WebAssembly if needed in Node.js environment
global.WebAssembly = global.WebAssembly || {
  compile: jest.fn().mockImplementation(() => ({ 
    instance: { exports: {} } 
  })),
  instantiate: jest.fn().mockImplementation(() => ({ 
    instance: { exports: {} } 
  }))
};

// Mock browser APIs that might not be available in Node
global.window = global.window || {};
global.navigator = global.navigator || { 
  userAgent: 'node-test',
  deviceMemory: 8,
  hardwareConcurrency: 4
};