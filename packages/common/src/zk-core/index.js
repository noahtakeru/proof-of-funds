/**
 * ZK Core Module
 * 
 * This is the main entry point for ZK functionality.
 * It exports all the necessary components for ZK operations.
 */

// Re-export the snarkjs wrapper
export { default as snarkjs } from './snarkjsWrapper';

// Export individual functions from the wrapper for easier access
export { fullProve, verify, getFileConstants, FILE_CONSTANTS } from './snarkjsWrapper';