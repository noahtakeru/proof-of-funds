/**
 * Jest configuration for the project
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

  // Use ESM for tests - Note: .mjs files are always treated as an ECMAScript Module
  extensionsToTreatAsEsm: ['.ts'],

  // Transform TypeScript files and JavaScript
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: './tsconfig.json'
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      configFile: './babel.config.cjs'
    }],
    '^.+\\.mjs$': ['babel-jest', {
      configFile: './babel.config.cjs',
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: false // Preserve ESM modules
        }]
      ]
    }]
  },

  // Module name mappings
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Handle .js files that use ESM
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Specify file extensions for module resolution
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'node'],

  // Timeout for tests (ZK operations can be slow)
  testTimeout: 30000,

  // Add WebAssembly mock for tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],

  // Ignore transformations for node_modules except specific packages
  transformIgnorePatterns: [
    '/node_modules/(?!(@babel|js-sha3)/)'
  ],

  // Runner for handling ESM modules
  runner: 'jest-runner',

  // Display options
  verbose: true,
};