/**
 * ZK Recovery System
 * 
 * This module provides sophisticated recovery mechanisms for handling failures
 * during ZK operations, including retries, checkpointing, and partial completion handling.
 * 
 * Key features:
 * - Exponential backoff with jitter for retries
 * - Operation-specific retry policies
 * - Partial completion handling for batch operations
 * - Checkpointing for long-running operations
 * - Resumable proof generation
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as a safety net for the entire proof system. It's like having multiple backup
 * systems for a critical operation:
 * 
 * 1. When something fails, it tries again with smart timing (like waiting a bit longer
 *    between each attempt).
 * 2. It saves progress checkpoints so operations can resume exactly where they left off
 *    if interrupted (like saving your game progress).
 * 3. It handles processing multiple items, ensuring that if one item fails, the others 
 *    can still succeed (like a package delivery system that doesn't stop if one package
 *    has an issue).
 * 
 * This provides a more robust user experience with fewer complete failures and
 * allows large operations to recover from temporary issues without starting over.
 */

// Re-export from the appropriate module version based on the environment
// This file acts as a universal entry point that routes to either ESM or CommonJS
let zkRecoverySystem;

// In a browser environment with ES modules or when using import syntax
if (typeof module === 'undefined' || 
    (typeof module !== 'undefined' && module.exports === undefined)) {
  // Use dynamic import() for ESM environments
  // This will be handled by bundlers properly in most cases
  import('./zkRecoverySystem.mjs').then(module => {
    zkRecoverySystem = module.default;
  });
} else {
  // In CommonJS environment (Node.js, older bundlers)
  zkRecoverySystem = require('./zkRecoverySystem.cjs');
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = zkRecoverySystem;
}

// Export for ESM
export default zkRecoverySystem;