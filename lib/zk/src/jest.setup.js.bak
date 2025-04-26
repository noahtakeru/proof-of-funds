/**
 * Jest setup file for ZK module testing
 * 
 * This file runs before the tests and can be used to set up the environment,
 * add custom matchers, and configure global test behavior.
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

// Add custom matchers for ZK-specific testing
expect.extend({
  toBeValidProof(received) {
    const pass = received && 
                 typeof received === 'object' && 
                 received.proof && 
                 Array.isArray(received.publicSignals);
                 
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid proof format`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid proof format`,
        pass: false,
      };
    }
  }
});