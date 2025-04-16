/**
 * TypeScript type definitions for the Zero-Knowledge Proof infrastructure
 * 
 * This file contains all type definitions used throughout the ZK module,
 * providing type safety and better IDE support for development.
 * 
 * ---------- NON-TECHNICAL EXPLANATION ----------
 * Think of this file as a detailed blueprint for all the data structures in our
 * privacy system. Just like architectural blueprints ensure builders all follow
 * the same plan, these type definitions ensure all parts of our code handle data
 * consistently.
 */

import { ZK_PROOF_TYPES } from '../../config/constants';

// ============================================================
// CORE TYPES
// ============================================================

/**
 * Supported circuit types in the zero-knowledge proof system
 * 
 * - standard: Proves exact balance amount
 * - threshold: Proves balance is at least a minimum amount 
 * - maximum: Proves balance is at most a maximum amount
 */
export type CircuitType = 'standard' | 'threshold' | 'maximum';

/**
 * Circuit version identifier with semantic versioning
 * @example "1.0.0", "2.1.3"
 */
export type CircuitVersion = string;

/**
 * Location where operations can be performed
 */
export type ExecutionLocation = 'client' | 'server';

/**
 * Execution modes for proof generation/verification
 */
export enum ExecutionMode {
  /** Always execute on client side */
  CLIENT_ONLY = 'client_only',
  /** Try client first, fall back to server */
  CLIENT_PREFERRED = 'client_preferred',
  /** Always execute on server side */
  SERVER_ONLY = 'server_only',
  /** Try server first, fall back to client */
  SERVER_PREFERRED = 'server_preferred',
  /** Choose automatically based on capabilities */
  AUTOMATIC = 'automatic'
}

/**
 * Proof verification method
 */
export type VerificationMethod = 'standard' | 'alternative' | 'server' | 'test-mock' | 'local';

/**
 * All environment types where proofs can be generated or verified
 */
export type Environment = 'browser' | 'node' | 'mobile-browser' | 'unknown';

// ============================================================
// PROOF GENERATION AND VERIFICATION
// ============================================================

/**
 * Configuration parameters for ZK proof generation
 */
export interface ZKProofParams {
  /** Address of the wallet being proven */
  walletAddress: string;
  /** Amount to prove (exact, minimum, or maximum depending on proof type) */
  amount: string;
  /** Type of proof to generate (uses ZK_PROOF_TYPES enum values) */
  proofType: number;
  /** Optional settings for proof generation process */
  options?: ZKProofOptions;
  /** Additional private inputs that won't be exposed in publicSignals */
  privateData?: Record<string, unknown>;
}

/**
 * Detailed proof parameters with circuit-specific inputs
 */
export interface ProofParameters {
  /** Wallet address (public input) */
  address?: string;
  /** Amount to prove (public input) */
  amount?: string;
  /** Private key or secret for proving ownership */
  privateKey?: string;
  /** Random nonce to prevent correlation */
  nonce?: string;
  /** Optional signature data */
  signature?: string | string[];
  /** Circuit-specific additional parameters */
  [key: string]: unknown;
}

/**
 * Optional settings for proof generation
 */
export interface ZKProofOptions {
  /** Preferred execution location */
  preferredLocation?: ExecutionLocation;
  /** Callback for tracking progress during generation */
  progressCallback?: (progress: number) => void;
  /** Signal for aborting the operation */
  abortSignal?: AbortSignal;
  /** Maximum time to wait for completion in milliseconds */
  timeoutMs?: number;
  /** Memory requirements in MB */
  estimatedMemoryMB?: number;
  /** Whether to retry on failure */
  retry?: boolean;
  /** Custom execution mode */
  executionMode?: ExecutionMode;
  /** Whether to enable debugging */
  debug?: boolean;
}

/**
 * Raw proof data structure from the proof generation process
 */
export interface RawProofData {
  /** Array of points for pi_a */
  pi_a: string[];
  /** 2D array of points for pi_b */
  pi_b: string[][];
  /** Array of points for pi_c */
  pi_c: string[];
  /** Protocol identifier */
  protocol: string;
  /** Curve identifier */
  curve?: string;
}

/**
 * Comprehensive result of ZK proof generation
 */
