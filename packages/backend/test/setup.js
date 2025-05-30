/**
 * Jest Setup File
 * 
 * This file is run before each test file.
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Use test database URL
if (!process.env.DATABASE_URL_TEST) {
  // Use value from .env if present, or fall back to default
  process.env.DATABASE_URL_TEST = 'postgresql://zkp_test_user:=+^4d;Q+SCa]{-ra@35.193.170.68:5432/zkp_test';
}

// Set database URL to test URL
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// Set test JWT secret
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';

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