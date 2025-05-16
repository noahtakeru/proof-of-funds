/**
 * File System Compatibility Layer
 * 
 * This module provides a compatibility layer for file system operations
 * that works in both browser and Node.js environments.
 */

// Constants for file system operations - needed for browser compatibility
const constants = {
  O_TRUNC: 512,  // Value from fs.constants.O_TRUNC
  O_CREAT: 64,   // Value from fs.constants.O_CREAT
  O_RDWR: 2,     // Value from fs.constants.O_RDWR
  O_EXCL: 128,   // Value from fs.constants.O_EXCL
  O_RDONLY: 0    // Value from fs.constants.O_RDONLY
};

/**
 * Check if running in a browser environment
 * @returns {boolean} - Whether we're in a browser
 */
function isBrowser() {
  return typeof window !== 'undefined';
}

/**
 * Get real fs module in Node.js or a compatible interface in browser
 * @returns {Object} - FS-like interface
 */
function getFS() {
  if (!isBrowser()) {
    // In Node.js, use the real fs module
    return require('fs');
  } else {
    // In browser, return a compatible interface
    return {
      constants,
      readFileSync: () => {
        throw new Error('readFileSync is not available in browser environment');
      },
      writeFileSync: () => {
        throw new Error('writeFileSync is not available in browser environment');
      },
      existsSync: () => false,
      statSync: () => ({
        size: 0,
        isFile: () => false,
        isDirectory: () => false
      })
    };
  }
}

/**
 * Safely check if a file exists, works in both browser and Node.js
 * @param {string} path - File path to check
 * @returns {boolean} - Whether the file exists
 */
function fileExists(path) {
  if (isBrowser()) return false;
  return getFS().existsSync(path);
}

/**
 * Get file size, works in Node.js only
 * @param {string} path - File path
 * @returns {number} - File size in bytes, or 0 in browser
 */
function getFileSize(path) {
  if (isBrowser()) return 0;
  try {
    const stats = getFS().statSync(path);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Read a file synchronously, works in Node.js only
 * @param {string} path - File path
 * @returns {Buffer|null} - File content or null in browser
 */
function readFileSafe(path) {
  if (isBrowser()) return null;
  try {
    return getFS().readFileSync(path);
  } catch (error) {
    return null;
  }
}

// Export the compatibility layer
export default {
  constants,
  isBrowser,
  fileExists,
  getFileSize,
  readFileSafe,
  getFS
};

// Also export individual functions and constants for direct import
export {
  constants,
  isBrowser,
  fileExists,
  getFileSize,
  readFileSafe,
  getFS
};