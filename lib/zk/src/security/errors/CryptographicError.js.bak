/**
 * @fileoverview CryptographicError class for cryptographic-specific errors
 * 
 * This module provides a specialized error class for cryptographic
 * operations in ZK proof systems.
 */

/**
 * Custom error class for cryptographic-related errors
 * @extends Error
 */
export class CryptographicError extends Error {
    /**
     * Create a new CryptographicError
     * 
     * @param {string} message - Error message
     * @param {Object} [metadata={}] - Additional metadata about the error
     */
    constructor(message, metadata = {}) {
        super(message);
        this.name = 'CryptographicError';
        this.metadata = metadata;
        this.timestamp = new Date();

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CryptographicError);
        }
    }

    /**
     * Convert the error to a JSON representation
     * 
     * @returns {Object} - JSON representation of the error
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            metadata: this.metadata,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack
        };
    }

    /**
     * Get a formatted string representation of the error
     * 
     * @returns {string} - Formatted error message
     */
    toString() {
        return `${this.name}: ${this.message}`;
    }
}

export default CryptographicError; 