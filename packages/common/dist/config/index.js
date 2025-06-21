/**
 * Configuration Module - Package Index
 *
 * Exports all configuration constants and values from the config package
 */
// Export configuration for real ZK implementation
export * from './real-zk-config.js';
export { default as zkConfig } from './real-zk-config.js';
// Export MJS version of ZK config
export * from './real-zk-config.mjs';
export { default as zkConfigMjs } from './real-zk-config.mjs';
// Export application constants
export * from './constants.js';
// Export library constants (renamed to avoid conflicts)
export * as libConstants from './lib-constants.js';
