/**
 * Jest Configuration for Backend
 */
const path = require('path');

module.exports = {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>/src'],

  // The test environment that will be used for testing
  testEnvironment: 'node',

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.js?(x)',
    '**/?(*.)+(spec|test).js?(x)',
    '**/__tests__/**/*.ts?(x)',
    '**/?(*.)+(spec|test).ts?(x)'
  ],
  
  // Modify Jest's handling of TypeScript for our custom types
  moduleNameMapper: {
    '^@proof-of-funds/db/test/(.*)$': '<rootDir>/../db/test/$1',
    '^../../test/(.*)$': '<rootDir>/test/$1'
  },

  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },

  // The paths to modules that run some code to configure or set up the testing environment before each test
  setupFiles: ['<rootDir>/test/setup.js'],

  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  setupFilesAfterEnv: ['<rootDir>/test/setup-after-env.js'],

  // The glob patterns Jest uses to detect test files
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  transformIgnorePatterns: ['/node_modules/(?!(@proof-of-funds))'],

  // Indicates whether each individual test should be reported during the run
  verbose: true,

  // Global setup and teardown for database
  globalSetup: path.join(__dirname, './test/global-setup.js'),
  globalTeardown: path.join(__dirname, './test/global-teardown.js'),

  // Use fake timers for immediate execution control
  fakeTimers: {
    enableGlobally: false,
  },

  // Set timeout to 30 seconds for database operations
  testTimeout: 30000,
  
  // Mock all modules by default
  automock: false
};