/**
 * Jest configuration for the project
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // File patterns to test
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js'
  ],
  
  // Use ESM for tests
  extensionsToTreatAsEsm: ['.ts'],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },
  
  // Module name mappings
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  
  // Timeout for tests (ZK operations can be slow)
  testTimeout: 30000,
  
  // Add WebAssembly mock for tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  
  // Display options
  verbose: true,
};