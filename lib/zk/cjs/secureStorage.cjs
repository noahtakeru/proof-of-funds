/**
 * Secure Storage Module (CommonJS Version)
 * 
 * This module provides secure storage functionality for sensitive data
 * used in ZK operations.
 */

// In-memory storage for development/testing
const memoryStore = new Map();

/**
 * Store a value securely
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @param {Object} options - Storage options
 * @returns {Promise<boolean>} - Success indicator
 */
async function storeSecurely(key, value, options = {}) {
  try {
    // For simplicity in this compatibility layer, just use in-memory storage
    memoryStore.set(key, {
      value: JSON.stringify(value),
      timestamp: Date.now(),
      options
    });
    return true;
  } catch (error) {
    console.error('Store error:', error);
    return false;
  }
}

/**
 * Retrieve a value from secure storage
 * @param {string} key - Storage key
 * @returns {Promise<any>} - Retrieved value
 */
async function retrieveSecurely(key) {
  try {
    const entry = memoryStore.get(key);
    if (!entry) {
      throw new Error(`Item not found: ${key}`);
    }
    return JSON.parse(entry.value);
  } catch (error) {
    console.error('Retrieve error:', error);
    throw error;
  }
}

/**
 * Delete a value from secure storage
 * @param {string} key - Storage key
 * @returns {Promise<boolean>} - Success indicator
 */
async function deleteSecurely(key) {
  try {
    memoryStore.delete(key);
    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}

/**
 * Check if a key exists in secure storage
 * @param {string} key - Storage key
 * @returns {Promise<boolean>} - Existence indicator
 */
async function hasSecurely(key) {
  return memoryStore.has(key);
}

// Export the module
module.exports = {
  storeSecurely,
  retrieveSecurely,
  deleteSecurely,
  hasSecurely
};