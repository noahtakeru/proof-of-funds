/**
 * Jest configuration for frontend tests
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/services'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }],
    '^.+\\.jsx?$': ['babel-jest'],
    '../../common/src/.*\\.js$': ['babel-jest'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  collectCoverageFrom: [
    'services/**/*.{ts,js}',
    '!services/**/*.d.ts',
    '!services/**/*.config.{ts,js}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  verbose: true,
  testTimeout: 10000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@proof-of-funds/common/utils/(.*)$': '<rootDir>/../common/src/utils/$1',
    '^@proof-of-funds/common/(.*)$': '<rootDir>/../common/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@proof-of-funds|ethers)/)'
  ],
};