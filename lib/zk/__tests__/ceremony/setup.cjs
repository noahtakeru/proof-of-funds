/**
 * Setup file for ceremony tests
 * Provides global mocks and helpers for testing the ceremony process
 */

// Mock Web Crypto API for Node.js environment
global.crypto = {
  getRandomValues: function(buffer) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  },
  subtle: {
    digest: jest.fn().mockImplementation(() => {
      return Promise.resolve(new Uint8Array(32).fill(1).buffer);
    }),
    importKey: jest.fn().mockResolvedValue('imported-key'),
    encrypt: jest.fn().mockImplementation(() => {
      return Promise.resolve(new Uint8Array(64).fill(2).buffer);
    }),
    decrypt: jest.fn().mockImplementation(() => {
      return Promise.resolve(new Uint8Array(32).fill(3).buffer);
    }),
    deriveBits: jest.fn().mockImplementation(() => {
      return Promise.resolve(new Uint8Array(32).fill(4).buffer);
    }),
    sign: jest.fn().mockImplementation(() => {
      return Promise.resolve(new Uint8Array(64).fill(5).buffer);
    }),
    verify: jest.fn().mockResolvedValue(true),
  }
};

// TextEncoder/TextDecoder polyfill
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(text) {
      const encoder = new util.TextEncoder();
      return encoder.encode(text);
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(buffer) {
      const decoder = new util.TextDecoder();
      return decoder.decode(buffer);
    }
  };
}

// Mock window and sessionStorage
global.window = {
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
};

// Console mocks to suppress unnecessary output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();

// Clean up function to restore console
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});