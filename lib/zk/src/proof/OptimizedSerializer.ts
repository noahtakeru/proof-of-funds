/**
 * OptimizedSerializer.ts - Size-optimized proof serialization
 * 
 * This module provides an optimized serialization format for zero-knowledge proofs,
 * designed to minimize size while maintaining all necessary information.
 * 
 * @module OptimizedSerializer
 */

import { InputError, ProofError, ProofSerializationError } from '../zkErrorHandler.js';
import { ZKErrorLogger } from '../zkErrorLogger.js';
import * as zkProofSerializer from '../zkProofSerializer.js';
import { CompressionAlgorithm, CompressionLevel, compressProof, decompressProof } from './ProofCompressor';

// Create logger instance
const logger = new ZKErrorLogger({
  logLevel: 'info',
  privacyLevel: 'internal'
});

/**
 * Field encoding strategies for more compact representation
 */
enum FieldEncoding {
  /** Standard JSON encoding */
  JSON = 'json',
  /** Protocol Buffers-like compact format */
  COMPACT = 'compact',
  /** Binary encoding for Field Elements */
  BINARY = 'binary'
}

/**
 * Options for optimized serialization
 */
export interface OptimizedSerializationOptions {
  /** Whether to use compression */
  useCompression?: boolean;
  /** Compression level if using compression */
  compressionLevel?: CompressionLevel;
  /** Compression algorithm if using compression */
  compressionAlgorithm?: CompressionAlgorithm;
  /** Field encoding strategy */
  fieldEncoding?: FieldEncoding;
  /** Whether to use short keys in JSON */
  useShortKeys?: boolean;
  /** Specific fields to omit from serialization */
  omitFields?: string[];
  /** Whether to include a checksum for data integrity */
  includeChecksum?: boolean;
}

/**
 * Default serialization options
 */
const DEFAULT_SERIALIZATION_OPTIONS: OptimizedSerializationOptions = {
  useCompression: true,
  compressionLevel: CompressionLevel.BALANCED,
  compressionAlgorithm: CompressionAlgorithm.DEFLATE,
  fieldEncoding: FieldEncoding.COMPACT,
  useShortKeys: true,
  omitFields: [],
  includeChecksum: true
};

/**
 * Key mapping for short key optimization
 * This significantly reduces JSON size by using shorter property names
 */
const KEY_MAPPING: Record<string, string> = {
  // Format section
  'format': 'f',
  'version': 'v',
  'type': 't',

  // Circuit section
  'circuit': 'c',

  // Proof section
  'proof': 'p',
  'data': 'd',
  'publicSignals': 'ps',

  // Field Elements in proofs
  'pi_a': 'pa',
  'pi_b': 'pb',
  'pi_c': 'pc',
  'protocol': 'pt',

  // Metadata section
  'metadata': 'm',
  'createdAt': 'ca',
  'libraryVersion': 'lv',
  'walletAddress': 'wa',
  'amount': 'am',
  'environment': 'env',

  // Compressed proof metadata
  'algorithm': 'alg',
  'level': 'lvl',
  'metadataStripped': 'ms',
  'originalVersion': 'ov',
  'compressedAt': 'cat',
  'originalSize': 'os',
  'compressionRatio': 'cr'
};

// Reverse mapping for deserialization
const REVERSE_KEY_MAPPING: Record<string, string> =
  Object.entries(KEY_MAPPING).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {} as Record<string, string>);

/**
 * Serialize a proof using optimized format for minimal size
 * 
 * @param proof - The proof container or serialized proof
 * @param options - Optimization options
 * @returns Optimized serialized proof as string
 * 
 * This function serializes a ZK proof using various optimization techniques
 * to minimize size while preserving all necessary information for verification.
 */