export interface ZKProofResult {
  /** Serialized proof data or JSON string of RawProofData */
  proof: string;
  /** Serialized public signals */
  publicSignals: string;
  /** Type of proof generated */
  proofType: number;
  /** Hash of the proof for verification */
  proofHash?: string;
  /** Additional metadata about proof generation */
  metadata?: ZKProofMetadata;
}

/**
 * Metadata about the proof generation process
 */
export interface ZKProofMetadata {
  /** Time taken to generate the proof in milliseconds */
  generationTime: number;
  /** ISO timestamp when proof was generated */
  generatedAt: string;
  /** Location where proof was generated */
  source: ExecutionLocation;
  /** Version of the generator used */
  generatorVersion?: string;
  /** Circuit version used */
  circuitVersion?: string;
  /** Number of constraints in the circuit */
  constraints?: number;
  /** Environment where proof was generated */
  environment?: Environment;
  /** Device capability information */
  deviceInfo?: {
    memoryLimited: boolean;
    wasmSupported: boolean;
    performanceRating?: 'low' | 'medium' | 'high';
  };
}

/**
 * Parameters for ZK proof verification
 */
export interface ZKVerifyParams {
  /** Serialized proof data */
  proof: string;
  /** Serialized public signals */
  publicSignals: string;
  /** Type of proof to verify */
  proofType: number;
  /** Whether to allow fallback verification */
  fallbackVerification?: boolean;
  /** Optional verification key path override */
  vkeyPath?: string;
  /** Optional timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Detailed verification result
 */
export interface VerificationResult {
  /** Whether the proof is valid (will be deprecated in favor of valid) */
  isVerified?: boolean;
  /** Whether the proof is valid */
  valid?: boolean;
  /** Type of circuit that was verified */
  circuitType?: CircuitType;
  /** ISO timestamp when verification was performed */
  verifiedAt?: string;
  /** Method used for verification */
  verificationMethod?: VerificationMethod;
  /** Error message if verification failed */
  errorMessage?: string;
  /** Error message if verification failed (alias for errorMessage) */
  error?: string;
  /** Any warnings that occurred during verification */
  warnings?: string[];
  /** Performance metrics for verification */
  performance?: {
    /** Time taken for verification in milliseconds */
    verificationTimeMs: number;
    /** Memory used for verification in MB */
    memoryUsedMB?: number;
  };
  /** Location where verification was performed */
  verifiedAt_location?: ExecutionLocation;
  /** Contract address used for verification */
  contractAddress?: string;
  /** Proof ID that was verified */
  proofId?: string;
  /** Transaction hash for on-chain verification */
  transactionHash?: string;
  /** Block number for on-chain verification */
  blockNumber?: number;
  /** Gas used for on-chain verification */
  gasUsed?: string | number;
}

// ============================================================
// CIRCUIT CONFIGURATION
// ============================================================

/**
 * Circuit version configuration
 */
export interface CircuitVersionConfig {
  /** Path to WebAssembly file */
  wasmPath: string;
  /** Path to zkey file */
  zkeyPath: string;
  /** Path to verification key file */
  vkeyPath: string;
  /** Maximum input size this circuit can handle */
  maxInputSize: number;
  /** Array of version strings this circuit is compatible with */
  compatibleWith: string[];
  /** Whether this circuit version is deprecated */
  deprecated: boolean;
  /** Memory requirements in MB */
  memoryRequirementsMB?: number;
  /** Estimated proof generation time in milliseconds on reference hardware */
  estimatedProofTimeMs?: number;
  /** Feature flags for this circuit version */
  features?: {
    /** Whether this circuit supports batching */
    batchSupport: boolean;
    /** Whether this circuit has optimizations for mobile */
    mobileOptimized: boolean;
    /** Whether this circuit supports recursive proofs */
    recursiveProofSupport: boolean;
  };
}

/**
 * Circuit version registry mapping circuit types to their versions
 */
export interface CircuitVersionRegistry {
  [proofType: string]: {
    [version: string]: CircuitVersionConfig;
  };
}

/**
 * Resource requirements for a circuit
 */
export interface CircuitResources {
  /** Memory required in MB */
  memoryMB: number;
  /** Estimated CPU cores needed */
  cpuCores: number;
  /** Estimated time to generate proof in milliseconds */
  estimatedTimeMs: number;
  /** Whether WebAssembly SIMD is required */
  requiresSIMD: boolean;
  /** Minimum WebAssembly memory in pages */
  wasmMemoryPages: number;
}

/**
 * Circuit metadata
 */
export interface CircuitMeta {
  /** Circuit type (standard, threshold, maximum) */
  type: string;
  /** Circuit version */
  version: string;
  /** Number of constraints in the circuit */
  constraints: number;
  /** SHA-256 hash of the circuit */
  circuitHash?: string;
  /** Public inputs expected by the circuit */
  publicInputs?: string[];
  /** Private inputs expected by the circuit */
  privateInputs?: string[];
}

// ============================================================
// SECURITY AND STORAGE
// ============================================================

/**
 * Encrypted data structure for secure storage
 */
export interface EncryptedData {
  /** Encrypted data as array of numbers */
  encryptedData: number[];
  /** Initialization vector */
  iv: number[];
  /** Optional authentication tag for GCM mode */
  authTag?: number[];
  /** Metadata about the encryption */
  meta: {
    /** Timestamp when data was encrypted */
    timestamp: number;
    /** Type of encryption key used */
    keyType: string;
    /** Encryption algorithm used */
    algorithm?: string;
    /** Key derivation function used, if any */
    kdf?: string;
    /** Whether data is compressed */
    compressed?: boolean;
  };
}

/**
 * Security audit log entry
 */
export interface AuditLogEntry {
  /** Operation being audited */
  operation: string;
  /** ISO timestamp of the operation */
  timestamp: string;
  /** Result of the operation (success, failure) */
  result: 'success' | 'failure' | 'warning';
  /** User or system that initiated the operation */
  initiator: string;
  /** Resource that was accessed */
  resource?: string;
  /** Additional details about the operation */
  details?: Record<string, unknown>;
  /** Severity level of the entry */
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Secure session data
 */
export interface SecureSession {
  /** Session identifier */
  id: string;
  /** ISO timestamp when session was created */
  createdAt: string;
  /** ISO timestamp when session expires */
  expiresAt: string;
  /** Whether the session is authenticated */
  authenticated: boolean;
  /** Security level of the session */
  securityLevel: 'standard' | 'enhanced' | 'high';
  /** Device fingerprint */
  deviceFingerprint?: string;
  /** User identifier, if authenticated */
  userId?: string;
}

// ============================================================
// ENVIRONMENT AND CAPABILITIES
// ============================================================

/**
 * WebAssembly support detection result
 */
export interface WebAssemblySupport {
  /** Whether WebAssembly is supported */
  supported: boolean;
  /** Specific WebAssembly features */
  features: {
    /** Whether bulk memory operations are supported */
    bulkMemory: boolean;
    /** Whether exceptions are supported */
    exceptions: boolean;
    /** Whether SIMD instructions are supported */
    simd: boolean;
    /** Whether threading is supported */
    threads: boolean;
    /** Whether reference types are supported */
    referenceTypes?: boolean;
    /** Whether tail calls are supported */
    tailCall?: boolean;
  };
  /** WebAssembly version supported */
  version: string;
  /** Maximum memory pages available */
  maxMemoryPages?: number;
}

/**
 * Device performance capabilities
 */
export interface PerformanceCapabilities {
  /** Whether the device has limited processing power */
  isLowPoweredDevice: boolean;
  /** Whether the device has limited memory */
  limitedMemory: boolean;
  /** Whether the device supports Web Workers */
  supportsWorkers: boolean;
  /** Recommended execution location based on capabilities */
  recommendedLocation: ExecutionLocation;
  /** Maximum supported input size for proofs */
  maxInputSize: number;
  /** Benchmark results if available */
  benchmarks?: {
    /** Score from 0-100 based on performance tests */
    score: number;
    /** Proof generation time in milliseconds for reference circuit */
    proofGenerationMs?: number;
    /** Verification time in milliseconds for reference proof */
    verificationMs?: number;
  };
}

/**
 * Memory manager statistics
 */
export interface MemoryStats {
  /** Total memory available in MB */
  totalMemoryMB: number;
  /** Free memory available in MB */
  freeMemoryMB: number;
  /** Used memory in MB */
  usedMemoryMB: number;
  /** Memory usage percentage */
  usagePercentage: number;
  /** Whether the system is under memory pressure */
  underPressure: boolean;
  /** ISO timestamp when stats were collected */
  timestamp: string;
}

// ============================================================
// SERIALIZATION AND TRANSFER
// ============================================================

/**
 * Serialized ZK proof data format for storage and transfer
 */
export interface SerializedZKProof {
  /** Format version for serialization */
  version: string;
  /** Circuit metadata */
  circuit: CircuitMeta;
  /** Proof data structure */
  proof: RawProofData;
  /** Public signals (usually array of strings) */
  publicSignals: string[];
  /** Metadata about the proof */
  metadata: {
    /** Unix timestamp when proof was generated */
    timestamp: number;
    /** Version of the generator */
    generatorVersion: string;
    /** Environment where proof was generated */
    environment: string;
    /** Hash of the proof for verification */
    proofHash?: string;
  };
}

/**
 * Progress tracking information
 */
export interface ProgressInfo {
  /** Operation identifier */
  operationId: string;
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current operation status message */
  status: string;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemainingMs?: number;
  /** Whether the operation is complete */
  complete?: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Current step number */
  currentStep?: number;
  /** Total number of steps */
  totalSteps?: number;
}

/**
 * Gas management information for on-chain operations
 */
export interface GasEstimate {
  /** Estimated gas units required */
  estimatedGas: number;
  /** Cost in Wei (as string to handle large numbers) */
  costWei: string;
  /** Cost in ETH */
  costEth: string;
  /** Cost in USD */
  costUsd: string;
  /** Current gas price in Wei */
  gasPrice: string;
  /** Timestamp when estimate was made */
  timestamp: number;
  /** Detailed breakdown of gas usage by operation */
  breakdown?: Record<string, number>;
}

/**
 * Transaction options for contract interactions
 */
export interface TransactionOptions {
  /** Gas limit to use for the transaction */
  gasLimit?: number;
  /** Gas price in wei */
  gasPrice?: string;
  /** Value to send with the transaction in wei */
  value?: string;
  /** Maximum fee per gas for EIP-1559 transactions */
  maxFeePerGas?: string;
  /** Maximum priority fee per gas for EIP-1559 transactions */
  maxPriorityFeePerGas?: string;
  /** Nonce to use for the transaction */
  nonce?: number;
  /** Whether to wait for transaction confirmation */
  waitForConfirmation?: boolean;
  /** Number of confirmations to wait for */
  confirmations?: number;
  /** Transaction timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Result of a blockchain transaction
 */
export interface TransactionResult {
  /** Transaction hash */
  transactionHash: string;
  /** Transaction status (success or failure) */
  status: 'success' | 'failure' | 'pending';
  /** Block number where transaction was included */
  blockNumber?: number;
  /** Gas used by the transaction */
  gasUsed?: number;
  /** Effective gas price paid */
  effectiveGasPrice?: string;
  /** Transaction receipt object */
  receipt?: any;
  /** Error message if transaction failed */
  errorMessage?: string;
  /** Timestamp when transaction was submitted */
  timestamp: number;
  /** Transaction logs */
  logs?: any[];
}

/**
 * Wallet address type alias
 */
export type WalletAddress = string;

/**
 * Proof type enum
 */
export enum ProofType {
  Standard = 0,
  Threshold = 1,
  Maximum = 2,
  ZeroKnowledge = 3
}

/**
 * Proof status enum
 */
export enum ProofStatus {
  NotFound = 0,
  Pending = 1,
  Verified = 2,
  Rejected = 3,
  Expired = 4,
  Failed = 5
}

/**
 * Proof data structure
 */
export interface ProofData {
  /** The zkSNARK proof */
  proof: {
    a: string[];
    b: string[][];
    c: string[];
  };
  /** Public signals for the proof */
  publicSignals: string[];
}

/**
 * Proof submission result
 */
export interface ProofSubmission {
  /** Unique identifier for the proof */
  proofId: string;
  /** Status of the proof submission */
  status: ProofStatus;
  /** Transaction hash if submitted on-chain */
  transactionHash?: string;
  /** Block number if submitted on-chain */
  blockNumber?: number;
  /** Error message if submission failed */
  error?: string;
  /** Timestamp of the submission */
  timestamp: number;
  /** Wallet address the proof is for */
  walletAddress: string;
  /** Type of proof */
  proofType: ProofType;
  /** Any additional data for the proof */
  additionalData?: string;
  /** Index in the batch if submitted as part of a batch */
  batchIndex?: number;
}