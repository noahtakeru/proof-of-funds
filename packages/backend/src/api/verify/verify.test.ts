/**
 * Verification API Tests
 */
import { createTestServer, publicRequest, expectSuccess, expectError } from '../../test/api-test-helpers';
import { createUser, createWallet, createProof } from '@proof-of-funds/db/test/seed-test-data';
import { MockZkProofService } from '../../test/mock-services';
import { v4 as uuidv4 } from 'uuid';

// Mock ZK proof service
jest.mock('../../services/zkProofService', () => {
  return {
    verifyProof: jest.fn().mockImplementation((proofType, proof, publicSignals) => {
      const mockService = new MockZkProofService();
      return mockService.verifyProof(proofType, proof, publicSignals);
    })
  };
});

// Mock encryption service
jest.mock('../../utils/crypto', () => {
  return {
    decryptData: jest.fn().mockReturnValue({
      proof: {},
      publicSignals: ['1'],
      input: {
        balance: "1000000000000000000",
        threshold: "1000000000000000000",
        userAddress: "0x1234567890123456789012345678901234567890"
      }
    })
  };
});

describe('Verification API', () => {
  let app: any;
  let testUser: any;
  let testWallet: any;
  let tempWallet: any;
  let testProof: any;
  let expiredProof: any;
  let revokedProof: any;
  let pendingProof: any;
  
  beforeAll(async () => {
    app = await createTestServer();
    
    // Create test data
    testUser = await createUser();
    testWallet = await createWallet(testUser.id);
    tempWallet = await createWallet(testUser.id, { type: 'TEMPORARY' });
    
    // Create confirmed proof
    testProof = await createProof(testUser.id, tempWallet.id, {
      status: 'CONFIRMED',
      proofType: 'STANDARD',
      encryptedData: 'mock-encrypted-data',
      encryptionKeyId: 'mock-key-id'
    });
    
    // Create expired proof
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    expiredProof = await createProof(testUser.id, tempWallet.id, {
      status: 'EXPIRED',
      proofType: 'STANDARD',
      expiresAt: pastDate
    });
    
    // Create revoked proof
    revokedProof = await createProof(testUser.id, tempWallet.id, {
      status: 'REVOKED',
      proofType: 'STANDARD',
      isRevoked: true,
      revokedAt: new Date()
    });
    
    // Create pending proof
    pendingProof = await createProof(testUser.id, tempWallet.id, {
      status: 'PENDING',
      proofType: 'STANDARD'
    });
  });
  
  describe('GET /api/v1/verify/:referenceId', () => {
    it('should check proof status', async () => {
      const response = await publicRequest(app)
        .get(`/api/v1/verify/${testProof.referenceId}`);
      
      expectSuccess(response, 200);
      expect(response.body.exists).toBe(true);
      expect(response.body.proofType).toBe('STANDARD');
      expect(response.body.status).toBe('CONFIRMED');
      expect(response.body.isRevoked).toBe(false);
    });
    
    it('should return isExpired=true for expired proofs', async () => {
      const response = await publicRequest(app)
        .get(`/api/v1/verify/${expiredProof.referenceId}`);
      
      expectSuccess(response, 200);
      expect(response.body.exists).toBe(true);
      expect(response.body.isExpired).toBe(true);
    });
    
    it('should return isRevoked=true for revoked proofs', async () => {
      const response = await publicRequest(app)
        .get(`/api/v1/verify/${revokedProof.referenceId}`);
      
      expectSuccess(response, 200);
      expect(response.body.exists).toBe(true);
      expect(response.body.isRevoked).toBe(true);
    });
    
    it('should return 404 when proof does not exist', async () => {
      const response = await publicRequest(app)
        .get(`/api/v1/verify/non-existent-reference-id`);
      
      expectError(response, 404, 'PROOF_NOT_FOUND');
    });
  });
  
  describe('POST /api/v1/verify/:referenceId', () => {
    it('should verify a proof with valid decryption key', async () => {
      const response = await publicRequest(app)
        .post(`/api/v1/verify/${testProof.referenceId}`)
        .send({
          decryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        });
      
      expectSuccess(response, 200);
      expect(response.body.isValid).toBe(true);
      expect(response.body.proofType).toBe('STANDARD');
      expect(response.body.input).toBeDefined();
      expect(response.body.verificationId).toBeDefined();
    });
    
    it('should return 400 when decryption key is missing', async () => {
      const response = await publicRequest(app)
        .post(`/api/v1/verify/${testProof.referenceId}`)
        .send({});
      
      expectError(response, 400, 'MISSING_DECRYPTION_KEY');
    });
    
    it('should return 404 when proof does not exist', async () => {
      const response = await publicRequest(app)
        .post(`/api/v1/verify/non-existent-reference-id`)
        .send({
          decryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        });
      
      expectError(response, 404, 'PROOF_NOT_FOUND');
    });
    
    it('should return 400 when proof is revoked', async () => {
      const response = await publicRequest(app)
        .post(`/api/v1/verify/${revokedProof.referenceId}`)
        .send({
          decryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        });
      
      expectError(response, 400, 'PROOF_REVOKED');
    });
    
    it('should return 400 when proof is expired', async () => {
      const response = await publicRequest(app)
        .post(`/api/v1/verify/${expiredProof.referenceId}`)
        .send({
          decryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        });
      
      expectError(response, 400, 'PROOF_EXPIRED');
    });
    
    it('should return 400 when proof is not in CONFIRMED state', async () => {
      const response = await publicRequest(app)
        .post(`/api/v1/verify/${pendingProof.referenceId}`)
        .send({
          decryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        });
      
      expectError(response, 400, 'PROOF_NOT_CONFIRMED');
    });
    
    it('should optionally accept verifier address', async () => {
      const response = await publicRequest(app)
        .post(`/api/v1/verify/${testProof.referenceId}`)
        .send({
          decryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          verifierAddress: '0x1234567890123456789012345678901234567890'
        });
      
      expectSuccess(response, 200);
      expect(response.body.isValid).toBe(true);
    });
  });
});