export function serializeOptimized(
  proof: object | string,
  options: OptimizedSerializationOptions = {}
): string {
  const opts = { ...DEFAULT_SERIALIZATION_OPTIONS, ...options };

  try {
    // Parse the proof if it's a string
    let proofContainer = proof;
    if (typeof proof === 'string') {
      try {
        proofContainer = zkProofSerializer.deserializeProof(proof);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.logError(new Error(errorMessage), {
          operation: 'serializeOptimized',
          context: {
            proofType: typeof proof,
            options: opts
          }
        });
        throw new InputError(`Invalid proof data: ${errorMessage}`, {
          code: 7001,
          recoverable: false,
          details: { originalError: errorMessage }
        });
      }
    }

    // Calculate checksum if required
    let checksum: string | undefined;
    if (opts.includeChecksum) {
      checksum = calculateProofChecksum(proofContainer);
    }

    // Create optimized structure
    const optimized = createOptimizedStructure(
      proofContainer,
      opts.useShortKeys,
      opts.omitFields,
      checksum
    );

    // Use the appropriate field encoding strategy
    let encoded: string;
    switch (opts.fieldEncoding) {
      case FieldEncoding.COMPACT:
        encoded = encodeCompact(optimized);
        break;
      case FieldEncoding.BINARY:
        encoded = encodeBinary(optimized);
        break;
      case FieldEncoding.JSON:
      default:
        encoded = JSON.stringify(optimized);
        break;
    }

    // Apply compression if requested
    if (opts.useCompression) {
      const compressed = compressProof(encoded, {
        level: opts.compressionLevel,
        algorithm: opts.compressionAlgorithm,
        stripMetadata: false,
        useBinary: false
      });

      return compressed.data as string;
    }

    return encoded;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.logError(new Error(errorMessage), {
      operation: 'serializeOptimized',
      context: {
        proofType: typeof proof,
        options: opts
      }
    });

    if (error instanceof InputError || error instanceof ProofError) {
      throw error;
    }

    throw new ProofSerializationError(`Failed to create optimized serialization: ${errorMessage}`, {
      code: 2007, // PROOF_SERIALIZATION_ERROR 
      recoverable: false,
      details: { originalError: errorMessage }
    });
  }
}

/**
 * Deserialize a proof from optimized format
 * 
 * @param serialized - The optimized serialized proof
 * @param options - Deserialization options
 * @returns Deserialized proof container
 * 
 * This function deserializes a ZK proof that was serialized using the
 * optimized format, reversing all optimizations to restore the original structure.
 */
export function deserializeOptimized(
  serialized: string,
  options: Partial<OptimizedSerializationOptions> = {}
): object {
  const opts = { ...DEFAULT_SERIALIZATION_OPTIONS, ...options };

  try {
    // Decompress if needed
    let decodedData: string;
    if (opts.useCompression) {
      const decompressed = decompressProof(serialized);
      decodedData = JSON.stringify(decompressed);
    } else {
      decodedData = serialized;
    }

    // Decode based on field encoding
    let decoded: any;
    switch (opts.fieldEncoding) {
      case FieldEncoding.COMPACT:
        decoded = decodeCompact(decodedData);
        break;
      case FieldEncoding.BINARY:
        decoded = decodeBinary(decodedData);
        break;
      case FieldEncoding.JSON:
      default:
        decoded = JSON.parse(decodedData);
        break;
    }

    // Expand short keys if they were used
    if (opts.useShortKeys) {
      decoded = expandShortKeys(decoded);
    }

    // Verify checksum if present
    if (opts.includeChecksum && decoded._checksum) {
      const calculatedChecksum = calculateProofChecksum(decoded);
      if (calculatedChecksum !== decoded._checksum) {
        throw new ProofError('Checksum verification failed', {
          code: 2009, // PROOF_INTEGRITY_ERROR
          recoverable: false,
          details: {
            expected: decoded._checksum,
            actual: calculatedChecksum
          }
        });
      }

      // Remove checksum from final output
      delete decoded._checksum;
    }

    return decoded;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.logError(new Error(errorMessage), {
      operation: 'deserializeOptimized',
      context: {
        serializedLength: serialized?.length,
        options: opts
      }
    });

    if (error instanceof ProofError) {
      throw error;
    }

    throw new ProofSerializationError(`Failed to deserialize optimized proof: ${errorMessage}`, {
      code: 2008, // PROOF_DESERIALIZATION_ERROR
      recoverable: false,
      details: { originalError: errorMessage }
    });
  }
}

/**
 * Estimate the size reduction from using optimized serialization
 * 
 * @param proof - The proof container or serialized proof
 * @returns Size comparison information
 * 
 * This function analyzes a proof and estimates how much size reduction
 * would be achieved using different optimization techniques.
 */
