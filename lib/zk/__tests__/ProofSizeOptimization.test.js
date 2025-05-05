/**
 * @jest-environment node
 */

import zkProofSerializer from '../src/zkProofSerializer.js';
import * as proofSizeOptimization from '../src/proof.js';

// Mock zkErrorLogger to avoid console output during tests
jest.mock('../src/zkErrorLogger.mjs', () => ({
  default: {
    zkErrorLogger: {
      log: jest.fn(),
      logError: jest.fn()
    }
  }
}));

// Sample proof data for testing
const sampleProof = {
  format: {
    version: "1.0.0",
    type: "zk-proof-of-funds"
  },
  circuit: {
    type: "standard",
    version: "1.0.0"
  },
  proof: {
    data: {
      pi_a: ["123456789012345678901234", "987654321098765432109876", "1"],
      pi_b: [
        ["123456789012345678901234", "987654321098765432109876"],
        ["123456789012345678901234", "987654321098765432109876"],
        ["1", "0"]
      ],
      pi_c: ["123456789012345678901234", "987654321098765432109876", "1"],
      protocol: "groth16"
    },
    publicSignals: ["1", "2", "3", "4", "5"]
  },
  metadata: {
    createdAt: 1681411546789,
    libraryVersion: "1.0.0",
    walletAddress: "0x1234567890123456789012345678901234567890",
    amount: "100.50",
    environment: "node"
  }
};

