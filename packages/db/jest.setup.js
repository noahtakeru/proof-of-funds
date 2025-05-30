/**
 * Jest setup file for database tests
 * 
 * This file runs before each test file
 */

// Load environment variables from root .env file
require('dotenv').config({ path: '../../.env' });

// Always use test environment in tests
process.env.NODE_ENV = 'test';

// Ensure DATABASE_URL is set to test URL for Prisma
if (!process.env.DATABASE_URL_TEST) {
  // This should be caught by the test, but we'll provide a fallback just in case
  console.warn('DATABASE_URL_TEST environment variable is not set, using fallback for tests');
  process.env.DATABASE_URL_TEST = 'postgresql://zkp_test_user:=+^4d;Q+SCa]{-ra@35.193.170.68:5432/zkp_test';
}

// Set DATABASE_URL to test URL for Prisma
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// Additional test configuration
jest.setTimeout(30000); // 30 seconds

// Silence console logs in tests unless in verbose mode
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    // Keep warnings and errors enabled for test debugging
    warn: console.warn,
    error: console.error,
  };
}