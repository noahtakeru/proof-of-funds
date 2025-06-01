/**
 * Proof Flow Service Tests
 * 
 * Tests the complete flow for proof generation and verification.
 */

import { ProofFlowService, ProofCreationParams } from '../proofFlowService';
import { IntegrationService } from '../integrationService';
import { ProofType, ProofStatus } from '@proof-of-funds/db';
import * as auditLogger from '@proof-of-funds/common/logging/auditLogger';
import * as performanceBenchmarkModule from '../../utils/performanceBenchmark';
const performanceBenchmark = performanceBenchmarkModule.default;

// Mock dependencies
jest.mock('../integrationService', () => ({
  IntegrationService: jest.fn().mockImplementation(() => ({
    generateProof: jest.fn().mockResolvedValue({
      referenceId: 'ref-123',
      proofId: 'proof-123',
      status: 'PENDING',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      type: 'THRESHOLD',
      wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
      tempWalletAddress: '0x0987654321098765432109876543210987654321'
    }),
    verifyProof: jest.fn().mockResolvedValue({
      isValid: true,
      proofType: 'THRESHOLD',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      currentBalance: '1000000000000000000',
      threshold: '500000000000000000',
      warningFlags: []
    }),
    shutdown: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@proof-of-funds/common/logging/auditLogger', () => ({
  info: jest.fn().mockResolvedValue(true),
  error: jest.fn().mockResolvedValue(true),
  warning: jest.fn().mockResolvedValue(true),
  log: jest.fn().mockResolvedValue(true),
  getContextFromRequest: jest.fn().mockReturnValue({}),
  LogCategory: {
    SECURITY: 'SECURITY',
    AUTHENTICATION: 'AUTHENTICATION',
    PROOF: 'PROOF',
    VERIFICATION: 'VERIFICATION',
    SYSTEM: 'SYSTEM'
  }
}));

jest.mock('../../utils/performanceBenchmark', () => {
  const mockMeasure = jest.fn().mockImplementation(async (name, fn) => fn());
  const mockGetReport = jest.fn().mockReturnValue({
    'proof_generation.threshold': {
      count: 1,
      avgTime: 150.5,
      minTime: 150.5,
      maxTime: 150.5
    },
    'proof_verification': {
      count: 1,
      avgTime: 50.3,
      minTime: 50.3,
      maxTime: 50.3
    }
  });
  
  return {
    measure: mockMeasure,
    getReport: mockGetReport,
    __esModule: true,
    default: {
      measure: mockMeasure,
      getReport: mockGetReport
    }
  };
});

jest.mock('@proof-of-funds/db', () => ({
  ProofType: {
    STANDARD: 'STANDARD',
    THRESHOLD: 'THRESHOLD',
    MAXIMUM: 'MAXIMUM',
    ZERO_KNOWLEDGE: 'ZERO_KNOWLEDGE'
  },
  ProofStatus: {
    PENDING: 'PENDING',
    SUBMITTED: 'SUBMITTED',
    CONFIRMED: 'CONFIRMED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    REVOKED: 'REVOKED'
  }
}));

describe('ProofFlowService', () => {
  let proofFlowService: ProofFlowService;
  let mockIntegrationService: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    proofFlowService = new ProofFlowService();
    mockIntegrationService = (IntegrationService as jest.Mock).mock.results[0].value;
  });
  
  describe('createProof', () => {
    it('should create a threshold proof successfully', async () => {
      const params: ProofCreationParams = {
        userId: 'user-123',
        walletAddresses: ['0x1234567890123456789012345678901234567890'],
        chainIds: [1],
        proofType: ProofType.THRESHOLD,
        amount: '500000000000000000', // 0.5 ETH
        expiryPeriod: 86400, // 1 day
        message: 'Test proof'
      };
      
      const referenceId = await proofFlowService.createProof(params);
      
      // Verify result
      expect(referenceId).toBe('ref-123');
      
      // Verify integration service was called with correct parameters
      expect(mockIntegrationService.generateProof).toHaveBeenCalledWith({
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.THRESHOLD,
        threshold: '500000000000000000',
        expiryPeriod: 86400,
        message: 'Test proof'
      });
      
      // Verify performance measurement
      expect(performanceBenchmark.measure).toHaveBeenCalledWith(
        'proof_generation.threshold',
        expect.any(Function),
        expect.any(Object)
      );
      
      // Verify audit logging
      expect(auditLogger.info).toHaveBeenCalledWith(
        'proof.flow.start',
        expect.any(Object),
        expect.any(Object)
      );
      expect(auditLogger.info).toHaveBeenCalledWith(
        'proof.flow.complete',
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle standard proof type correctly', async () => {
      const params: ProofCreationParams = {
        userId: 'user-123',
        walletAddresses: ['0x1234567890123456789012345678901234567890'],
        chainIds: [1],
        proofType: ProofType.STANDARD,
        amount: '1000000000000000000', // 1 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      await proofFlowService.createProof(params);
      
      // Verify integration service was called with correct parameters
      expect(mockIntegrationService.generateProof).toHaveBeenCalledWith({
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.STANDARD,
        exactAmount: '1000000000000000000',
        expiryPeriod: 86400
      });
    });
    
    it('should handle maximum proof type correctly', async () => {
      const params: ProofCreationParams = {
        userId: 'user-123',
        walletAddresses: ['0x1234567890123456789012345678901234567890'],
        chainIds: [1],
        proofType: ProofType.MAXIMUM,
        amount: '2000000000000000000', // 2 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      await proofFlowService.createProof(params);
      
      // Verify integration service was called with correct parameters
      expect(mockIntegrationService.generateProof).toHaveBeenCalledWith({
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.MAXIMUM,
        maxAmount: '2000000000000000000',
        expiryPeriod: 86400
      });
    });
    
    it('should handle multiple wallets across chains', async () => {
      const params: ProofCreationParams = {
        userId: 'user-123',
        walletAddresses: [
          '0x1234567890123456789012345678901234567890', 
          '0x2345678901234567890123456789012345678901'
        ],
        chainIds: [1, 137], // Ethereum and Polygon
        proofType: ProofType.THRESHOLD,
        amount: '1000000000000000000', // 1 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      await proofFlowService.createProof(params);
      
      // Verify integration service was called with correct parameters
      expect(mockIntegrationService.generateProof).toHaveBeenCalledWith({
        userId: 'user-123',
        wallets: [
          { address: '0x1234567890123456789012345678901234567890', chainId: 1 },
          { address: '0x2345678901234567890123456789012345678901', chainId: 137 }
        ],
        proofType: ProofType.THRESHOLD,
        threshold: '1000000000000000000',
        expiryPeriod: 86400
      });
    });
    
    it('should handle errors during proof creation', async () => {
      // Mock generateProof to throw an error
      mockIntegrationService.generateProof.mockRejectedValueOnce(new Error('Proof generation failed'));
      
      const params: ProofCreationParams = {
        userId: 'user-123',
        walletAddresses: ['0x1234567890123456789012345678901234567890'],
        chainIds: [1],
        proofType: ProofType.THRESHOLD,
        amount: '500000000000000000', // 0.5 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      await expect(proofFlowService.createProof(params)).rejects.toThrow('Proof generation failed');
      
      // Verify error logging
      expect(auditLogger.error).toHaveBeenCalledWith(
        'proof.flow.error',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
  
  describe('verifyProof', () => {
    it('should verify a proof successfully', async () => {
      const result = await proofFlowService.verifyProof(
        'ref-123', 
        '0x9876543210987654321098765432109876543210'
      );
      
      // Verify result
      expect(result).toBe(true);
      
      // Verify integration service was called correctly
      expect(mockIntegrationService.verifyProof).toHaveBeenCalledWith({
        referenceId: 'ref-123',
        verifierAddress: '0x9876543210987654321098765432109876543210'
      });
      
      // Verify performance measurement
      expect(performanceBenchmark.measure).toHaveBeenCalledWith(
        'proof_verification',
        expect.any(Function),
        expect.any(Object)
      );
      
      // Verify audit logging
      expect(auditLogger.info).toHaveBeenCalledWith(
        'proof.verification.flow.start',
        expect.any(Object),
        expect.any(Object)
      );
      expect(auditLogger.info).toHaveBeenCalledWith(
        'proof.verification.flow.complete',
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle verification failures gracefully', async () => {
      // Mock verifyProof to return invalid result
      mockIntegrationService.verifyProof.mockResolvedValueOnce({
        isValid: false,
        proofType: 'THRESHOLD',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        warningFlags: ['PROOF_INVALID']
      });
      
      const result = await proofFlowService.verifyProof('ref-123');
      
      // Verify result
      expect(result).toBe(false);
    });
    
    it('should handle errors during verification', async () => {
      // Mock verifyProof to throw an error
      mockIntegrationService.verifyProof.mockRejectedValueOnce(new Error('Verification failed'));
      
      const result = await proofFlowService.verifyProof('ref-123');
      
      // Should return false on error
      expect(result).toBe(false);
      
      // Verify error logging
      expect(auditLogger.error).toHaveBeenCalledWith(
        'proof.verification.flow.error',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
  
  describe('createBatchedProofs', () => {
    it('should create multiple proofs in a batch', async () => {
      const batchResult = await proofFlowService.createBatchedProofs(
        'user-123',
        [
          {
            walletAddresses: ['0x1234567890123456789012345678901234567890'],
            chainIds: [1],
            proofType: ProofType.THRESHOLD,
            amount: '500000000000000000', // 0.5 ETH
            expiryPeriod: 86400 // 1 day
          },
          {
            walletAddresses: ['0x2345678901234567890123456789012345678901'],
            chainIds: [137],
            proofType: ProofType.MAXIMUM,
            amount: '2000000000000000000', // 2 ETH
            expiryPeriod: 86400 // 1 day
          }
        ]
      );
      
      // Verify result structure
      expect(batchResult).toHaveProperty('referenceIds');
      expect(batchResult).toHaveProperty('batchId');
      expect(batchResult).toHaveProperty('status', ProofStatus.PENDING);
      expect(batchResult.referenceIds).toHaveLength(2);
      
      // Verify createProof was called twice
      expect(mockIntegrationService.generateProof).toHaveBeenCalledTimes(2);
      
      // Verify audit logging
      expect(auditLogger.info).toHaveBeenCalledWith(
        'proof.batch.start',
        expect.any(Object),
        expect.any(Object)
      );
      expect(auditLogger.info).toHaveBeenCalledWith(
        'proof.batch.complete',
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle errors during batch creation', async () => {
      // Mock generateProof to throw an error on the second call
      mockIntegrationService.generateProof
        .mockResolvedValueOnce({
          referenceId: 'ref-123',
          proofId: 'proof-123',
          status: 'PENDING',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          type: 'THRESHOLD',
          wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
          tempWalletAddress: '0x0987654321098765432109876543210987654321'
        })
        .mockRejectedValueOnce(new Error('Batch processing failed'));
      
      await expect(proofFlowService.createBatchedProofs(
        'user-123',
        [
          {
            walletAddresses: ['0x1234567890123456789012345678901234567890'],
            chainIds: [1],
            proofType: ProofType.THRESHOLD,
            amount: '500000000000000000', // 0.5 ETH
            expiryPeriod: 86400 // 1 day
          },
          {
            walletAddresses: ['0x2345678901234567890123456789012345678901'],
            chainIds: [137],
            proofType: ProofType.MAXIMUM,
            amount: '2000000000000000000', // 2 ETH
            expiryPeriod: 86400 // 1 day
          }
        ]
      )).rejects.toThrow('Batch processing failed');
      
      // Verify error logging
      expect(auditLogger.error).toHaveBeenCalledWith(
        'proof.batch.error',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
  
  describe('getPerformanceMetrics', () => {
    it('should return performance metrics from the benchmark utility', () => {
      const metrics = proofFlowService.getPerformanceMetrics();
      
      // Verify metrics structure is an object with specific properties
      expect(typeof metrics).toBe('object');
      expect(Object.keys(metrics)).toContain('proof_generation.threshold');
      expect(Object.keys(metrics)).toContain('proof_verification');
      expect(metrics['proof_generation.threshold']).toHaveProperty('avgTime');
      expect(metrics['proof_verification']).toHaveProperty('avgTime');
    });
  });
  
  describe('shutdown', () => {
    it('should shut down all resources properly', async () => {
      await proofFlowService.shutdown();
      
      // Verify integration service shutdown was called
      expect(mockIntegrationService.shutdown).toHaveBeenCalled();
    });
  });
});