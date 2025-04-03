/**
 * Jest configuration for ZK module testing
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // File patterns to test
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js'
  ],
  
  // Coverage reporting
  collectCoverage: true,
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    'lib/zk/**/*.js',
    'lib/zk/**/*.ts',
    '!lib/zk/**/*.d.ts',
    '!lib/zk/node_modules/**',
    '!lib/zk/coverage/**',
    '!lib/zk/build/**',
    '!lib/zk/scripts/**',
    '!lib/zk/jest.config.js',
  ],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },
  
  // Module name mappings
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  
  // Setup files
  setupFilesAfterEnv: ['./jest.setup.js'],
  
  // Timeout for tests (ZK operations can be slow)
  testTimeout: 30000,
  
  // Display options
  verbose: true,
};