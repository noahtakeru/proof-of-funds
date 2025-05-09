/**
 * Main entry point for the Proof of Funds common package
 * This file exports all modules from the common package.
 * 
 * @module common
 */

// Error handling - contains exports from zkErrorHandler.mjs and zkErrorLogger.mjs
export * from './error-handling/index.js';

// Core ZK modules - contains exports from zkUtils.mjs, zkCircuitRegistry.mjs, and zkCircuitInputs.mjs
export * from './zk-core/index.js';

// ZK implementation
export * from './zk/index.js';

// System utilities - contains exports from memoryManager.mjs, secureStorage.mjs, and SecureKeyManager.js
export * from './system/index.js';

// Configuration - contains exports from real-zk-config.js, constants.js, and lib-constants.js
export * from './config/index.js';

// Utilities - contains exports from ethersUtils.js, walletHelpers.js, wallet.js
export * from './utils/index.js';

// Resources - contains resource management modules
export * from './resources/index.js';

// Phantom wallet context
export * from './PhantomMultiWalletContext.js';