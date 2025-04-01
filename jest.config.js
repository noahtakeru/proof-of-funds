export default {
  // The test environment that will be used for testing
  testEnvironment: 'node',

  // An array of file extensions your modules use
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],

  // Testpath pattern matching
  testMatch: ['**/__tests__/**/*.test.js'],

  // Ignore transformations for node_modules except for specific packages
  transformIgnorePatterns: [
    '/node_modules/(?!snarkjs|ffjavascript|circomlibjs).+\\.js$',
  ],

  // Path mappings for module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Setup files before tests
  setupFiles: ['<rootDir>/jest.setup.js'],

  // Handles specific module loading issues for Jest with ES modules
  transform: {
    // Babel with preset-env for handling modern JS syntax
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // Test timeout
  testTimeout: 30000,
};