export function estimateSizeReduction(
  proof: object | string
): {
  originalSize: number;
  optimizedSizes: Record<string, number>;
  reductionPercentages: Record<string, number>;
  recommendations: string[];
} {
  try {
    // Parse the proof if it's a string
    const proofContainer = typeof proof === 'string'
      ? zkProofSerializer.deserializeProof(proof)
      : proof;

    // Get original size
    const originalJson = JSON.stringify(proofContainer);
    const originalSize = new TextEncoder().encode(originalJson).length;

    // Test different optimization techniques
    const optimizedSizes: Record<string, number> = {};
    const reductionPercentages: Record<string, number> = {};

    // Standard with short keys
    const shortKeysOpt = serializeOptimized(proofContainer, {
      useCompression: false,
      useShortKeys: true,
      fieldEncoding: FieldEncoding.JSON
    });
    optimizedSizes.shortKeys = new TextEncoder().encode(shortKeysOpt).length;
    reductionPercentages.shortKeys =
      ((originalSize - optimizedSizes.shortKeys) / originalSize) * 100;

    // Compact encoding
    const compactOpt = serializeOptimized(proofContainer, {
      useCompression: false,
      fieldEncoding: FieldEncoding.COMPACT
    });
    optimizedSizes.compact = new TextEncoder().encode(compactOpt).length;
    reductionPercentages.compact =
      ((originalSize - optimizedSizes.compact) / originalSize) * 100;

    // Compression only
    const compressedOpt = serializeOptimized(proofContainer, {
      useCompression: true,
      useShortKeys: false,
      fieldEncoding: FieldEncoding.JSON
    });
    optimizedSizes.compressed = new TextEncoder().encode(compressedOpt).length;
    reductionPercentages.compressed =
      ((originalSize - optimizedSizes.compressed) / originalSize) * 100;

    // Full optimization
    const fullOpt = serializeOptimized(proofContainer, {
      useCompression: true,
      useShortKeys: true,
      fieldEncoding: FieldEncoding.COMPACT
    });
    optimizedSizes.full = new TextEncoder().encode(fullOpt).length;
    reductionPercentages.full =
      ((originalSize - optimizedSizes.full) / originalSize) * 100;

    // Generate recommendations based on results
    const recommendations: string[] = [];

    if (reductionPercentages.full > 90) {
      recommendations.push('Use full optimization for this proof - achieves >90% size reduction');
    } else if (reductionPercentages.full > 80) {
      recommendations.push('Full optimization is highly effective - >80% size reduction');
    }

    // Compare compression vs other techniques
    if (reductionPercentages.compressed > reductionPercentages.compact &&
      reductionPercentages.compressed > reductionPercentages.shortKeys) {
      recommendations.push('Compression alone provides the most significant benefit');
    } else if (reductionPercentages.compact > reductionPercentages.compressed) {
      recommendations.push('Compact encoding is more effective than compression alone');
    }

    // If proof is small, maybe avoid compression
    if (originalSize < 5000 && reductionPercentages.shortKeys > 30) {
      recommendations.push('For this small proof, using short keys without compression may be optimal');
    }

    // If no specific recommendations, provide a general one
    if (recommendations.length === 0) {
      recommendations.push('Use full optimization for best results');
    }

    return {
      originalSize,
      optimizedSizes,
      reductionPercentages,
      recommendations
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.logError(new Error(errorMessage), {
      operation: 'estimateSizeReduction',
      context: {
        proofType: typeof proof
      }
    });

    if (error instanceof ProofError) {
      throw error;
    }

    throw new ProofError(`Failed to estimate size reduction: ${errorMessage}`, {
      code: 2004, // PROOF_INPUT_INVALID
      recoverable: true,
      details: { originalError: errorMessage }
    });
  }
}

/**
 * Convert a standard proof to an optimized format that preserves verification capability
 * 
 * @param proof - The proof container or serialized proof
 * @returns Minimized proof container with only verification-essential fields
 * 
 * This function creates a minimized proof container that contains only the
 * fields necessary for verification, eliminating all optional metadata
 * to achieve the smallest possible size while maintaining verifiability.
 */
export function createMinimalVerifiableProof(proof: object | string): object {
  try {
    // Parse the proof if it's a string
    const proofContainer = typeof proof === 'string'
      ? zkProofSerializer.deserializeProof(proof)
      : proof;

    // Extract only the essential verification data
    const verificationData = zkProofSerializer.extractProofForVerification(proofContainer);

    // Define interface for verification data
    interface VerificationData {
      circuitType: string;
      circuitVersion: string;
      proof: any;
      publicSignals: any;
    }

    // Type assertion for the extracted data
    const typedData = verificationData as VerificationData;

    // Create minimal structure with only what's needed for verification
    return {
      c: { // circuit
        t: typedData.circuitType, // type
        v: typedData.circuitVersion // version
      },
      p: { // proof
        d: typedData.proof, // data
        ps: typedData.publicSignals // publicSignals
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.logError(new Error(errorMessage), {
      operation: 'createMinimalVerifiableProof',
      context: {
        proofType: typeof proof
      }
    });

    if (error instanceof ProofError) {
      throw error;
    }

    throw new ProofError(`Failed to create minimal verifiable proof: ${errorMessage}`, {
      code: 2004, // PROOF_INPUT_INVALID
      recoverable: false,
      details: { originalError: errorMessage }
    });
  }
}

// =====================================================================
// INTERNAL UTILITY FUNCTIONS
// =====================================================================

/**
 * Create optimized structure from proof container
 * 
 * @param proofContainer - The proof container
 * @param useShortKeys - Whether to use short keys
 * @param omitFields - Fields to omit
 * @param checksum - Optional checksum to include
 * @returns Optimized structure
 * @private
 */
function createOptimizedStructure(
  proofContainer: any,
  useShortKeys: boolean = true,
  omitFields: string[] = [],
  checksum?: string
): any {
  // Create a deep copy
  let optimized = JSON.parse(JSON.stringify(proofContainer));

  // Remove omitted fields
  for (const field of omitFields) {
    const fieldPath = field.split('.');
    let current = optimized;

    for (let i = 0; i < fieldPath.length - 1; i++) {
      if (current[fieldPath[i]] === undefined) {
        break;
      }
      current = current[fieldPath[i]];
    }

    const lastField = fieldPath[fieldPath.length - 1];
    if (current && current[lastField] !== undefined) {
      delete current[lastField];
    }
  }

  // Add checksum if provided
  if (checksum) {
    optimized._checksum = checksum;
  }

  // Use short keys if requested
  if (useShortKeys) {
    optimized = applyShortKeys(optimized);
  }

  return optimized;
}

/**
 * Apply short keys to an object recursively
 * 
 * @param obj - Object to process
 * @returns Object with shortened keys
 * @private
 */
function applyShortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => applyShortKeys(item));
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const shortKey = KEY_MAPPING[key] || key;
    result[shortKey] = applyShortKeys(value);
  }

  return result;
}

