/**
 * Database Test Helpers
 * 
 * This module provides utilities for setting up and tearing down
 * database tests.
 */
const { prisma } = require('../src/connection');
const { cleanupTestData } = require('./seed-test-data');

/**
 * Setup the test database
 * @returns {Promise<void>}
 */
async function setupTestDatabase() {
  // Verify connection to test database
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Connected to test database');
    
    // Clean existing data
    await cleanupTestData();
  } catch (error) {
    console.error('Test database setup failed:', error);
    throw error;
  }
}

/**
 * Disconnect from the test database
 * @returns {Promise<void>}
 */
async function disconnectTestDatabase() {
  try {
    await prisma.$disconnect();
    console.log('Disconnected from test database');
  } catch (error) {
    console.error('Error disconnecting from test database:', error);
  }
}

/**
 * Run a test with database setup and cleanup
 * @param {Function} testFn Test function
 * @returns {Function} Function that runs the test with proper setup/teardown
 */
function withTestDatabase(testFn) {
  return async () => {
    try {
      await setupTestDatabase();
      await testFn();
    } finally {
      await cleanupTestData();
      await disconnectTestDatabase();
    }
  };
}

/**
 * Global setup for Jest
 * @returns {Promise<void>}
 */
async function globalSetup() {
  // This function is used in jest.config.js globalSetup
  try {
    // Make sure we're using the test database
    if (process.env.NODE_ENV !== 'test') {
      process.env.NODE_ENV = 'test';
    }
    
    if (!process.env.DATABASE_URL_TEST) {
      throw new Error('DATABASE_URL_TEST environment variable is not set');
    }
    
    await setupTestDatabase();
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  }
}

/**
 * Global teardown for Jest
 * @returns {Promise<void>}
 */
async function globalTeardown() {
  // This function is used in jest.config.js globalTeardown
  try {
    await disconnectTestDatabase();
  } catch (error) {
    console.error('Global teardown failed:', error);
    throw error;
  }
}

/**
 * Create a test transaction
 * @param {Function} fn Function to execute in transaction
 * @returns {Promise<any>} Result of the transaction
 */
async function withTestTransaction(fn) {
  return prisma.$transaction(async (tx) => {
    try {
      return await fn(tx);
    } catch (error) {
      // Log the error but don't re-throw - transaction will be rolled back
      console.error('Test transaction error:', error);
      throw error;
    }
  });
}

module.exports = {
  setupTestDatabase,
  disconnectTestDatabase,
  withTestDatabase,
  withTestTransaction,
  globalSetup,
  globalTeardown
};