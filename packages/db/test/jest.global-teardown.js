/**
 * Global Jest teardown file
 * 
 * This script runs once after all tests complete.
 * It cleans up the test database environment.
 */
const { globalTeardown } = require('./db-test-helpers');

module.exports = async () => {
  console.log('🔄 Cleaning up test database environment...');
  await globalTeardown();
  console.log('✅ Test database environment cleanup complete');
};