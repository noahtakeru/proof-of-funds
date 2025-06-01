module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test/security/**/*.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};