/**
 * Jest Setup File
 * 
 * This file is run before each test file.
 */
require('dotenv').config({ path: '../../.env' });

// Set test environment
process.env.NODE_ENV = 'test';

// Use test database URL
if (!process.env.DATABASE_URL_TEST) {
  // Use value from .env if present, or fall back to default
  // Properly encode special characters in the password
  const testUser = 'zkp_test_user';
  const testPassword = encodeURIComponent('=+^4d;Q+SCa]{-ra');
  const testHost = '35.193.170.68';
  const testPort = '5432';
  const testDb = 'zkp_test';
  process.env.DATABASE_URL_TEST = `postgresql://${testUser}:${testPassword}@${testHost}:${testPort}/${testDb}?sslmode=disable`;
}

// Set database URL to test URL for Prisma
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// Set test JWT secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-unit-tests';

// Set test API port
process.env.PORT = '3001';

// Disable rate limiting for tests
process.env.RATE_LIMIT_WINDOW_MS = '10000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';

// Mock GCP services
jest.mock('@google-cloud/secret-manager', () => {
  return {
    SecretManagerServiceClient: jest.fn().mockImplementation(() => ({
      accessSecretVersion: jest.fn().mockResolvedValue([
        { payload: { data: Buffer.from('test-secret-value') } }
      ]),
      createSecret: jest.fn().mockResolvedValue([{ name: 'projects/test-project/secrets/test-secret' }]),
      addSecretVersion: jest.fn().mockResolvedValue([{}])
    }))
  };
});

jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => ({
      bucket: jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue([{}]),
          download: jest.fn().mockResolvedValue([Buffer.from('test-file-content')]),
          exists: jest.fn().mockResolvedValue([true])
        }),
        upload: jest.fn().mockResolvedValue([{}]),
        getFiles: jest.fn().mockResolvedValue([[]])
      })
    }))
  };
});