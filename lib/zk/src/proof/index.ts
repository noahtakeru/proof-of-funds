/**
 * @fileoverview Proof Size Optimization Module
 * 
 * This module provides utilities for optimizing ZK proof size through
 * compression, optimized serialization, and selective disclosure mechanisms.
 */

// Compression utilities
export {
  CompressionLevel,
  CompressionAlgorithm,
  compressProof,
  decompressProof,
  createCompressedProofPackage,
  extractFromCompressedPackage,
  analyzeProofSize,
  estimateOptimalCompression
} from './ProofCompressor';

export type {
  CompressionOptions,
  CompressionResult,
  CompressedProofMeta
} from './ProofCompressor';

// Optimized serialization
export {
  serializeOptimized,
  deserializeOptimized,
  estimateSizeReduction,
  createMinimalVerifiableProof
} from './OptimizedSerializer';

export type {
  OptimizedSerializationOptions
} from './OptimizedSerializer';

// Selective disclosure
export {
  ProofComponent,
  createSelectiveDisclosure,
  verifyPartialProof,
  extractVerifiableInfo,
  createProofReference,
  verifyProofReference
} from './SelectiveDisclosure';

export type {
  SelectiveDisclosureOptions,
  SelectiveDisclosureResult
} from './SelectiveDisclosure';

/**
 * Size Optimization API for ZK Proofs
 * 
 * This default export provides a unified interface for all proof optimization
 * functions, making it easier to use the module.
 */
export default {
  compression: {
    compress: compressProof,
    decompress: decompressProof,
    createPackage: createCompressedProofPackage,
    extractFromPackage: extractFromCompressedPackage,
    analyze: analyzeProofSize,
    estimateOptimal: estimateOptimalCompression,
    CompressionLevel,
    CompressionAlgorithm
  },
  
  serialization: {
    serialize: serializeOptimized,
    deserialize: deserializeOptimized,
    estimateReduction: estimateSizeReduction,
    createMinimal: createMinimalVerifiableProof
  },
  
  disclosure: {
    create: createSelectiveDisclosure,
    verify: verifyPartialProof,
    extractInfo: extractVerifiableInfo,
    createReference: createProofReference,
    verifyReference: verifyProofReference,
    ProofComponent
  }
};