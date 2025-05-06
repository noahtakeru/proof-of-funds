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

// packages/common/src/index.mjs
var index_exports = {};
__export(index_exports, {
  DeviceCapabilities: () => DeviceCapabilities,
  ErrorSeverity: () => ErrorSeverity,
  MemoryManager: () => MemoryManager,
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

// packages/common/src/error-handling/index.js
var ErrorSeverity = {
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical"
};
var ZKErrorCode = {
  // General errors
  INITIALIZATION_FAILED: "ZK_INIT_FAILED",
  INVALID_INPUT: "ZK_INVALID_INPUT",
  UNSUPPORTED_OPERATION: "ZK_UNSUPPORTED_OPERATION",
  // Circuit-specific errors
  CIRCUIT_NOT_FOUND: "ZK_CIRCUIT_NOT_FOUND",
  CIRCUIT_COMPILATION_FAILED: "ZK_CIRCUIT_COMPILATION_FAILED",
  // Proof generation errors
  PROOF_GENERATION_FAILED: "ZK_PROOF_GENERATION_FAILED",
  WITNESS_GENERATION_FAILED: "ZK_WITNESS_GENERATION_FAILED",
  // Verification errors
  VERIFICATION_FAILED: "ZK_VERIFICATION_FAILED",
  INVALID_PROOF_FORMAT: "ZK_INVALID_PROOF_FORMAT",
  // Resource errors
  MEMORY_LIMIT_EXCEEDED: "ZK_MEMORY_LIMIT_EXCEEDED",
  TIMEOUT_EXCEEDED: "ZK_TIMEOUT_EXCEEDED"
};
function createZKError(code, message, severity = ErrorSeverity.ERROR) {
  return {
    code,
    message,
    severity,
    timestamp: Date.now()
  };
}
function getErrorLogger() {
  return {
    log: (message) => console.log(message),
    error: (message) => console.error(message),
    warn: (message) => console.warn(message)
  };
}

// packages/common/src/zk-core/index.js
var ZK_PROOF_TYPES = {
  STANDARD: 0,
  THRESHOLD: 1,
  MAXIMUM: 2
};
async function generateZKProof(input, options = {}) {
  console.log("generateZKProof will be implemented with real functionality");
  return {
    proof: { pi_a: [], pi_b: [], pi_c: [] },
    publicSignals: []
  };
}
async function verifyZKProof(proofData, options = {}) {
  console.log("verifyZKProof will be implemented with real functionality");
  return true;
}
function serializeZKProof(proof, publicSignals) {
  console.log("serializeZKProof will be implemented with real functionality");
  return JSON.stringify({ proof, publicSignals });
}
function deserializeZKProof(serializedProof) {
  console.log("deserializeZKProof will be implemented with real functionality");
  return { proof: { pi_a: [], pi_b: [], pi_c: [] }, publicSignals: [] };
}

// packages/common/src/system/index.js
var MemoryManager = {
  allocateMemory: (size) => {
    console.log(`Allocating ${size} bytes of memory`);
    return true;
  },
  releaseMemory: () => {
    console.log("Releasing memory");
    return true;
  },
  getMemoryUsage: () => {
    return { used: 0, total: 0, percentage: 0 };
  }
};
var SecureStorage = {
  store: (key, value) => {
    console.log(`Storing ${key} in secure storage`);
    return true;
  },
  retrieve: (key) => {
    console.log(`Retrieving ${key} from secure storage`);
    return "";
  },
  remove: (key) => {
    console.log(`Removing ${key} from secure storage`);
    return true;
  }
};
var DeviceCapabilities = {
  hasWasm: () => true,
  hasWebWorkers: () => true,
  hasSharedArrayBuffer: () => false,
  getMemoryLimit: () => 2048,
  getCpuCores: () => 4,
  getBrowserInfo: () => ({ name: "Unknown", version: "0", mobile: false })
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DeviceCapabilities,
  ErrorSeverity,
  MemoryManager,
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
