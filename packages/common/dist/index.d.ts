/**
 * @throws {Error} - This function will throw during Phase 2 setup
 * @returns {never}
 */
declare function getErrorLogger(): never;
/**
 * @throws {Error} - This function will throw during Phase 2 setup
 * @returns {never}
 */
declare function createZKError(code: any, message: any, options?: {}): never;
declare namespace ErrorSeverity {
    let CRITICAL: string;
    let ERROR: string;
    let WARNING: string;
    let INFO: string;
}
declare namespace ErrorCategory {
    let CIRCUIT: string;
    let PROOF: string;
    let VERIFICATION: string;
    let MEMORY: string;
    let NETWORK: string;
    let SECURITY: string;
    let INPUT: string;
    let SYSTEM: string;
    let COMPATIBILITY: string;
}
declare namespace ZKErrorCode {
    let SYSTEM_NOT_INITIALIZED: number;
    let SYSTEM_FEATURE_UNSUPPORTED: number;
}

/**
 * @throws {Error} - This function will throw during Phase 2 setup
 * @returns {never}
 */
declare function generateZKProof(input: any, options?: {}): never;
/**
 * @throws {Error} - This function will throw during Phase 2 setup
 * @returns {never}
 */
declare function verifyZKProof(proof: any, publicSignals: any, proofType: any, options?: {}): never;
/**
 * @throws {Error} - This function will throw during Phase 2 setup
 * @returns {never}
 */
declare function serializeZKProof(proof: any, publicSignals: any): never;
/**
 * @throws {Error} - This function will throw during Phase 2 setup
 * @returns {never}
 */
declare function deserializeZKProof(serializedProof: any, serializedPublicSignals: any): never;
declare namespace ZK_PROOF_TYPES {
    let STANDARD: number;
    let THRESHOLD: number;
    let MAXIMUM: number;
}
/**
 * This will be the SNARK field size constant used in the actual implementation
 * Matches the value in zkUtils.mjs
 */
declare const SNARK_FIELD_SIZE: 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

declare const MemoryManager: MemoryManagerClass;
declare const SecureStorage: SecureStorageClass;
declare const DeviceCapabilities: DeviceCapabilitiesClass;
/**
 * System Utilities for Zero-Knowledge Operations
 *
 * This module will contain system utilities migrated from the original implementation.
 * During Phase 3.1, Step 4, we will migrate the actual implementations from:
 * - /lib/zk/src/memoryManager.mjs
 * - /lib/zk/src/secureStorage.mjs
 * - /lib/zk/src/SecureKeyManager.js
 *
 * @module system
 */
/**
 * Memory management functionality interface
 * This will throw until the actual implementation is migrated
 */
declare class MemoryManagerClass {
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    allocateMemory(size: any): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    releaseMemory(): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    getMemoryUsage(): never;
}
/**
 * Secure storage functionality interface
 * This will throw until the actual implementation is migrated
 */
declare class SecureStorageClass {
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    store(key: any, value: any): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    retrieve(key: any): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    remove(key: any): never;
}
/**
 * Device capability detection interface
 * This will throw until the actual implementation is migrated
 */
declare class DeviceCapabilitiesClass {
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    hasWasm(): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    hasWebWorkers(): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    hasSharedArrayBuffer(): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    getMemoryLimit(): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    getCpuCores(): never;
    /**
     * @throws {Error} - This function will throw during Phase 2 setup
     * @returns {never}
     */
    getBrowserInfo(): never;
}

export { DeviceCapabilities, ErrorCategory, ErrorSeverity, MemoryManager, SNARK_FIELD_SIZE, SecureStorage, ZKErrorCode, ZK_PROOF_TYPES, createZKError, deserializeZKProof, generateZKProof, getErrorLogger, serializeZKProof, verifyZKProof };
