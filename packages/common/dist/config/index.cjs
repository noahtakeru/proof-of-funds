/**
 * Configuration Module - Package Index
 * 
 * Exports all configuration constants and values from the config package
 */

// Export configuration for real ZK implementation
Object.assign(exports, require('./real-zk-config.js'));
module.exports = { default as zkConfig } from './real-zk-config.js';

// Export MJS version of ZK config
Object.assign(exports, require('./real-zk-config.mjs'));
module.exports = { default as zkConfigMjs } from './real-zk-config.mjs';

// Export application constants
Object.assign(exports, require('./constants.js'));

// Export library constants (renamed to avoid conflicts)
export * as libConstants from './lib-constants.js';