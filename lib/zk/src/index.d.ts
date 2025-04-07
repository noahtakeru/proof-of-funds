/**
 * Type declarations for the ZK module
 * This file ensures TypeScript compatibility with both the original JS modules
 * and the new TypeScript infrastructure
 */

// Export all types from our type definitions
export * from './types';

// WebAssembly Loader types
export declare const wasmLoader: {
  loadWasmModule: (url: string, options?: any) => Promise<any>;
  cacheWasmModule: (key: string, module: any) => void;
  getCachedWasmModule: (key: string) => any | undefined;
  clearCache: () => void;
};

export declare function detectWasmSupport(): Promise<boolean>;

// snarkjs Loader types
export declare const snarkjsLoader: {
  initialize: () => Promise<boolean>;
  isInitialized: () => boolean;
  getSnarkjs: () => any;
  reset: () => Promise<void>;
  getVersion: () => string;
};

// Circuit Types
export declare function getCircuitByType(circuitType: import('./types').CircuitType): import('./types').CircuitDefinition | undefined;
export declare function getCircuitByVersion(version: import('./types').CircuitVersion): import('./types').CircuitDefinition | undefined;
export declare function mapProofTypeToString(proofType: import('./types').CircuitType): string;
export declare function mapStringToProofType(proofTypeStr: string): import('./types').CircuitType | undefined;

// Circuit Builder
export interface CompiledCircuit {
  wasm: Uint8Array;
  zkey: Uint8Array;
  verificationKey: any;
  circuitType: import('./types').CircuitType;
  version: import('./types').CircuitVersion;
  metadata: {
    compiledAt: string;
    compiler: string;
    optimizationLevel: number;
    constraints: number;
  };
}

export declare const circuitBuilder: {
  buildCircuit: (circuitType: import('./types').CircuitType, options?: any) => Promise<CompiledCircuit>;
  verifyCircuitBuild: (circuitVersion: import('./types').CircuitVersion) => Promise<boolean>;
  rebuildAllCircuits: (options?: any) => Promise<CompiledCircuit[]>;
};

// Progress Tracking
export interface ProgressEvent {
  operation: string;
  step: string;
  progress: number;
  message?: string;
  detail?: any;
}

export type ProgressCallback = (event: ProgressEvent) => void;

export declare const zkProgressTracker: {
  registerProgressCallback: (operation: string, callback: ProgressCallback) => void;
  unregisterProgressCallback: (operation: string, callback: ProgressCallback) => void;
  reportProgress: (event: ProgressEvent) => void;
  startOperation: (operation: string, steps: string[]) => void;
  completeOperation: (operation: string, result?: any) => void;
  reportError: (operation: string, step: string, error: any) => void;
  getCurrentProgress: () => Map<string, ProgressEvent>;
  resetProgress: () => void;
};

export declare function createProgressReporter(operation: string): {
  reportProgress: (step: string, progress: number, message?: string, detail?: any) => void;
  reportError: (step: string, error: any) => void;
  complete: (result?: any) => void;
  wrapWithProgress: <T extends (...args: any[]) => Promise<any>>(fn: T, step: string) => (...args: Parameters<T>) => Promise<ReturnType<T>>;
};

// Test Utilities
export declare function generateTestWallet(): { address: string; privateKey: string };
export declare function generateTestBalanceData(amount: string): { address: string; amount: string; token: string; timestamp: number };
export declare function mockProofGeneration(circuitType: import('./types').CircuitType, params: import('./types').ProofParameters): Promise<{ proof: string; publicSignals: string[] }>;
export declare function mockProofVerification(circuitType: import('./types').CircuitType, proof: string, publicSignals: string[]): Promise<import('./types').VerificationResult>;
export declare function createBenchmark<T extends (...args: any[]) => Promise<any>>(fn: T): (...args: Parameters<T>) => Promise<{ result: Awaited<ReturnType<T>>, timing: { start: number, end: number, duration: number } }>;

// Initialization Functions
export declare function initializeZkSystem(): Promise<boolean>;

// Original JS functions from zkUtils.js
export declare function generateZKProof(walletData: any, proofType: string, options?: any): Promise<any>;
export declare function verifyZKProof(proof: any, publicInputs: any, proofType: string): Promise<any>;
export declare function serializeZKProof(proof: any): string;
export declare function deserializeZKProof(serializedProof: string): any;
export declare function generateZKProofHash(proof: any): string;
export declare function initializeSnarkJS(): Promise<void>;

// Original JS functions from zkCircuits.js
export declare function getCircuitData(circuitType: string): any;
export declare function getCircuitCode(circuitType: string): string;
export declare const CIRCUIT_NAMES: string[];

// Original JS functions from zkCircuitInputs.js
export declare function generateInputs(walletData: any, options?: any): any;
export declare function extractPublicInputs(inputs: any): any;
export declare function validateInputs(inputs: any): boolean;
export declare function addressToBytes(address: string): number[];

// Original JS functions from zkTest.js
export declare function generateTestProof(walletData?: any, proofType?: string): Promise<any>;
export declare function generateTestWalletAndProof(proofType?: string): Promise<any>;
export declare function runVerificationTest(proofType?: string): Promise<boolean>;
export declare function runAllTests(): Promise<any>;

// Namespace exports for convenience
export declare const utils: {
  generateZKProof: typeof generateZKProof;
  verifyZKProof: typeof verifyZKProof;
  serializeZKProof: typeof serializeZKProof;
  deserializeZKProof: typeof deserializeZKProof;
  generateZKProofHash: typeof generateZKProofHash;
  initializeSnarkJS: typeof initializeSnarkJS;
  wasmLoader: typeof wasmLoader;
  detectWasmSupport: typeof detectWasmSupport;
  snarkjsLoader: typeof snarkjsLoader;
};

export declare const circuits: {
  getCircuitData: typeof getCircuitData;
  getCircuitCode: typeof getCircuitCode;
  CIRCUIT_NAMES: string[];
  getCircuitByType: typeof getCircuitByType;
  getCircuitByVersion: typeof getCircuitByVersion;
  circuitBuilder: typeof circuitBuilder;
};

export declare const inputs: {
  generateInputs: typeof generateInputs;
  extractPublicInputs: typeof extractPublicInputs;
  validateInputs: typeof validateInputs;
  addressToBytes: typeof addressToBytes;
};

export declare const test: {
  generateTestProof: typeof generateTestProof;
  generateTestWalletAndProof: typeof generateTestWalletAndProof;
  runVerificationTest: typeof runVerificationTest;
  runAllTests: typeof runAllTests;
  generateTestWallet: typeof generateTestWallet;
  generateTestBalanceData: typeof generateTestBalanceData;
  mockProofGeneration: typeof mockProofGeneration;
  mockProofVerification: typeof mockProofVerification;
  createBenchmark: typeof createBenchmark;
};

export declare const progress: {
  zkProgressTracker: typeof zkProgressTracker;
  createProgressReporter: typeof createProgressReporter;
};

// ZK proof types from constants
export declare const ZK_PROOF_TYPES: {
  STANDARD: string;
  THRESHOLD: string;
  MAXIMUM: string;
};

// Default export
export declare const types: any;

declare const _default: {
  ZK_PROOF_TYPES: typeof ZK_PROOF_TYPES;
  utils: typeof utils;
  circuits: typeof circuits;
  inputs: typeof inputs;
  test: typeof test;
  progress: typeof progress;
  types: typeof types;
  generateZKProof: typeof generateZKProof;
  verifyZKProof: typeof verifyZKProof;
  generateInputs: typeof generateInputs;
  initializeZkSystem: typeof initializeZkSystem;
};

export default _default;