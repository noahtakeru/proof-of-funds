/**
 * Jest configuration for ceremony tests
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|ts)$': 'babel-jest',
  },
  setupFilesAfterEnv: ['./setup.cjs'],
  testMatch: ['**/ceremony/*.test.cjs', '**/ceremony/*.test.js'],
  moduleFileExtensions: ['js', 'mjs', 'json', 'node'],
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js'
  },
  testTimeout: 30000,
  moduleDirectories: ['node_modules'],
};