"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.mjs
var index_exports = {};
__export(index_exports, {
  DeviceCapabilities: () => DeviceCapabilities,
  ErrorCategory: () => ErrorCategory,
  ErrorSeverity: () => ErrorSeverity,
  MemoryManager: () => MemoryManager,
  SNARK_FIELD_SIZE: () => SNARK_FIELD_SIZE,
  SecureStorage: () => SecureStorage,
  ZKErrorCode: () => ZKErrorCode,
  ZK_PROOF_TYPES: () => ZK_PROOF_TYPES,
  createZKError: () => createZKError,
  deserializeZKProof: () => deserializeZKProof,
  generateZKProof: () => generateZKProof,
  getErrorLogger: () => getErrorLogger,
  serializeZKProof: () => serializeZKProof,
  verifyZKProof: () => verifyZKProof
});
module.exports = __toCommonJS(index_exports);

// src/error-handling/index.js
var ErrorSeverity = {
  CRITICAL: "critical",
  ERROR: "error",
  WARNING: "warning",
  INFO: "info"
};
var ErrorCategory = {
  CIRCUIT: "circuit",
  PROOF: "proof",
  VERIFICATION: "verification",
  MEMORY: "memory",
  NETWORK: "network",
  SECURITY: "security",
  INPUT: "input",
  SYSTEM: "system",
  COMPATIBILITY: "compatibility"
};
var ZKErrorCode = {
  // Temporary error codes
  SYSTEM_NOT_INITIALIZED: 8001,
  SYSTEM_FEATURE_UNSUPPORTED: 8002
};
function getErrorLogger() {
  throw new Error("Error handling system not yet migrated. This will be implemented during Phase 3.1.");
}
function createZKError(code, message, options = {}) {
  throw new Error("Error handling system not yet migrated. This will be implemented during Phase 3.1.");
}

// src/zk-core/index.js
var ZK_PROOF_TYPES = {
  STANDARD: 0,
  THRESHOLD: 1,
  MAXIMUM: 2
};
async function generateZKProof(input, options = {}) {
  throw new Error("ZK core functionality not yet migrated. This will be implemented during Phase 3.1.");
}
async function verifyZKProof(proof, publicSignals, proofType, options = {}) {
  throw new Error("ZK core functionality not yet migrated. This will be implemented during Phase 3.1.");
}
function serializeZKProof(proof, publicSignals) {
  throw new Error("ZK core functionality not yet migrated. This will be implemented during Phase 3.1.");
}
function deserializeZKProof(serializedProof, serializedPublicSignals) {
  throw new Error("ZK core functionality not yet migrated. This will be implemented during Phase 3.1.");
}
var SNARK_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// src/system/index.js
var MemoryManagerClass = class {
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  allocateMemory(size) {
    throw new Error("Memory management not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  releaseMemory() {
    throw new Error("Memory management not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  getMemoryUsage() {
    throw new Error("Memory management not yet migrated. This will be implemented during Phase 3.1.");
  }
};
var SecureStorageClass = class {
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  store(key, value) {
    throw new Error("Secure storage not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  retrieve(key) {
    throw new Error("Secure storage not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  remove(key) {
    throw new Error("Secure storage not yet migrated. This will be implemented during Phase 3.1.");
  }
};
var DeviceCapabilitiesClass = class {
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  hasWasm() {
    throw new Error("Device capabilities not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  hasWebWorkers() {
    throw new Error("Device capabilities not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  hasSharedArrayBuffer() {
    throw new Error("Device capabilities not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  getMemoryLimit() {
    throw new Error("Device capabilities not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  getCpuCores() {
    throw new Error("Device capabilities not yet migrated. This will be implemented during Phase 3.1.");
  }
  /**
   * @throws {Error} - This function will throw during Phase 2 setup
   * @returns {never}
   */
  getBrowserInfo() {
    throw new Error("Device capabilities not yet migrated. This will be implemented during Phase 3.1.");
  }
};
var MemoryManager = new MemoryManagerClass();
var SecureStorage = new SecureStorageClass();
var DeviceCapabilities = new DeviceCapabilitiesClass();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DeviceCapabilities,
  ErrorCategory,
  ErrorSeverity,
  MemoryManager,
  SNARK_FIELD_SIZE,
  SecureStorage,
  ZKErrorCode,
  ZK_PROOF_TYPES,
  createZKError,
  deserializeZKProof,
  generateZKProof,
  getErrorLogger,
  serializeZKProof,
  verifyZKProof
});
