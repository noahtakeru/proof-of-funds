/**
 * Global Jest setup file
 * 
 * This script runs once before all tests start.
 * It sets up the test database environment.
 */
const { globalSetup } = require('./db-test-helpers');

module.exports = async () => {
  console.log('🔄 Setting up test database environment...');
  await globalSetup();
  console.log('✅ Test database environment ready');
};