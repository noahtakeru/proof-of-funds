/**
 * Jest configuration for database package
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
};