/**
 * Authentication API Tests
 */
import { createTestServer, authenticatedRequest, publicRequest, expectSuccess, expectError } from '../../../test/api-test-helpers';
import { createUser } from '@proof-of-funds/db/test/seed-test-data';
import { v4 as uuidv4 } from 'uuid';

// Mock crypto service
jest.mock('../../utils/crypto', () => ({
  verifySignature: jest.fn().mockResolvedValue(true)
}));

describe('Authentication API', () => {
  let app: any;
  
  beforeAll(async () => {
    app = await createTestServer();
  });
  
  describe('POST /api/v1/auth/nonce', () => {
    it('should return a nonce when provided with an address', async () => {
      const response = await publicRequest(app)
        .post('/api/v1/auth/nonce')
        .send({ address: '0x1234567890123456789012345678901234567890' });
      
      expectSuccess(response, 200);
      expect(response.body.nonce).toBeDefined();
      expect(response.body.message).toContain(response.body.nonce);
    });
    
    it('should return 400 when address is missing', async () => {
      const response = await publicRequest(app)
        .post('/api/v1/auth/nonce')
        .send({});
      
      expectError(response, 400, 'MISSING_ADDRESS');
    });
  });
  
  describe('POST /api/v1/auth/authenticate', () => {
    it('should authenticate a user with valid signature', async () => {
      // Create a test user
      await createUser({
        address: '0x1234567890123456789012345678901234567890'
      });
      
      const response = await publicRequest(app)
        .post('/api/v1/auth/authenticate')
        .send({
          address: '0x1234567890123456789012345678901234567890',
          signature: '0xsignature',
          nonce: 'test-nonce'
        });
      
      expectSuccess(response, 200);
      expect(response.body.token).toBeDefined();
      expect(response.body.token).toBeValidJWT();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.address).toBe('0x1234567890123456789012345678901234567890');
    });
    
    it('should return 400 when required params are missing', async () => {
      const response = await publicRequest(app)
        .post('/api/v1/auth/authenticate')
        .send({
          address: '0x1234567890123456789012345678901234567890'
        });
      
      expectError(response, 400, 'MISSING_PARAMS');
    });
  });
  
  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh a token with valid refresh token', async () => {
      // Create a test user
      const user = await createUser();
      
      // Get an authenticated request for this user to get a refresh token
      const authResponse = await authenticatedRequest(app, {
        id: user.id,
        address: user.address,
        permissions: user.permissions
      })
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token' // This will be mocked
        });
      
      expectSuccess(authResponse, 200);
      expect(authResponse.body.token).toBeDefined();
      expect(authResponse.body.token).toBeValidJWT();
      expect(authResponse.body.user).toBeDefined();
    });
    
    it('should return 400 when refresh token is missing', async () => {
      const response = await publicRequest(app)
        .post('/api/v1/auth/refresh')
        .send({});
      
      expectError(response, 400, 'MISSING_REFRESH_TOKEN');
    });
  });
});