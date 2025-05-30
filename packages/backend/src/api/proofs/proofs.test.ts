/**
 * Proof API Tests
 */
import { createTestServer, authenticatedRequest, expectSuccess, expectError } from '../../../test/api-test-helpers';
import { createUser, createWallet, createProof } from '@proof-of-funds/db/test/seed-test-data';
import { MockZkProofService } from '../../../test/mock-services';
import { v4 as uuidv4 } from 'uuid';

// Mock ZK proof service
jest.mock('../../services/zkProofService', () => {
  return {
    generateProof: jest.fn().mockImplementation((proofType, input) => {
      const mockService = new MockZkProofService();
      return mockService.generateProof(proofType, input);
    }),
    verifyProof: jest.fn().mockImplementation((proofType, proof, publicSignals) => {
      const mockService = new MockZkProofService();
      return mockService.verifyProof(proofType, proof, publicSignals);
    })
  };
});

// Mock encryption service
jest.mock('../../utils/crypto', () => {
  return {
    encryptData: jest.fn().mockReturnValue('mock-encrypted-data'),
    generateEncryptionKey: jest.fn().mockReturnValue(Buffer.from('mock-encryption-key')),
    decryptData: jest.fn().mockReturnValue({ proof: {}, publicSignals: ['1'] })
  };
});

