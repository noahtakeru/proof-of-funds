/**
 * Integration Service Tests
 * 
 * Tests the integration between all system components to ensure
 * they work together correctly.
 */

import { IntegrationService, ProofGenerationParams } from '../integrationService';
import { PrismaClient, ProofType, ProofStatus } from '@proof-of-funds/db';
import { ChainAdapterRegistry, ChainType } from '@proof-of-funds/frontend/utils/chains';
import auditLogger from '@proof-of-funds/common/src/logging/auditLogger';

// Mock dependencies
jest.mock('@proof-of-funds/frontend/utils/chains', () => ({
  ChainAdapterRegistry: jest.fn().mockImplementation(() => ({
    getAdapter: jest.fn().mockReturnValue({
      getBalance: jest.fn().mockResolvedValue('1000000000000000000'), // 1 ETH
      validateAddress: jest.fn().mockReturnValue(true)
    })
  })),
  ChainType: {
    EVM: 'evm',
    SOLANA: 'solana',
    BITCOIN: 'bitcoin'
  }
}));

jest.mock('@proof-of-funds/frontend/services/TransactionHistoryProcessor', () => ({
  TransactionHistoryProcessor: jest.fn().mockImplementation(() => ({
    getTransactionHistory: jest.fn().mockResolvedValue([])
  }))
}));

jest.mock('@proof-of-funds/frontend/services/BlacklistChecker', () => ({
  BlacklistChecker: jest.fn().mockImplementation(() => ({
    checkAddress: jest.fn().mockResolvedValue(false)
  }))
}));

jest.mock('@proof-of-funds/frontend/services/VerificationResultFormatter', () => ({
  VerificationResultFormatter: jest.fn().mockImplementation(() => ({
    formatResult: jest.fn().mockReturnValue({})
  }))
}));

jest.mock('@proof-of-funds/common/src/logging/auditLogger', () => ({
  info: jest.fn().mockResolvedValue(true),
  error: jest.fn().mockResolvedValue(true),
  warning: jest.fn().mockResolvedValue(true),
  LogCategory: {
    AUTH: 'auth',
    ACCESS: 'access',
    DATA: 'data',
    ADMIN: 'admin',
    ZK_PROOF: 'zk_proof',
    SYSTEM: 'system',
    SECURITY: 'security'
  },
  LogSeverity: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    CRITICAL: 'CRITICAL'
  },
  default: {
    info: jest.fn().mockResolvedValue(true),
    error: jest.fn().mockResolvedValue(true),
    warning: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('@proof-of-funds/db', () => {
  const mockPrismaClient = {
    wallet: {
      create: jest.fn().mockResolvedValue({
        id: 'wallet-123',
        address: '0x1234567890123456789012345678901234567890'
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'wallet-123',
        address: '0x1234567890123456789012345678901234567890'
      })
    },
    proofTemplate: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'template-123',
        name: 'Test Template',
        expiryPeriod: 86400 // 1 day
      })
    },
    proof: {
      create: jest.fn().mockResolvedValue({
        id: 'proof-123',
        referenceId: 'ref-123',
        proofType: 'THRESHOLD',
        status: 'PENDING',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 1 day
        warningFlags: []
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'proof-123',
        referenceId: 'ref-123',
        proofType: 'THRESHOLD',
        status: 'PENDING',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 1 day
        isRevoked: false,
        originalWallets: ['0x1234567890123456789012345678901234567890'],
        encryptedData: JSON.stringify({
          wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1, balance: '1000000000000000000' }],
          totalBalance: '1000000000000000000',
          threshold: '500000000000000000',
          zkProofData: { proof: 'mock-proof', publicSignals: ['1'] }
        }),
        warningFlags: []
      })
    },
    verification: {
      create: jest.fn().mockResolvedValue({
        id: 'verification-123',
        proofId: 'proof-123',
        referenceId: 'ref-123',
        verifierAddress: '0x1234567890123456789012345678901234567890',
        isSuccessful: true,
        verificationResult: {
          isValid: true,
          proofType: 'THRESHOLD',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          currentBalance: '1000000000000000000',
          threshold: '500000000000000000',
          warningFlags: []
        }
      })
    },
    $disconnect: jest.fn().mockResolvedValue(undefined)
  };
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
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
    },
    WalletType: {
      USER_CONNECTED: 'USER_CONNECTED',
      TEMPORARY: 'TEMPORARY'
    }
  };
});

