module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest"
  },
  setupFilesAfterEnv: ["./setup.cjs"],
  testMatch: ["**/ceremony/*.test.cjs"],
  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
  transformIgnorePatterns: [],
  moduleDirectories: ["node_modules"],
  // Remove extensionsToTreatAsEsm since it's causing issues
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
};