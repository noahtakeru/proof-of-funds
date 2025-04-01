/**
 * Jest Configuration
 * 
 * This file configures Jest for testing the ZK proof system.
 */

module.exports = {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: false,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  // A list of paths to directories that Jest should use to search for files in
  roots: [
    "<rootDir>"
  ],

  // Path mappings for module resolution
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@lib/(.*)$": "<rootDir>/lib/$1",
    "^@components/(.*)$": "<rootDir>/components/$1",
    "^@pages/(.*)$": "<rootDir>/pages/$1"
  },

  // A list of paths to modules that run some code to configure or set up the testing environment
  setupFiles: [],

  // The test environment that will be used for testing
  testEnvironment: "node",

  // The glob patterns Jest uses to detect test files
  testMatch: [
    "**/__tests__/**/*.test.js"
  ],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: [
    "/node_modules/"
  ],

  // Indicates whether each individual test should be reported during the run
  verbose: true,

  // Transform files before tests
  transform: {
    "^.+\\.[t|j]sx?$": "babel-jest"
  }
};