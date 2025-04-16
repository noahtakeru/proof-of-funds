/**
 * ProofCompressor.ts - Advanced proof compression utilities
 * 
 * This module provides functions to compress zero-knowledge proofs
 * for optimal size and transmission efficiency.
 * 
 * @module ProofCompressor
 */

import { InputError, ProofError, ProofSerializationError } from '../zkErrorHandler.mjs';
import zkErrorLoggerModule from '../zkErrorLogger.mjs';
import * as zkProofSerializer from '../zkProofSerializer.mjs';
import { compress as pako_compress, decompress as pako_decompress } from 'pako';

// Get error logger
const { zkErrorLogger } = zkErrorLoggerModule;

/**
 * Interface defining the structure of a proof container
 */
export interface ProofContainer {
  format?: {
    version?: string;
    type?: string;
  };
  circuit?: {
    type?: string;
    version?: string;
  };
  proof?: {
    data?: any;
    publicSignals?: any;
  };
  metadata?: {
    createdAt?: number;
    walletAddress?: string;
    amount?: number | string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Compression levels for proofs
 * - NONE: No compression (useful for testing or very small proofs)
 * - FAST: Quick compression with good ratios (~50-60% reduction)
 * - BALANCED: Good balance between speed and compression (~70-80% reduction)
 * - MAX: Maximum compression (~80-90% reduction) but slower
 */
export enum CompressionLevel {
  NONE = 0,
  FAST = 1,
  BALANCED = 6,
  MAX = 9
}

/**
 * Compression algorithm to use
 */
export enum CompressionAlgorithm {
  DEFLATE = 'deflate',
  GZIP = 'gzip',
  BROTLI = 'brotli'
}

/**
 * Options for proof compression
 */
export interface CompressionOptions {
  /** Compression level (0-9) */
  level?: CompressionLevel;
  /** Algorithm to use for compression */
  algorithm?: CompressionAlgorithm;
  /** Whether to remove unnecessary metadata */
  stripMetadata?: boolean;
  /** Fields to keep when stripping metadata */
  keepFields?: string[];
  /** Whether to use binary format instead of Base64 */
  useBinary?: boolean;
  /** Custom memory limit in bytes (default: 100MB) */
  memoryLimit?: number;
}

/**
 * Default compression options
 */
const DEFAULT_COMPRESSION_OPTIONS: Required<CompressionOptions> = {
  level: CompressionLevel.BALANCED,
  algorithm: CompressionAlgorithm.DEFLATE,
  stripMetadata: false,
  keepFields: [],
  useBinary: false,
  memoryLimit: 100 * 1024 * 1024 // 100MB
};

/**
 * Result of proof compression
 */
export interface CompressionResult {
  /** Compressed proof data (string or Uint8Array) */
  data: string | Uint8Array;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio (original/compressed) */
  compressionRatio: number;
  /** Time taken to compress in ms */
  compressionTime: number;
  /** Algorithm used for compression */
  algorithm: CompressionAlgorithm;
  /** Level used for compression */
  level: CompressionLevel;
  /** Whether metadata was stripped */
  metadataStripped: boolean;
  /** Format of the compressed data (base64, binary) */
  format: 'base64' | 'binary';
}

/**
 * Metadata about a compressed proof
 */
export interface CompressedProofMeta {
  /** Algorithm used for compression */
  algorithm: CompressionAlgorithm;
  /** Level used for compression */
  level: CompressionLevel;
  /** Whether metadata was stripped */
  metadataStripped: boolean;
  /** Original proof format version */
  originalVersion: string;
  /** Timestamp when compression was performed */
  compressedAt: number;
  /** Original size in bytes */
  originalSize: number;
}

/**
 * Compress a proof for efficient storage and transmission
 * 
 * @param proof - The proof container or serialized proof
 * @param options - Compression options
 * @returns Compression result with compressed data
 * 
 * This function compresses a ZK proof to minimize its size using advanced compression 
 * techniques. It can also strip unnecessary metadata for further size reduction.
 */
export function compressProof(
  proof: object | string,
  options: CompressionOptions = {}
): CompressionResult {
  const startTime = Date.now();
  const opts = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };

  try {
    // Parse the proof if it's a string
    let proofContainer = proof;
    if (typeof proof === 'string') {
      try {
        proofContainer = zkProofSerializer.deserializeProof(proof);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new InputError(`Invalid proof data: ${errorMessage}`, {
          code: 7001,
          recoverable: false,
          details: { originalError: errorMessage }
        });
      }
    }
    
    // Define interface for the proof container
    interface ProofContainer {
      format?: any;
      circuit?: any;
      proof?: {
        data?: any;
        publicSignals?: any;
      };
      metadata?: any;
    }
    
    // Type assertion for the proof container
    const typedProof = proofContainer as ProofContainer;

    // Validate memory limit before proceeding
    const proofJson = JSON.stringify(proofContainer);
    const proofSize = getByteSize(proofJson);
    const memoryLimit = opts.memoryLimit ?? DEFAULT_COMPRESSION_OPTIONS.memoryLimit;
    if (proofSize > memoryLimit) {
      throw new InputError(`Proof size exceeds memory limit: ${proofSize} bytes > ${memoryLimit} bytes`, {
        code: 7011,
        recoverable: false,
        details: {
          proofSize,
          memoryLimit
        }
      });
    }

    // Apply metadata stripping if requested
    let optimizedProof = proofContainer;
    if (opts.stripMetadata) {
      optimizedProof = stripUnnecessaryMetadata(proofContainer, opts.keepFields);
    }

    // Save the original version for reconstruction
    const originalVersion = getProofVersion(proofContainer);
    const originalSize = proofJson.length;

    // Serialize and compress
    const serialized = JSON.stringify(optimizedProof);
    const compressed = compressData(serialized, opts.algorithm, opts.level);

    // Format the compressed data
    let finalData: string | Uint8Array;
    let format: 'base64' | 'binary';

    if (opts.useBinary) {
      finalData = compressed;
      format = 'binary';
    } else {
      finalData = arrayBufferToBase64(compressed);
      format = 'base64';
    }

    // Calculate compression metrics
    const compressedSize = typeof finalData === 'string'
      ? getByteSize(finalData)
      : finalData.byteLength;

    const compressionRatio = originalSize / compressedSize;
    const compressionTime = Date.now() - startTime;

    // Create compression result
    return {
      data: finalData,
      originalSize,
      compressedSize,
      compressionRatio,
      compressionTime,
      algorithm: opts.algorithm,
      level: opts.level,
      metadataStripped: opts.stripMetadata,
      format
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'compressProof',
      context: {
        proofType: typeof proof,
        options: opts
      }
    });

    if (error instanceof InputError || error instanceof ProofError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofSerializationError(`Failed to compress proof: ${errorMsg}`, {
      code: 2007, // PROOF_COMPRESSION_ERROR
      recoverable: false,
      details: { originalError: errorMsg }
    });
  }
}

/**
 * Decompress a previously compressed proof
 * 
 * @param compressed - The compressed proof data
 * @param compressionMetadata - Optional metadata about compression
 * @returns Decompressed proof container
 * 
 * This function reverses the compression process to restore a proof to its
 * original format. If compression metadata is provided, it will be used to
 * guide the decompression process.
 */
export function decompressProof(
  compressed: string | Uint8Array,
  compressionMetadata?: Partial<CompressedProofMeta>
): object {
  try {
    // Determine compressed data format
    let compressedData: Uint8Array;
    if (typeof compressed === 'string') {
      compressedData = base64ToArrayBuffer(compressed);
    } else {
      compressedData = compressed;
    }

    // Default compression algorithm if not provided
    const algorithm = compressionMetadata?.algorithm || CompressionAlgorithm.DEFLATE;

    // Decompress the data
    const decompressed = decompressData(compressedData, algorithm);
    const decompressedJson = new TextDecoder().decode(decompressed);

    try {
      return JSON.parse(decompressedJson);
    } catch (parseError) {
      const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      throw new ProofSerializationError('Failed to parse decompressed proof', {
        code: 2008, // PROOF_DECOMPRESSION_ERROR
        recoverable: false,
        details: { originalError: parseErrorMessage }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'decompressProof',
      context: {
        compressedType: typeof compressed,
        compressedSize: typeof compressed === 'string'
          ? compressed.length
          : compressed.byteLength,
        metadata: compressionMetadata
      }
    });

    if (error instanceof ProofError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofSerializationError(`Failed to decompress proof: ${errorMsg}`, {
      code: 2008, // PROOF_DECOMPRESSION_ERROR
      recoverable: false,
      details: { originalError: errorMsg }
    });
  }
}

/**
 * Creates a compressed proof with embedded metadata for easier decompression
 * 
 * @param proof - The proof container or serialized proof
 * @param options - Compression options
 * @returns Base64 string containing compressed proof with metadata
 * 
 * This function creates a self-contained compressed proof that includes
 * metadata about how it was compressed, allowing for easier decompression
 * without requiring additional parameters.
 */
export function createCompressedProofPackage(
  proof: object | string,
  options: CompressionOptions = {}
): string {
  try {
    // Compress the proof
    const compressionResult = compressProof(proof, options);

    // Parse the original proof if needed
    const proofContainer = typeof proof === 'string'
      ? zkProofSerializer.deserializeProof(proof)
      : proof;

    // Create metadata for the compressed package
    const compressionMeta: CompressedProofMeta = {
      algorithm: compressionResult.algorithm,
      level: compressionResult.level,
      metadataStripped: compressionResult.metadataStripped,
      originalVersion: getProofVersion(proofContainer),
      compressedAt: Date.now(),
      originalSize: compressionResult.originalSize
    };

    // Create the package
    const compressedPackage = {
      type: 'compressed-zk-proof',
      version: '1.0.0',
      metadata: compressionMeta,
      data: typeof compressionResult.data === 'string'
        ? compressionResult.data
        : arrayBufferToBase64(compressionResult.data)
    };

    // Serialize and return
    return JSON.stringify(compressedPackage);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'createCompressedProofPackage',
      context: {
        proofType: typeof proof,
        options
      }
    });

    if (error instanceof ProofError || error instanceof InputError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofSerializationError(`Failed to create compressed proof package: ${errorMsg}`, {
      code: 2007, // PROOF_COMPRESSION_ERROR
      recoverable: false,
      details: { originalError: errorMsg }
    });
  }
}

/**
 * Extract a proof from a compressed package
 * 
 * @param compressedPackage - The compressed proof package
 * @returns Decompressed proof container
 * 
 * This function extracts and decompresses a proof from a package created 
 * using createCompressedProofPackage.
 */
export function extractFromCompressedPackage(compressedPackage: string): object {
  try {
    // Parse the package
    let packageObj;
    try {
      packageObj = JSON.parse(compressedPackage);
    } catch (parseError) {
      const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      throw new InputError('Invalid compressed proof package: not valid JSON', {
        code: 7001,
        recoverable: false,
        details: { originalError: parseErrorMessage }
      });
    }

    // Validate the package
    if (!packageObj || packageObj.type !== 'compressed-zk-proof' || !packageObj.data) {
      throw new InputError('Invalid compressed proof package: missing required fields', {
        code: 7001,
        recoverable: false,
        details: { packageObj }
      });
    }

    // Extract compression metadata
    const metadata = packageObj.metadata as CompressedProofMeta;

    // Decompress the proof
    return decompressProof(packageObj.data, metadata);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'extractFromCompressedPackage',
      context: {
        packageSize: compressedPackage?.length
      }
    });

    if (error instanceof ProofError || error instanceof InputError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofSerializationError(`Failed to extract from compressed package: ${errorMsg}`, {
      code: 2008, // PROOF_DECOMPRESSION_ERROR
      recoverable: false,
      details: { originalError: errorMsg }
    });
  }
}

/**
 * Analyze proof structure to suggest optimization strategies
 * 
 * @param proof - The proof container or serialized proof
 * @returns Analysis result with size breakdown and suggestions
 * 
 * This function analyzes a proof's structure to identify areas where size
 * optimization would be most effective, providing recommendations on
 * which compression options to use.
 */
export function analyzeProofSize(proof: object | string): {
  totalSize: number;
  breakdown: Record<string, number>;
  recommendations: string[];
} {
  try {
    // Parse the proof if it's a string
    const proofContainer = typeof proof === 'string'
      ? zkProofSerializer.deserializeProof(proof)
      : proof;
      
    // Define interface for the proof container
    interface ProofContainer {
      format?: any;
      circuit?: any;
      proof?: {
        data?: any;
        publicSignals?: any;
      };
      metadata?: any;
    }
    
    // Type assertion for the proof container
    const typedProof = proofContainer as ProofContainer;

    // Size breakdown by component
    const breakdown: Record<string, number> = {};

    // Analyze each component
    if (typedProof.format) {
      breakdown.format = getByteSize(JSON.stringify(typedProof.format));
    }

    if (typedProof.circuit) {
      breakdown.circuit = getByteSize(JSON.stringify(typedProof.circuit));
    }

    if (typedProof.proof) {
      breakdown.proofData = getByteSize(JSON.stringify(typedProof.proof.data));
      breakdown.publicSignals = getByteSize(JSON.stringify(typedProof.proof.publicSignals));
    }

    if (typedProof.metadata) {
      breakdown.metadata = getByteSize(JSON.stringify(typedProof.metadata));
    }

    // Calculate total size
    const totalSize = getByteSize(JSON.stringify(typedProof));

    // Generate recommendations
    const recommendations: string[] = [];

    // Recommend based on component sizes
    const proofDataPercent = (breakdown.proofData / totalSize) * 100;
    const metadataPercent = (breakdown.metadata || 0) / totalSize * 100;

    if (proofDataPercent > 80) {
      recommendations.push(
        'Proof data accounts for >80% of total size. Use MAX compression level for best results.'
      );
    } else if (proofDataPercent > 60) {
      recommendations.push(
        'Proof data accounts for >60% of total size. Use BALANCED compression for good results.'
      );
    }

    if (metadataPercent > 20) {
      recommendations.push(
        'Metadata accounts for >20% of total size. Consider using stripMetadata option.'
      );
    }

    if (totalSize > 1024 * 1024) { // > 1MB
      recommendations.push(
        'Proof is very large (>1MB). Consider using binary format instead of Base64 for storage.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Proof size is already well-optimized. Standard compression should be sufficient.'
      );
    }

    return {
      totalSize,
      breakdown,
      recommendations
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'analyzeProofSize',
      context: {
        proofType: typeof proof
      }
    });

    if (error instanceof ProofError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofError(`Failed to analyze proof size: ${errorMsg}`, {
      code: 2004, // PROOF_INPUT_INVALID
      recoverable: true,
      details: { originalError: errorMsg }
    });
  }
}

/**
 * Estimate the optimal compression level for a given proof
 * 
 * @param proof - The proof container or serialized proof
 * @returns The recommended compression level and estimated size reduction
 * 
 * This function analyzes a proof and tests different compression levels
 * to determine the optimal balance between compression ratio and performance.
 */
export function estimateOptimalCompression(
  proof: object | string
): {
  optimalLevel: CompressionLevel;
  estimatedReduction: number;
  compressionOptions: CompressionOptions;
} {
  try {
    // Parse the proof if it's a string
    const proofContainer = typeof proof === 'string'
      ? zkProofSerializer.deserializeProof(proof)
      : proof;

    const proofJson = JSON.stringify(proofContainer);
    const originalSize = getByteSize(proofJson);

    // Test different compression levels
    const testResults: Array<{
      level: CompressionLevel;
      ratio: number;
      timeMs: number;
    }> = [];

    // Quick test of multiple compression levels
    for (const level of [
      CompressionLevel.FAST,
      CompressionLevel.BALANCED,
      CompressionLevel.MAX
    ]) {
      const startTime = Date.now();
      const compressedData = compressData(
        proofJson,
        CompressionAlgorithm.DEFLATE,
        level
      );
      const timeMs = Date.now() - startTime;
      const ratio = originalSize / compressedData.byteLength;

      testResults.push({ level, ratio, timeMs });
    }

    // Analyze results to find optimal level
    let optimalLevel = CompressionLevel.BALANCED; // Default
    let bestScore = 0;

    for (const result of testResults) {
      // Score is a balance of compression ratio and speed
      // Higher ratio and lower time is better
      const score = result.ratio / Math.log(result.timeMs + 1);

      if (score > bestScore) {
        bestScore = score;
        optimalLevel = result.level;
      }
    }

    // Determine if stripping metadata would be beneficial
    let stripMetadata = false;
    
    // Type assertion to access metadata property
    const containerWithMetadata = proofContainer as { metadata?: any };
    
    if (containerWithMetadata.metadata) {
      const metadataSize = getByteSize(JSON.stringify(containerWithMetadata.metadata));
      const metadataPercent = (metadataSize / originalSize) * 100;

      // If metadata is more than 15% of total size, recommend stripping
      stripMetadata = metadataPercent > 15;
    }

    // Find the result for the optimal level
    const optimalResult = testResults.find(r => r.level === optimalLevel);
    const estimatedReduction = optimalResult
      ? 1 - (1 / optimalResult.ratio)
      : 0.7; // Default to 70% if not found

    // Create recommended compression options
    const compressionOptions: CompressionOptions = {
      level: optimalLevel,
      algorithm: CompressionAlgorithm.DEFLATE,
      stripMetadata,
      // Keep essential fields if stripping metadata
      keepFields: stripMetadata ? ['createdAt', 'walletAddress', 'amount'] : [],
      useBinary: originalSize > 500 * 1024 // Use binary for proofs > 500KB
    };

    return {
      optimalLevel,
      estimatedReduction,
      compressionOptions
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'estimateOptimalCompression',
      context: {
        proofType: typeof proof
      }
    });

    if (error instanceof ProofError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofError(`Failed to estimate optimal compression: ${errorMsg}`, {
      code: 2004, // PROOF_INPUT_INVALID
      recoverable: true,
      details: { originalError: errorMsg }
    });
  }
}

// =====================================================================
// INTERNAL UTILITY FUNCTIONS
// =====================================================================

/**
 * Strip unnecessary metadata from a proof to reduce size
 * 
 * @param proofContainer - The proof container
 * @param keepFields - Optional array of metadata fields to keep
 * @returns Optimized proof container with reduced metadata
 * @private
 */
function stripUnnecessaryMetadata(
  proofContainer: any,
  keepFields: string[] = []
): any {
  // Create a copy of the container
  const optimized = JSON.parse(JSON.stringify(proofContainer));

  // If no metadata, just return the copy
  if (!optimized.metadata) {
    return optimized;
  }

  // Create minimal metadata with only essential fields
  const essentialFields = [
    // Always keep these critical fields
    'createdAt',
    'libraryVersion',
    'walletAddress',
    'amount',
    ...keepFields
  ];

  const strippedMetadata: Record<string, any> = {};

  // Only keep essential fields
  for (const field of essentialFields) {
    if (optimized.metadata[field] !== undefined) {
      strippedMetadata[field] = optimized.metadata[field];
    }
  }

  // Replace metadata with stripped version
  optimized.metadata = strippedMetadata;

  return optimized;
}

/**
 * Compress data using the specified algorithm and level
 * 
 * @param data - String data to compress
 * @param algorithm - Compression algorithm to use
 * @param level - Compression level
 * @returns Compressed data as Uint8Array
 * @private
 */
function compressData(
  data: string,
  algorithm: CompressionAlgorithm,
  level: CompressionLevel
): Uint8Array {
  // Convert string to Uint8Array
  const textEncoder = new TextEncoder();
  const dataArray = textEncoder.encode(data);

  // Use appropriate compression algorithm
  switch (algorithm) {
    case CompressionAlgorithm.DEFLATE:
      return pako_compress(dataArray, { level });

    case CompressionAlgorithm.GZIP:
      return pako_compress(dataArray, { level, gzip: true });

    case CompressionAlgorithm.BROTLI:
      // Fallback to DEFLATE if Brotli is not available
      // In a real implementation, we would use the Brotli library
      return pako_compress(dataArray, { level });

    default:
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }
}

/**
 * Decompress data using the specified algorithm
 * 
 * @param data - Compressed data as Uint8Array
 * @param algorithm - Compression algorithm used
 * @returns Decompressed data as Uint8Array
 * @private
 */
function decompressData(
  data: Uint8Array,
  algorithm: CompressionAlgorithm
): Uint8Array {
  // Use appropriate decompression algorithm
  switch (algorithm) {
    case CompressionAlgorithm.DEFLATE:
      return pako_decompress(data);

    case CompressionAlgorithm.GZIP:
      return pako_decompress(data, { to: 'string' });

    case CompressionAlgorithm.BROTLI:
      // Fallback to DEFLATE if Brotli is not available
      return pako_decompress(data);

    default:
      throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
  }
}

/**
 * Get the format version from a proof container
 * 
 * @param proofContainer - The proof container
 * @returns The proof format version
 * @private
 */
function getProofVersion(proofContainer: any): string {
  if (proofContainer?.format?.version) {
    return proofContainer.format.version;
  }
  return '1.0.0'; // Default version if not found
}

/**
 * Get the size of a string in bytes
 * 
 * @param str - The string to measure
 * @returns Size in bytes
 * @private
 */
function getByteSize(str: string): number {
  // Use TextEncoder to get actual UTF-8 byte length
  return new TextEncoder().encode(str).length;
}

/**
 * Convert an ArrayBuffer to a Base64 string
 * 
 * @param buffer - The ArrayBuffer or Uint8Array
 * @returns Base64 string
 * @private
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  } else if (typeof Buffer !== 'undefined') {
    return Buffer.from(binary, 'binary').toString('base64');
  }

  throw new Error('Base64 encoding not supported in this environment');
}

/**
 * Convert a Base64 string to an ArrayBuffer
 * 
 * @param base64 - Base64 string
 * @returns Uint8Array
 * @private
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  let binaryString: string;

  if (typeof atob !== 'undefined') {
    binaryString = atob(base64);
  } else if (typeof Buffer !== 'undefined') {
    binaryString = Buffer.from(base64, 'base64').toString('binary');
  } else {
    throw new Error('Base64 decoding not supported in this environment');
  }

  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}