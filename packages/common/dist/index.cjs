/**
 * Main entry point for the Proof of Funds common package
 * This file exports all modules from the common package.
 * 
 * @module common
 */

// Error handling - contains exports from zkErrorHandler.mjs and zkErrorLogger.mjs
Object.assign(exports, require('./error-handling/index.js.cjs'));

// Core ZK modules - contains exports from zkUtils.mjs, zkCircuitRegistry.mjs, and zkCircuitInputs.mjs
Object.assign(exports, require('./zk-core/index.js.cjs'));

// System utilities - contains exports from memoryManager.mjs, secureStorage.mjs, and SecureKeyManager.js
Object.assign(exports, require('./system/index.js.cjs'));

// Configuration - contains exports from real-zk-config.js, constants.js, and lib-constants.js
Object.assign(exports, require('./config/index.js.cjs'));

// Utilities - contains exports from ethersUtils.js
Object.assign(exports, require('./utils/index.js.cjs'));

// Resources - contains resource management modules
Object.assign(exports, require('./resources/index.js.cjs'));

// Utilities - contains exports from ethersUtils.js
Object.assign(exports, require('./utils/index.js.cjs'));