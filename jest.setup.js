/**
 * Jest Setup File
 * 
 * This file runs before all tests to set up the test environment.
 * It's particularly important for the ZK proof tests because it:
 * 1. Mocks global objects like fetch that may not be available in Node.js
 * 2. Sets up mock behaviors for external dependencies
 * 3. Handles environment-specific configurations
 */

// Mock global fetch
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Mock browser crypto API 
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: () => Promise.resolve(new ArrayBuffer(32))
    }
  };
}

// Handle BigInt serialization in JSON 
// This is important because the ZK proofs use BigInt values
BigInt.prototype.toJSON = function() {
  return this.toString();
};

// Set up node environment for CircomLib and other libraries that need it
process.env.NODE_ENV = 'test';