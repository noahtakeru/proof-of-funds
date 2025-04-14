/**
 * @jest-environment node
 * @jest-global describe
 * @jest-global test
 * @jest-global expect
 * @jest-global beforeEach
 * @jest-global jest
 */

import { ethers } from 'ethers';
import { 
  VerificationPathways,
  VerificationMethod,
  VerificationConfidence
} from '../src/VerificationPathways.js';

// Mock providers and contracts
class MockProvider {
  constructor() {
    this.blockNumber = 1000000;
  }
  
  async getBlockNumber() {
    return this.blockNumber;
  }
  
  async getCode() {
    return '0x0123456789abcdef'; // Non-empty code indicates contract exists
  }
}

// Mock ZKVerifierContract
class MockZKVerifierContract {
  constructor() {
    this.verifyProofLocally = jest.fn().mockResolvedValue({
      isVerified: true,
      verificationMethod: 'local',
      proofId: '0x123456789abcdef'
    });
    
    this.verifyProof = jest.fn().mockResolvedValue({
      isVerified: true,
      transactionHash: '0xabcdef',
      verificationMethod: 'onchain',
      proofId: '0x123456789abcdef'
    });
    
    this.getVerificationKey = jest.fn().mockResolvedValue('0x123456');
    this.isProofVerified = jest.fn().mockResolvedValue(true);
  }
  
  connect(signer) {
    return this;
  }
  
  changeNetwork(provider, chainId) {
    return this;
  }
}

// Mock ProofOfFundsContract
class MockProofOfFundsContract {
  constructor() {
    this.verifyProofLocally = jest.fn().mockResolvedValue({
      isVerified: true,
      verificationMethod: 'local',
      proofId: '0x123456789abcdef'
    });
    
    this.submitProof = jest.fn().mockResolvedValue({
      proofId: '0x123456789abcdef',
      transactionHash: '0xabcdef',
      status: 2, // Verified
      walletAddress: '0x1234567890123456789012345678901234567890',
      proofType: 1
    });
  }
  
  connect(signer) {
    return this;
  }
  
  changeNetwork(provider, chainId) {
    return this;
  }
}

// Sample proof data for testing
const sampleProofData = {
  proof: {
    a: ['123456789', '987654321'],
    b: [['123456789', '987654321'], ['123456789', '987654321']],
    c: ['123456789', '987654321']
  },
  publicSignals: ['123456789', '987654321']
};

// Mock VerificationPathways with injected mocks
class TestableVerificationPathways extends VerificationPathways {
  constructor(provider, signer, chainId, config) {
    super(provider, signer, chainId, config);
    
    // Override contracts with mocks
    this.verifierContract = new MockZKVerifierContract();
    this.proofOfFundsContract = new MockProofOfFundsContract();
  }
  
  // Expose protected methods for testing
  exposedVerifyOnChain(proofData, proofType, walletAddress) {
    return this.verifyOnChain(proofData, proofType, walletAddress);
  }
  
  exposedVerifyLocally(proofData, proofType, walletAddress) {
    return this.verifyLocally(proofData, proofType, walletAddress);
  }
  
  exposedVerifyOffChain(proofData, proofType, walletAddress) {
    return this.verifyOffChain(proofData, proofType, walletAddress);
  }
  
  exposedVerifyThirdParty(proofData, proofType, walletAddress) {
    return this.verifyThirdParty(proofData, proofType, walletAddress);
  }
  
  exposedGenerateProofId(proofData) {
    return this.generateProofId(proofData);
  }
}

