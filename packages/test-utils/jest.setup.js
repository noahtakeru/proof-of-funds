/**
 * Jest setup file for test-utils package
 */
require('dotenv').config({ path: '../../.env' });

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Define database variables
process.env.DATABASE_URL_TEST = "postgresql://zkp_test_user:=+^4d;Q+SCa]{-ra@35.193.170.68:5432/zkp_test";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// Set JWT secret for tests
process.env.JWT_SECRET = 'test-jwt-secret';

// Increase timeout for tests
jest.setTimeout(30000);

// Minimal setup to allow tests to run
global.beforeAll = jest.fn();
global.afterAll = jest.fn();