describe('Proof Size Optimization Module', () => {

  describe('ProofCompressor', () => {
    test('should compress and decompress proof data', () => {
      // Compress the proof
      const compressionResult = proofSizeOptimization.compressProof(sampleProof);

      // Basic validation of compression result
      expect(compressionResult).toBeDefined();
      expect(compressionResult.data).toBeDefined();
      expect(compressionResult.originalSize).toBeGreaterThan(0);
      expect(compressionResult.compressedSize).toBeGreaterThan(0);
      expect(compressionResult.compressionRatio).toBeGreaterThan(1); // Ensure some compression happened

      // Decompress the proof
      const decompressed = proofSizeOptimization.decompressProof(compressionResult.data);

      // Verify that decompression restores the original proof
      expect(decompressed).toEqual(sampleProof);
    });

    test('should create and extract compressed proof data', () => {
      // Create a compressed package
      const compressedData = proofSizeOptimization.createCompressedProofPackage(sampleProof);

      // Validate the compressed data
      expect(compressedData).toBeDefined();
      expect(compressedData).toHaveProperty('version');
      expect(compressedData).toHaveProperty('data');
      expect(compressedData).toHaveProperty('format');
      expect(compressedData).toHaveProperty('checksum');

      // Extract the proof from the compressed data
      const extractedProof = proofSizeOptimization.extractProofFromPackage(compressedData);

      // Compare with original proof
      expect(extractedProof).toEqual(sampleProof);
    });

    test('should analyze proof size and suggest optimizations', () => {
      // Analyze the proof size
      const analysis = proofSizeOptimization.analyzeProofSize(sampleProof);

      // Validate the analysis
      expect(analysis.totalSize).toBeGreaterThan(0);
      expect(analysis.breakdown).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    test('should estimate optimal compression strategy', () => {
      // Estimate optimal compression
      const estimate = proofSizeOptimization.estimateOptimalCompression(sampleProof);

      // Validate the estimate
      expect(estimate.optimalLevel).toBeDefined();
      expect(estimate.estimatedReduction).toBeGreaterThanOrEqual(0);
      expect(estimate.estimatedReduction).toBeLessThanOrEqual(1);
      expect(estimate.compressionOptions).toBeDefined();
    });
  });

  describe('OptimizedSerializer', () => {
    test('should serialize and deserialize with optimization', () => {
      // Serialize with optimization
      const optimized = proofSizeOptimization.serializeOptimized(sampleProof);

      // Basic validation
      expect(optimized).toBeDefined();
      expect(typeof optimized).toBe('string');

      // Check that optimized is smaller than standard JSON
      const standardJson = JSON.stringify(sampleProof);
      expect(optimized.length).toBeLessThan(standardJson.length);

      // Deserialize the optimized data
      const deserialized = proofSizeOptimization.deserializeOptimized(optimized);

      // Verify that deserialization restores the original proof
      expect(deserialized).toEqual(sampleProof);
    });

    test('should estimate size reduction from optimization', () => {
      // Get size reduction estimate
      const reduction = proofSizeOptimization.estimateSizeReduction(sampleProof);

      // Validate the reduction estimate
      expect(reduction.originalSize).toBeGreaterThan(0);
      expect(reduction.optimizedSizes).toBeDefined();
      expect(reduction.reductionPercentages).toBeDefined();
      expect(reduction.recommendations).toBeDefined();
      expect(reduction.recommendations.length).toBeGreaterThan(0);

      // Ensure we have some reduction
      const bestReduction = Math.max(...Object.values(reduction.reductionPercentages));
      expect(bestReduction).toBeGreaterThan(0);
    });

    test('should create minimal verifiable proof', () => {
      // Create minimal verifiable proof
      const minimal = proofSizeOptimization.createMinimalVerifiableProof(sampleProof);

      // Validate the minimal proof
      expect(minimal).toBeDefined();
      expect(minimal.c).toBeDefined(); // circuit
      expect(minimal.p).toBeDefined(); // proof
      expect(minimal.p.d).toBeDefined(); // proof data
      expect(minimal.p.ps).toBeDefined(); // public signals

      // Should be smaller than the original
      expect(JSON.stringify(minimal).length).toBeLessThan(JSON.stringify(sampleProof).length);
    });
  });

  describe('SelectiveDisclosure', () => {
    test('should create partial proof with selected components', () => {
      // Create selective disclosure with only wallet address and amount
      const disclosure = proofSizeOptimization.createSelectiveDisclosure(sampleProof, {
        include: [
          proofSizeOptimization.ProofComponent.WALLET_ADDRESS,
          proofSizeOptimization.ProofComponent.AMOUNT
        ]
      });

      // Validate the disclosure
      expect(disclosure.partialProof).toBeDefined();
      expect(disclosure.partialProof.partialDisclosure).toBe(true);
      expect(disclosure.partialProof.metadata).toBeDefined();
      expect(disclosure.partialProof.metadata.walletAddress).toBe(sampleProof.metadata.walletAddress);
      expect(disclosure.partialProof.metadata.amount).toBe(sampleProof.metadata.amount);

      // Should not include proof data
      expect(disclosure.partialProof.proof).toBeUndefined();

      // Verify disclosure metadata
      expect(disclosure.disclosureMetadata).toBeDefined();
      expect(disclosure.disclosureMetadata.disclosedComponents).toContain(proofSizeOptimization.ProofComponent.WALLET_ADDRESS);
      expect(disclosure.disclosureMetadata.disclosedComponents).toContain(proofSizeOptimization.ProofComponent.AMOUNT);
    });

    test('should extract verifiable info from partial proof', () => {
      // Create selective disclosure with critical components
      const disclosure = proofSizeOptimization.createSelectiveDisclosure(sampleProof, {
        include: [
          proofSizeOptimization.ProofComponent.PROOF_DATA,
          proofSizeOptimization.ProofComponent.PUBLIC_SIGNALS,
          proofSizeOptimization.ProofComponent.WALLET_ADDRESS,
          proofSizeOptimization.ProofComponent.AMOUNT,
          proofSizeOptimization.ProofComponent.PROOF_TYPE
        ],
        includeVerificationHash: true
      });

      // Extract verifiable info
      const info = proofSizeOptimization.extractVerifiableInfo(disclosure.partialProof);

      // Validate the extracted info
      expect(info.walletAddress).toBe(sampleProof.metadata.walletAddress);
      expect(info.amount).toBe(sampleProof.metadata.amount);
      expect(info.proofType).toBe(sampleProof.circuit.type);
      expect(info.canVerifyCryptographically).toBe(true);
    });

    test('should create and verify proof reference', () => {
      // Create a proof reference
      const reference = proofSizeOptimization.createProofReference(sampleProof, "Test reference");

      // Validate the reference
      expect(reference.reference).toBeDefined();
      expect(typeof reference.reference).toBe('string');
      expect(reference.metadata).toBeDefined();
      expect(reference.metadata.proofType).toBe(sampleProof.circuit.type);

      // Verify the reference
      const isValid = proofSizeOptimization.verifyProofReference(reference.reference, sampleProof);
      expect(isValid).toBe(true);

      // Should fail verification with a different proof
      const differentProof = { ...sampleProof, metadata: { ...sampleProof.metadata, amount: "200" } };
      const isInvalid = proofSizeOptimization.verifyProofReference(reference.reference, differentProof);
      expect(isInvalid).toBe(false);
    });

    test('should obscure wallet address when requested', () => {
      // Create selective disclosure with obscured wallet address
      const disclosure = proofSizeOptimization.createSelectiveDisclosure(sampleProof, {
        include: [proofSizeOptimization.ProofComponent.WALLET_ADDRESS],
        obscureWalletAddress: true
      });

      // Validate the obscured address
      expect(disclosure.partialProof.metadata.walletAddress).toBeDefined();
      expect(disclosure.partialProof.metadata.walletAddress).not.toBe(sampleProof.metadata.walletAddress);
      expect(disclosure.partialProof.metadata.walletAddress).toContain('...');
    });
  });

  describe('Integration test', () => {
    test('should work with real proof serialization/deserialization', () => {
      // Only mock if zkProofSerializer is not available in the real codebase
      if (!zkProofSerializer) {
        // Skip this test if we don't have the real implementation
        console.warn('Skipping integration test - zkProofSerializer not available');
        return;
      }

      // Serialize a proof using standard serializer
      const serialized = zkProofSerializer.serializeProof(
        sampleProof.proof.data,
        sampleProof.proof.publicSignals,
        {
          type: sampleProof.circuit.type,
          version: sampleProof.circuit.version,
          walletAddress: sampleProof.metadata.walletAddress,
          amount: sampleProof.metadata.amount
        }
      );

      // Compress the serialized proof
      const compressed = proofSizeOptimization.compressProof(serialized);

      // Decompress the proof
      const decompressed = proofSizeOptimization.decompressProof(compressed.data);

      // Deserialize with standard deserializer
      const deserialized = zkProofSerializer.deserializeProof(decompressed);

      // Verify the core data is preserved
      expect(deserialized.proof.data).toEqual(sampleProof.proof.data);
      expect(deserialized.proof.publicSignals).toEqual(sampleProof.proof.publicSignals);
      expect(deserialized.circuit.type).toBe(sampleProof.circuit.type);
      expect(deserialized.metadata.walletAddress).toBe(sampleProof.metadata.walletAddress);
      expect(deserialized.metadata.amount).toBe(sampleProof.metadata.amount);
    });
  });
});