describe('VerificationPathways', () => {
  let mockProvider;
  let mockSigner;
  let verificationPathways;
  
  beforeEach(() => {
    mockProvider = new MockProvider();
    mockSigner = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890123');
    
    verificationPathways = new TestableVerificationPathways(
      mockProvider,
      mockSigner,
      1 // Ethereum Mainnet
    );
  });
  
  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      expect(verificationPathways).toBeDefined();
    });
    
    test('should initialize with custom configuration', () => {
      const customConfig = {
        cacheTimeMs: 10000,
        preferredMethod: VerificationMethod.Local,
        fallbackMethods: [VerificationMethod.OnChain],
        minConfidence: VerificationConfidence.Low
      };
      
      const customPathways = new TestableVerificationPathways(
        mockProvider,
        mockSigner,
        1,
        customConfig
      );
      
      expect(customPathways).toBeDefined();
    });
  });
  
  describe('Connection methods', () => {
    test('should connect to a new signer', () => {
      const newSigner = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890456');
      
      const result = verificationPathways.connect(newSigner);
      
      expect(result).toBe(verificationPathways); // Should return this for chaining
    });
    
    test('should change network', () => {
      const newProvider = new MockProvider();
      
      const result = verificationPathways.changeNetwork(newProvider, 5);
      
      expect(result).toBe(verificationPathways); // Should return this for chaining
    });
  });
  
  describe('Individual verification methods', () => {
    test('should verify on-chain with ZKVerifierContract', async () => {
      const result = await verificationPathways.exposedVerifyOnChain(sampleProofData);
      
      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('verificationMethod', 'local');
    });
    
    test('should verify on-chain with ProofOfFundsContract when type and address provided', async () => {
      const result = await verificationPathways.exposedVerifyOnChain(
        sampleProofData,
        1, // ProofType.Standard
        '0x1234567890123456789012345678901234567890'
      );
      
      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('verificationMethod', 'local');
    });
    
    test('should verify locally', async () => {
      const result = await verificationPathways.exposedVerifyLocally(sampleProofData);
      
      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('verificationMethod', 'local');
    });
    
    test('should verify off-chain', async () => {
      const result = await verificationPathways.exposedVerifyOffChain(sampleProofData);
      
      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('verificationMethod', 'offchain');
    });
    
    test('should verify with third-party service', async () => {
      const result = await verificationPathways.exposedVerifyThirdParty(sampleProofData);
      
      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('verificationMethod', 'thirdparty');
    });
  });
  
  describe('verifyWithMethod', () => {
    test('should verify with a specific method', async () => {
      const result = await verificationPathways.verifyWithMethod(
        sampleProofData,
        VerificationMethod.OnChain
      );
      
      expect(result).toHaveProperty('isVerified', true);
    });
    
    test('should use cache for repeated verifications', async () => {
      // First verification
      await verificationPathways.verifyWithMethod(
        sampleProofData,
        VerificationMethod.OnChain
      );
      
      // Mock the on-chain verification to return different result
      verificationPathways.exposedVerifyOnChain = jest.fn().mockResolvedValue({
        isVerified: false,
        error: 'Test error',
        verificationMethod: 'onchain'
      });
      
      // Second verification should use cache
      const result = await verificationPathways.verifyWithMethod(
        sampleProofData,
        VerificationMethod.OnChain
      );
      
      expect(result).toHaveProperty('isVerified', true);
      expect(verificationPathways.exposedVerifyOnChain).not.toHaveBeenCalled();
    });
    
    test('should throw error for unsupported method', async () => {
      await expect(
        verificationPathways.verifyWithMethod(
          sampleProofData,
          'unsupported_method'
        )
      ).rejects.toThrow('Unsupported verification method');
    });
  });
  
  describe('verifyWithAllMethods', () => {
    test('should verify with all configured methods', async () => {
      const result = await verificationPathways.verifyWithAllMethods(sampleProofData);
      
      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('confidence');
      expect(result.results).toHaveProperty(VerificationMethod.OnChain);
      expect(result.results).toHaveProperty(VerificationMethod.Local);
      expect(result.results).toHaveProperty(VerificationMethod.OffChain);
    });
    
    test('should handle method failures gracefully', async () => {
      // Mock one method to fail
      verificationPathways.exposedVerifyOnChain = jest.fn().mockRejectedValue(
        new Error('Test error')
      );
      
      const result = await verificationPathways.verifyWithAllMethods(sampleProofData);
      
      // Should still be verified due to other methods
      expect(result).toHaveProperty('isVerified', true);
      
      // OnChain method should have error
      expect(result.results[VerificationMethod.OnChain]).toHaveProperty('isVerified', false);
      expect(result.results[VerificationMethod.OnChain]).toHaveProperty('error');
    });
    
    test('should calculate correct confidence levels', async () => {
      // Configure to succeed on all methods
      const result = await verificationPathways.verifyWithAllMethods(sampleProofData);
      
      // All methods succeed, so confidence should be High
      expect(result).toHaveProperty('confidence', VerificationConfidence.High);
      
      // Mock all methods to fail except OnChain
      verificationPathways.exposedVerifyLocally = jest.fn().mockResolvedValue({
        isVerified: false,
        error: 'Test error',
        verificationMethod: 'local'
      });
      
      verificationPathways.exposedVerifyOffChain = jest.fn().mockResolvedValue({
        isVerified: false,
        error: 'Test error',
        verificationMethod: 'offchain'
      });
      
      verificationPathways.exposedVerifyThirdParty = jest.fn().mockResolvedValue({
        isVerified: false,
        error: 'Test error',
        verificationMethod: 'thirdparty'
      });
      
      // Clear the cache to force re-verification
      verificationPathways.clearCache();
      
      const resultMedium = await verificationPathways.verifyWithAllMethods(sampleProofData);
      
      // Only OnChain succeeds, so confidence should be Medium
      expect(resultMedium).toHaveProperty('confidence', VerificationConfidence.Medium);
      
      // Mock OnChain to fail and Local to succeed
      verificationPathways.exposedVerifyOnChain = jest.fn().mockResolvedValue({
        isVerified: false,
        error: 'Test error',
        verificationMethod: 'onchain'
      });
      
      verificationPathways.exposedVerifyLocally = jest.fn().mockResolvedValue({
        isVerified: true,
        verificationMethod: 'local'
      });
      
      // Clear the cache again
      verificationPathways.clearCache();
      
      const resultLow = await verificationPathways.verifyWithAllMethods(sampleProofData);
      
      // Only Local succeeds, so confidence should be Low
      expect(resultLow).toHaveProperty('confidence', VerificationConfidence.Low);
      
      // Mock all methods to fail
      verificationPathways.exposedVerifyLocally = jest.fn().mockResolvedValue({
        isVerified: false,
        error: 'Test error',
        verificationMethod: 'local'
      });
      
      // Clear the cache again
      verificationPathways.clearCache();
      
      const resultUnverified = await verificationPathways.verifyWithAllMethods(sampleProofData);
      
      // All methods fail, so confidence should be Unverified
      expect(resultUnverified).toHaveProperty('confidence', VerificationConfidence.Unverified);
      expect(resultUnverified).toHaveProperty('isVerified', false);
    });
  });
  
  describe('verify', () => {
    test('should verify with preferred method, falling back if needed', async () => {
      const result = await verificationPathways.verify(sampleProofData);
      
      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('confidence');
    });
    
    test('should fallback to alternative methods if preferred fails', async () => {
      // Mock preferred method (OnChain) to fail
      verificationPathways.exposedVerifyOnChain = jest.fn().mockRejectedValue(
        new Error('Test error')
      );
      
      const result = await verificationPathways.verify(sampleProofData);
      
      // Should still verify using fallback method
      expect(result).toHaveProperty('isVerified', true);
    });
    
    test('should return failure if all methods fail', async () => {
      // Mock all methods to fail
      verificationPathways.exposedVerifyOnChain = jest.fn().mockRejectedValue(
        new Error('OnChain error')
      );
      
      verificationPathways.exposedVerifyLocally = jest.fn().mockResolvedValue({
        isVerified: false,
        error: 'Local error',
        verificationMethod: 'local'
      });
      
      verificationPathways.exposedVerifyOffChain = jest.fn().mockResolvedValue({
        isVerified: false,
        error: 'OffChain error',
        verificationMethod: 'offchain'
      });
      
      const result = await verificationPathways.verify(sampleProofData);
      
      expect(result).toHaveProperty('isVerified', false);
      expect(result).toHaveProperty('error', 'All verification methods failed');
      expect(result).toHaveProperty('confidence', VerificationConfidence.Unverified);
    });
  });
  
  describe('Cache management', () => {
    test('should clear the cache', () => {
      // First verification to populate cache
      verificationPathways.verifyWithMethod(
        sampleProofData,
        VerificationMethod.OnChain
      );
      
      // Clear the cache
      verificationPathways.clearCache();
      
      // Get cache stats
      const stats = verificationPathways.getCacheStats();
      
      expect(stats.size).toBe(0);
    });
    
    test('should provide cache statistics', async () => {
      // First verification to populate cache
      await verificationPathways.verifyWithMethod(
        sampleProofData,
        VerificationMethod.OnChain
      );
      
      // Get cache stats
      const stats = verificationPathways.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('oldestEntryAge');
      
      expect(stats.size).toBe(1);
      expect(stats.oldestEntryAge).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Proof ID generation', () => {
    test('should generate consistent proof IDs', () => {
      const id1 = verificationPathways.exposedGenerateProofId(sampleProofData);
      const id2 = verificationPathways.exposedGenerateProofId(sampleProofData);
      
      expect(id1).toEqual(id2);
      expect(id1).toMatch(/^0x[0-9a-f]{64}$/i); // Should be a hex-prefixed 32-byte hash
    });
    
    test('should generate different IDs for different proofs', () => {
      const id1 = verificationPathways.exposedGenerateProofId(sampleProofData);
      
      const differentProof = {
        proof: {
          a: ['111111', '222222'],
          b: [['333333', '444444'], ['555555', '666666']],
          c: ['777777', '888888']
        },
        publicSignals: ['999999', '000000']
      };
      
      const id2 = verificationPathways.exposedGenerateProofId(differentProof);
      
      expect(id1).not.toEqual(id2);
    });
  });
});