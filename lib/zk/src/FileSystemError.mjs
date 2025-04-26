/**
 * @fileoverview FileSystem Error Class
 * 
 * Specialized error class for file system operations.
 * Extends SystemError to provide consistent error handling for file-related operations.
 */

import { SystemError } from './ErrorSystem.js';

/**
 * Error class for file system-related failures
 * @extends SystemError
 */
export class FileSystemError extends SystemError {
  /**
   * Create a new FileSystemError instance
   * 
   * @param {string} message - Error message
   * @param {Object} [options={}] - Error configuration options
   * @param {Error} [options.cause] - Original error that caused this error
   * @param {string} [options.filePath] - Path to the file that caused the error
   * @param {string} [options.operation] - Operation that was being performed
   */
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      code: options.code || 18100, // Specialized code for file system errors
      context: {
        ...(options.context || {}),
        filePath: options.filePath,
        operation: options.operation
      }
    });
    this.name = 'FileSystemError';
    this.filePath = options.filePath;
    this.operation = options.operation;
  }
}