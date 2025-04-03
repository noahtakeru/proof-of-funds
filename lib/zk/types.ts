/**
 * TypeScript type definitions for the Zero-Knowledge Proof infrastructure
 * 
 * This file contains all type definitions used throughout the ZK module,
 * providing type safety and better IDE support for development.
 */

import { ZK_PROOF_TYPES } from '../../config/constants';

// Circuit type definition (used in our new code)
export type CircuitType = 'standard' | 'threshold' | 'maximum';
export type CircuitVersion = string;

/**
 * Configuration parameters for ZK proof generation
 */
export interface ZKProofParams {
  walletAddress: string;
  amount: string;
  proofType: number; // Use ZK_PROOF_TYPES enum values
  options?: ZKProofOptions;
  privateData?: any; // Additional private inputs that won't be exposed in publicSignals
}

/**
 * Proof parameters (used in new code)
 */
export interface ProofParameters {
  address?: string;
  amount?: string;
  privateKey?: string;
  nonce?: string;
  [key: string]: any; // Additional parameters
}

/**
 * Optional settings for proof generation
 */
export interface ZKProofOptions {
  preferredLocation?: 'client' | 'server';
  progressCallback?: (progress: number) => void;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Result of ZK proof generation
 */
export interface ZKProofResult {
  proof: string; // Serialized proof
  publicSignals: string; // Serialized public signals
  proofType: number;
  metadata?: {
    generationTime: number;
    generatedAt: string;
    source: 'client' | 'server';
  };
}

/**
 * Parameters for ZK proof verification
 */
export interface ZKVerifyParams {
  proof: string;
  publicSignals: string;
  proofType: number;
  fallbackVerification?: boolean;
}

/**
 * Detailed verification result
 */
export interface VerificationResult {
  valid: boolean;
  circuitType: CircuitType;
  verifiedAt: string;
  verificationMethod: 'standard' | 'alternative' | 'server' | 'test-mock';
  errorMessage?: string;
  warnings?: string[];
}

/**
 * Circuit version configuration
 */
export interface CircuitVersionConfig {
  wasmPath: string;
  zkeyPath: string;
  vkeyPath: string;
  maxInputSize: number;
  compatibleWith: string[];
  deprecated: boolean;
}

/**
 * Circuit version registry type
 */
export interface CircuitVersionRegistry {
  [proofType: string]: {
    [version: string]: CircuitVersionConfig;
  };
}

/**
 * Encrypted data structure for secure storage
 */
export interface EncryptedData {
  encryptedKey: number[]; // Encrypted data as array of numbers
  iv: number[]; // Initialization vector
  meta: {
    timestamp: number;
    keyType: string;
  };
}

/**
 * WebAssembly support detection result
 */
export interface WebAssemblySupport {
  supported: boolean;
  features: {
    bulkMemory: boolean;
    exceptions: boolean;
    simd: boolean;
    threads: boolean;
  };
  version: string;
}

/**
 * Device performance capabilities
 */
export interface PerformanceCapabilities {
  isLowPoweredDevice: boolean;
  limitedMemory: boolean;
  supportsWorkers: boolean;
  recommendedLocation: 'client' | 'server';
  maxInputSize: number;
}

/**
 * Circuit metadata
 */
export interface CircuitMeta {
  type: string; // 'standard', 'threshold', 'maximum'
  version: string;
  constraints: number;
}

/**
 * Serialized ZK proof data
 */
export interface SerializedZKProof {
  version: string;
  circuit: CircuitMeta;
  proof: any;
  publicSignals: any;
  metadata: {
    timestamp: number;
    generatorVersion: string;
    environment: string;
  };
}