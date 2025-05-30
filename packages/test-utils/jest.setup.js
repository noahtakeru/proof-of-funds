/**
 * Jest setup file for test-utils package
 */

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Use test database URL
if (!process.env.DATABASE_URL_TEST) {
  // If not set in environment, use default for tests
  process.env.DATABASE_URL_TEST = 'postgresql://zkp_test_user:=+^4d;Q+SCa]{-ra@35.193.170.68:5432/zkp_test';
}

// Set JWT secret for tests
process.env.JWT_SECRET = 'test-jwt-secret';

// Increase timeout for tests involving database operations
jest.setTimeout(30000);

// Global beforeAll hook
beforeAll(async () => {
  console.log('Starting test suite with environment:', process.env.NODE_ENV);
  console.log('Using test database:', process.env.DATABASE_URL_TEST ? 'Configured' : 'Missing');
});

// Global afterAll hook
afterAll(async () => {
  console.log('Completed test suite');
});