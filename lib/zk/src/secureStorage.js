/**
 * Re-export file for secureStorage
 * 
 * This file is a compatibility layer that determines whether to use
 * the ESM (.mjs) or CommonJS (.cjs) version of the secureStorage module
 * based on the environment.
 */

// Check if we're in a CommonJS or ESM context
const isCommonJS = typeof module !== 'undefined' && module.exports;

// Export the appropriate module based on the environment
if (isCommonJS) {
  // CommonJS export
  const { secureStorage, STORAGE_PREFIXES, DEFAULT_EXPIRATION } = require('../cjs/secureStorage.cjs');
  module.exports = { secureStorage, STORAGE_PREFIXES, DEFAULT_EXPIRATION };
} else {
  // ESM export - using dynamic import() would be better,
  // but for compatibility with environments that don't support it,
  // we'll use the export statement approach
  export { default, STORAGE_PREFIXES, DEFAULT_EXPIRATION } from './secureStorage.mjs';
}