describe('Proof API', () => {
  let app: any;
  let testUser: any;
  let testWallet: any;
  let tempWallet: any;
  let testProof: any;
  
  beforeAll(async () => {
    app = await createTestServer();
    
    // Create test data
    testUser = await createUser();
    testWallet = await createWallet(testUser.id);
    tempWallet = await createWallet(testUser.id, { type: 'TEMPORARY' });
    testProof = await createProof(testUser.id, tempWallet.id, {
      status: 'CONFIRMED',
      proofType: 'STANDARD'
    });
  });
  
  describe('POST /api/v1/proofs', () => {
    it('should generate a new proof', async () => {
      const response = await authenticatedRequest(app, testUser)
        .post('/api/v1/proofs')
        .send({
          proofType: 'STANDARD',
          input: {
            balance: "1000000000000000000",
            threshold: "1000000000000000000",
            userAddress: testUser.address,
            wallets: [testWallet.address]
          }
        });
      
      expectSuccess(response, 201);
      expect(response.body.referenceId).toBeDefined();
      expect(response.body.proofId).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
      expect(response.body.proofType).toBe('STANDARD');
      expect(response.body.decryptionKey).toBeDefined();
    });
    
    it('should return 400 when proof type is invalid', async () => {
      const response = await authenticatedRequest(app, testUser)
        .post('/api/v1/proofs')
        .send({
          proofType: 'INVALID_TYPE',
          input: {
            balance: "1000000000000000000",
            threshold: "1000000000000000000",
            userAddress: testUser.address
          }
        });
      
      expectError(response, 400, 'INVALID_PROOF_TYPE');
    });
    
    it('should return 400 when input is missing', async () => {
      const response = await authenticatedRequest(app, testUser)
        .post('/api/v1/proofs')
        .send({
          proofType: 'STANDARD'
        });
      
      expectError(response, 400, 'MISSING_PARAMETERS');
    });
    
    it('should return 401 when user is not authenticated', async () => {
      const response = await app.post('/api/v1/proofs')
        .send({
          proofType: 'STANDARD',
          input: {
            balance: "1000000000000000000",
            threshold: "1000000000000000000",
            userAddress: testUser.address
          }
        });
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('GET /api/v1/proofs', () => {
    it('should get proofs for authenticated user', async () => {
      const response = await authenticatedRequest(app, testUser)
        .get('/api/v1/proofs');
      
      expectSuccess(response, 200);
      expect(response.body.proofs).toBeDefined();
      expect(response.body.proofs).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBeDefined();
    });
    
    it('should support pagination parameters', async () => {
      const response = await authenticatedRequest(app, testUser)
        .get('/api/v1/proofs?page=1&limit=5');
      
      expectSuccess(response, 200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
    
    it('should support filtering by status', async () => {
      const response = await authenticatedRequest(app, testUser)
        .get('/api/v1/proofs?status=CONFIRMED');
      
      expectSuccess(response, 200);
      expect(response.body.proofs).toBeInstanceOf(Array);
      
      // All returned proofs should have CONFIRMED status
      response.body.proofs.forEach((proof: any) => {
        expect(proof.status).toBe('CONFIRMED');
      });
    });
    
    it('should support filtering by proof type', async () => {
      const response = await authenticatedRequest(app, testUser)
        .get('/api/v1/proofs?type=STANDARD');
      
      expectSuccess(response, 200);
      expect(response.body.proofs).toBeInstanceOf(Array);
      
      // All returned proofs should have STANDARD type
      response.body.proofs.forEach((proof: any) => {
        expect(proof.proofType).toBe('STANDARD');
      });
    });
  });
  
  describe('GET /api/v1/proofs/:proofId', () => {
    it('should get proof details', async () => {
      const response = await authenticatedRequest(app, testUser)
        .get(`/api/v1/proofs/${testProof.id}`);
      
      expectSuccess(response, 200);
      expect(response.body.id).toBe(testProof.id);
      expect(response.body.referenceId).toBe(testProof.referenceId);
      expect(response.body.proofType).toBe(testProof.proofType);
      expect(response.body.status).toBe(testProof.status);
    });
    
    it('should return 404 when proof does not exist', async () => {
      const response = await authenticatedRequest(app, testUser)
        .get(`/api/v1/proofs/${uuidv4()}`);
      
      expectError(response, 404, 'PROOF_NOT_FOUND');
    });
    
    it('should return 403 when proof belongs to another user', async () => {
      // Create another user
      const anotherUser = await createUser();
      
      const response = await authenticatedRequest(app, anotherUser)
        .get(`/api/v1/proofs/${testProof.id}`);
      
      expectError(response, 403, 'UNAUTHORIZED');
    });
  });
  
  describe('POST /api/v1/proofs/:proofId/revoke', () => {
    it('should revoke a proof', async () => {
      // Create a proof to revoke
      const proofToRevoke = await createProof(testUser.id, tempWallet.id, {
        status: 'CONFIRMED',
        proofType: 'STANDARD'
      });
      
      const response = await authenticatedRequest(app, testUser)
        .post(`/api/v1/proofs/${proofToRevoke.id}/revoke`)
        .send({
          reason: 'Test revocation reason'
        });
      
      expectSuccess(response, 200);
      expect(response.body.success).toBe(true);
      expect(response.body.proof.isRevoked).toBe(true);
      expect(response.body.proof.status).toBe('REVOKED');
      expect(response.body.proof.revokedAt).toBeDefined();
    });
    
    it('should return 404 when proof does not exist', async () => {
      const response = await authenticatedRequest(app, testUser)
        .post(`/api/v1/proofs/${uuidv4()}/revoke`)
        .send({
          reason: 'Test revocation reason'
        });
      
      expectError(response, 404, 'PROOF_NOT_FOUND');
    });
    
    it('should return 403 when proof belongs to another user', async () => {
      // Create another user
      const anotherUser = await createUser();
      
      const response = await authenticatedRequest(app, anotherUser)
        .post(`/api/v1/proofs/${testProof.id}/revoke`)
        .send({
          reason: 'Test revocation reason'
        });
      
      expectError(response, 403, 'UNAUTHORIZED');
    });
    
    it('should return 400 when proof is already revoked', async () => {
      // Create a revoked proof
      const revokedProof = await createProof(testUser.id, tempWallet.id, {
        status: 'REVOKED',
        isRevoked: true,
        revokedAt: new Date(),
        proofType: 'STANDARD'
      });
      
      const response = await authenticatedRequest(app, testUser)
        .post(`/api/v1/proofs/${revokedProof.id}/revoke`)
        .send({
          reason: 'Test revocation reason'
        });
      
      expectError(response, 400, 'ALREADY_REVOKED');
    });
  });
});