/**
 * Main entry point for the Proof of Funds common package
 * This file exports all modules from the common package.
 * 
 * During Phase 3 of the dependency resolution plan, this file will be updated
 * to export the actual implementations after they have been migrated from
 * their original locations.
 * 
 * @module common
 */

// Error handling - will contain exports from zkErrorHandler.mjs and zkErrorLogger.mjs
export * from './error-handling/index.js';

// Core ZK modules - will contain exports from zkUtils.mjs, zkCircuitRegistry.mjs, and zkCircuitInputs.mjs
export * from './zk-core/index.js';

// System utilities - will contain exports from memoryManager.mjs, secureStorage.mjs, and SecureKeyManager.js
export * from './system/index.js';