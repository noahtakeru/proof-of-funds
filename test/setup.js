/**
 * Test setup file for Jest
 * 
 * This file sets up the test environment before running tests.
 * It includes mocks for browser-specific APIs that might be used in our code.
 */

// Mock for crypto.getRandomValues which is browser-specific
global.crypto = {
    getRandomValues: function (buffer) {
        return require('crypto').randomFillSync(buffer);
    },

    // Add other crypto methods that might be used
    subtle: {
        digest: jest.fn().mockImplementation((algorithm, data) => {
            return Promise.resolve(new ArrayBuffer(32)); // Mock digest result
        })
    }
};

// Mock for Web3Provider
global.Web3Provider = jest.fn().mockImplementation(() => {
    return {
        getSigner: jest.fn().mockReturnValue({
            signMessage: jest.fn().mockResolvedValue('0xmocksignature')
        })
    };
});

// Mock for localStorage
global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

// Mock for window
global.window = {
    crypto: global.crypto,
    localStorage: global.localStorage,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
};

// Mock for document
global.document = {
    createElement: jest.fn(),
    getElementById: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn()
};

// Suppress console.error during tests
// but keep it available for debugging if needed
const originalConsoleError = console.error;
console.error = (...args) => {
    if (process.env.DEBUG) {
        originalConsoleError(...args);
    }
};

// Setup Jest lifecycle hooks in the correct context
describe('Global Test Setup', () => {
    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
    });
}); 