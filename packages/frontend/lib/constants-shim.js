/**
 * Constants shim for Node.js constants module
 * 
 * This provides browser-compatible constants that match the Node.js fs.constants values
 * used by the fastfile module.
 */

// File system constants for browser compatibility
export const O_RDONLY = 0;    // Open file for reading only
export const O_RDWR = 2;      // Open file for reading and writing
export const O_CREAT = 64;    // Create file if it doesn't exist
export const O_EXCL = 128;    // Fail if file already exists
export const O_TRUNC = 512;   // Truncate file to 0 bytes

// Export as both named exports and default export for maximum compatibility
export default {
  O_RDONLY,
  O_RDWR,
  O_CREAT,
  O_EXCL,
  O_TRUNC
};