/**
 * Expand short keys back to original keys
 * 
 * @param obj - Object with short keys
 * @returns Object with original keys
 * @private
 */
function expandShortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => expandShortKeys(item));
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const originalKey = REVERSE_KEY_MAPPING[key] || key;
    result[originalKey] = expandShortKeys(value);
  }

  return result;
}

/**
 * Calculate checksum for proof integrity verification
 * 
 * @param obj - Proof object
 * @returns Checksum string
 * @private
 */
function calculateProofChecksum(obj: any): string {
  // Create a stable representation for hashing (order matters)
  const proofData = obj.proof?.data ? JSON.stringify(obj.proof.data) : '';
  const publicSignals = obj.proof?.publicSignals ? JSON.stringify(obj.proof.publicSignals) : '';

  // Combine critical elements
  const criticalData = `${proofData}|${publicSignals}`;

  // Create a simple hash
  return simpleHash(criticalData);
}

/**
 * Simple hash function for checksums
 * 
 * @param str - String to hash
 * @returns Hash string
 * @private
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }

  // Convert to hex string and ensure positive
  const hexHash = (hash >>> 0).toString(16);
  return hexHash.padStart(8, '0');
}

/**
 * Encode using a compact protocol-buffer-like format
 * Note: In a real implementation, we would use a proper schema-based serializer.
 * This is a simplified implementation that follows the concept.
 * 
 * @param data - Data to encode
 * @returns Compact encoded string
 * @private
 */
function encodeCompact(data: any): string {
  // For this implementation, we'll use a simple approach
  // 1. Convert field names to indices based on frequency
  // 2. Use a more compact JSON format

  // This would normally be a more sophisticated binary format,
  // but we're simplifying for demonstration purposes
  return JSON.stringify(data);
}

/**
 * Decode compact format back to original
 * 
 * @param encoded - Encoded data
 * @returns Decoded object
 * @private
 */
function decodeCompact(encoded: string): any {
  // In a real implementation, this would use the schema to reconstruct
  // the original object from the compact representation
  return JSON.parse(encoded);
}

/**
 * Encode in binary format
 * Note: In a real implementation, we would use a proper binary serializer.
 * 
 * @param data - Data to encode
 * @returns Binary encoded string (as base64)
 * @private
 */
function encodeBinary(data: any): string {
  // Simplified implementation - in a real system, this would use
  // a proper binary serialization format like Protobuf, CBOR, or MessagePack

  // Convert to JSON and then to binary, then encode as base64
  const jsonStr = JSON.stringify(data);
  const encoder = new TextEncoder();
  const binaryData = encoder.encode(jsonStr);

  return arrayBufferToBase64(binaryData);
}

/**
 * Decode binary format back to original
 * 
 * @param encoded - Encoded data
 * @returns Decoded object
 * @private
 */
function decodeBinary(encoded: string): any {
  // Convert from base64 to binary, then to JSON
  const binaryData = base64ToArrayBuffer(encoded);
  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(binaryData);

  return JSON.parse(jsonStr);
}

/**
 * Convert an ArrayBuffer to Base64
 * 
 * @param buffer - ArrayBuffer to convert
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
 * Convert Base64 to ArrayBuffer
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