// Mock ZKProofService
jest.mock('../zkProofService', () => ({
  ZKProofService: jest.fn().mockImplementation(() => ({
    generateStandardProof: jest.fn().mockResolvedValue({ proof: 'mock-proof', publicSignals: ['1'] }),
    generateThresholdProof: jest.fn().mockResolvedValue({ proof: 'mock-proof', publicSignals: ['1'] }),
    generateMaximumProof: jest.fn().mockResolvedValue({ proof: 'mock-proof', publicSignals: ['1'] }),
    generateZeroKnowledgeProof: jest.fn().mockResolvedValue({ proof: 'mock-proof', publicSignals: ['1'] }),
    verifyStandardProof: jest.fn().mockResolvedValue(true),
    verifyThresholdProof: jest.fn().mockResolvedValue(true),
    verifyMaximumProof: jest.fn().mockResolvedValue(true),
    verifyZeroKnowledgeProof: jest.fn().mockResolvedValue(true)
  }))
}));

describe('IntegrationService', () => {
  let integrationService: IntegrationService;
  let prisma: PrismaClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    integrationService = new IntegrationService();
    prisma = new PrismaClient();
  });
  
  describe('generateProof', () => {
    it('should generate a threshold proof successfully', async () => {
      const params: ProofGenerationParams = {
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.THRESHOLD,
        threshold: '500000000000000000', // 0.5 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      const result = await integrationService.generateProof(params);
      
      // Verify result structure
      expect(result).toHaveProperty('referenceId');
      expect(result).toHaveProperty('proofId');
      expect(result).toHaveProperty('status', ProofStatus.PENDING);
      expect(result).toHaveProperty('type', ProofType.THRESHOLD);
      expect(result).toHaveProperty('tempWalletAddress');
      
      // Verify database interactions
      expect(prisma.wallet.create).toHaveBeenCalled();
      expect(prisma.proof.create).toHaveBeenCalled();
      
      // Verify audit logging
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.generation.start',
        expect.any(Object),
        expect.any(Object)
      );
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.generation.complete',
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle errors during proof generation', async () => {
      // Mock proof creation to throw an error
      (prisma.proof.create as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      const params: ProofGenerationParams = {
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.THRESHOLD,
        threshold: '500000000000000000', // 0.5 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      await expect(integrationService.generateProof(params)).rejects.toThrow('Database error');
      
      // Verify error logging
      expect(auditLogger.default.error).toHaveBeenCalledWith(
        'proof.verification.error',
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should support different proof types', async () => {
      // Test standard proof
      const standardParams: ProofGenerationParams = {
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.STANDARD,
        exactAmount: '1000000000000000000', // 1 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      const standardResult = await integrationService.generateProof(standardParams);
      expect(standardResult.type).toBe(ProofType.STANDARD);
      
      // Test maximum proof
      const maximumParams: ProofGenerationParams = {
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.MAXIMUM,
        maxAmount: '2000000000000000000', // 2 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      const maximumResult = await integrationService.generateProof(maximumParams);
      expect(maximumResult.type).toBe(ProofType.MAXIMUM);
      
      // Test zero-knowledge proof
      const zkParams: ProofGenerationParams = {
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.ZERO_KNOWLEDGE,
        threshold: '500000000000000000', // 0.5 ETH
        expiryPeriod: 86400 // 1 day
      };
      
      const zkResult = await integrationService.generateProof(zkParams);
      expect(zkResult.type).toBe(ProofType.ZERO_KNOWLEDGE);
    });
  });
  
  describe('verifyProof', () => {
    it('should verify a proof successfully', async () => {
      const result = await integrationService.verifyProof({
        referenceId: 'ref-123',
        verifierAddress: '0x9876543210987654321098765432109876543210'
      });
      
      // Verify result structure
      expect(result).toHaveProperty('isValid', true);
      expect(result).toHaveProperty('proofType', 'THRESHOLD');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('currentBalance');
      expect(result).toHaveProperty('threshold');
      expect(result).toHaveProperty('warningFlags');
      
      // Verify database interactions
      expect(prisma.proof.findUnique).toHaveBeenCalledWith({
        where: { referenceId: 'ref-123' }
      });
      expect(prisma.verification.create).toHaveBeenCalled();
      
      // Verify audit logging
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.verification.start',
        expect.any(Object),
        expect.any(Object)
      );
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.verification.complete',
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle non-existent proofs', async () => {
      // Mock proof lookup to return null
      (prisma.proof.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      await expect(integrationService.verifyProof({
        referenceId: 'non-existent-ref',
        verifierAddress: '0x9876543210987654321098765432109876543210'
      })).rejects.toThrow('Proof not found');
      
      // Verify warning logging
      expect(auditLogger.default.warning).toHaveBeenCalledWith(
        'proof.verification.not_found',
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle expired proofs', async () => {
      // Mock proof to be expired
      (prisma.proof.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'proof-123',
        referenceId: 'ref-123',
        proofType: 'THRESHOLD',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 172800000), // 2 days ago
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago (expired)
        isRevoked: false,
        originalWallets: ['0x1234567890123456789012345678901234567890'],
        encryptedData: JSON.stringify({
          wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1, balance: '1000000000000000000' }],
          totalBalance: '1000000000000000000',
          threshold: '500000000000000000',
          zkProofData: { proof: 'mock-proof', publicSignals: ['1'] }
        }),
        warningFlags: []
      });
      
      const result = await integrationService.verifyProof({
        referenceId: 'ref-123',
        verifierAddress: '0x9876543210987654321098765432109876543210'
      });
      
      // Verify result indicates expired proof
      expect(result.isValid).toBe(false);
      expect(result.warningFlags).toContain('PROOF_EXPIRED');
      
      // Verify logging
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.verification.expired',
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle revoked proofs', async () => {
      // Mock proof to be revoked
      (prisma.proof.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'proof-123',
        referenceId: 'ref-123',
        proofType: 'THRESHOLD',
        status: 'REVOKED',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 1 day (not expired)
        isRevoked: true,
        revokedAt: new Date(Date.now() - 3600000), // 1 hour ago
        originalWallets: ['0x1234567890123456789012345678901234567890'],
        encryptedData: JSON.stringify({
          wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1, balance: '1000000000000000000' }],
          totalBalance: '1000000000000000000',
          threshold: '500000000000000000',
          zkProofData: { proof: 'mock-proof', publicSignals: ['1'] }
        }),
        warningFlags: []
      });
      
      const result = await integrationService.verifyProof({
        referenceId: 'ref-123',
        verifierAddress: '0x9876543210987654321098765432109876543210'
      });
      
      // Verify result indicates revoked proof
      expect(result.isValid).toBe(false);
      expect(result.warningFlags).toContain('PROOF_REVOKED');
      
      // Verify logging
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.verification.revoked',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
  
  describe('getTransactionHistory', () => {
    it('should retrieve transaction history for a wallet', async () => {
      const mockTransactions = [
        { hash: '0x123', blockNumber: 123, from: '0x123', to: '0x456', value: '1000000000000000000' },
        { hash: '0x456', blockNumber: 124, from: '0x456', to: '0x123', value: '2000000000000000000' }
      ];
      
      // Mock transaction history
      const mockTransactionProcessor = {
        getTransactionHistory: jest.fn().mockResolvedValue(mockTransactions)
      };
      (integrationService as any).transactionProcessor = mockTransactionProcessor;
      
      const transactions = await integrationService.getTransactionHistory(
        '0x1234567890123456789012345678901234567890',
        1,
        10
      );
      
      expect(transactions).toEqual(mockTransactions);
      expect(mockTransactionProcessor.getTransactionHistory).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        1,
        10
      );
    });
    
    it('should handle errors when retrieving transaction history', async () => {
      // Mock transaction history to throw error
      const mockTransactionProcessor = {
        getTransactionHistory: jest.fn().mockRejectedValue(new Error('API error'))
      };
      (integrationService as any).transactionProcessor = mockTransactionProcessor;
      
      const transactions = await integrationService.getTransactionHistory(
        '0x1234567890123456789012345678901234567890',
        1,
        10
      );
      
      expect(transactions).toEqual([]);
    });
  });
  
  describe('end-to-end integration', () => {
    it('should support the complete proof lifecycle', async () => {
      // Generate a proof
      const params: ProofGenerationParams = {
        userId: 'user-123',
        wallets: [{ address: '0x1234567890123456789012345678901234567890', chainId: 1 }],
        proofType: ProofType.THRESHOLD,
        threshold: '500000000000000000', // 0.5 ETH
        expiryPeriod: 86400, // 1 day
        message: 'Test proof for integration'
      };
      
      const proofResult = await integrationService.generateProof(params);
      
      // Verify the proof
      const verificationResult = await integrationService.verifyProof({
        referenceId: proofResult.referenceId,
        verifierAddress: '0x9876543210987654321098765432109876543210'
      });
      
      // Check the full lifecycle
      expect(proofResult.referenceId).toBeDefined();
      expect(verificationResult.isValid).toBe(true);
      expect(verificationResult.proofType).toBe(ProofType.THRESHOLD);
      
      // Verify database interactions for full lifecycle
      expect(prisma.wallet.create).toHaveBeenCalled();
      expect(prisma.proof.create).toHaveBeenCalled();
      expect(prisma.proof.findUnique).toHaveBeenCalled();
      expect(prisma.verification.create).toHaveBeenCalled();
      
      // Verify logging for full lifecycle
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.generation.start',
        expect.any(Object),
        expect.any(Object)
      );
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.generation.complete',
        expect.any(Object),
        expect.any(Object)
      );
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.verification.start',
        expect.any(Object),
        expect.any(Object)
      );
      expect(auditLogger.default.info).toHaveBeenCalledWith(
        'proof.verification.complete',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});