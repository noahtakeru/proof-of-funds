/**
 * Jest configuration for ZK module testing
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // File patterns to test
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.test.cjs',
    '**/__tests__/**/*.test.mjs',
    '**/__tests__/**/*.spec.js',
    '**/__tests__/**/*.spec.cjs',
    '**/__tests__/**/*.spec.mjs'
  ],
  
  // Coverage reporting
  collectCoverage: true,
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    'lib/zk/**/*.js',
    'lib/zk/**/*.mjs',
    'lib/zk/**/*.ts',
    '\!lib/zk/**/*.d.ts',
    '\!lib/zk/node_modules/**',
    '\!lib/zk/coverage/**',
    '\!lib/zk/build/**',
    '\!lib/zk/scripts/**',
    '\!lib/zk/jest.config.js',
    '\!lib/zk/cjs/**'
  ],
  
  // Transform TypeScript files and handle ESM modules
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.(js|jsx|mjs)$': ['babel-jest', { configFile: './babel.config.cjs' }]
  },
  
  // Configure extensionsToTreatAsEsm for .mjs files
  extensionsToTreatAsEsm: ['.mjs'],
  
  // Ignore node_modules from transformation
  transformIgnorePatterns: [
    '/node_modules/(?!(@babel)/)'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'node'],
  
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
