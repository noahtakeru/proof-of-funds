/**
 * Reference ID Utilities
 * 
 * This module provides functions for working with reference IDs, including:
 * - Generating unique reference IDs based on wallet address and proof type
 * - Formatting reference IDs for display and sharing
 * - Validating reference ID format
 */

const crypto = require('crypto');

/**
 * Generate a unique reference ID based on wallet address and proof type
 * 
 * @param {string} walletAddress - The wallet address
 * @param {string} proofType - The type of proof
 * @returns {string} A unique 8-character reference ID
 */
function generateReferenceId(walletAddress, proofType) {
    // Use crypto module for secure random bytes in Node.js
    if (typeof crypto !== 'undefined' && crypto.createHash) {
        // Create a hash using the wallet address, proof type, and current timestamp
        const hash = crypto.createHash('sha256')
            .update(`${walletAddress}-${proofType}-${Date.now()}`)
            .digest('hex');

        // Return the first 8 characters of the hash (uppercase)
        return hash.slice(0, 8).toUpperCase();
    }

    // Fallback for client-side where crypto might not be available
    const timestamp = Date.now().toString();
    const addressPart = walletAddress.slice(2, 10);
    const typePart = proofType.slice(0, 4);

    // Create a simple hash by combining parts
    let hash = '';
    for (let i = 0; i < 8; i++) {
        // Mix characters from timestamp, address, and type
        const charCode = (timestamp.charCodeAt(i % timestamp.length) +
            addressPart.charCodeAt(i % addressPart.length) +
            typePart.charCodeAt(i % typePart.length)) % 26;

        // Convert to uppercase letter (A-Z)
        hash += String.fromCharCode(65 + charCode);
    }

    return hash;
}

/**
 * Format a reference ID with hyphens for better readability
 * 
 * @param {string} referenceId - The reference ID to format
 * @returns {string} The formatted reference ID (e.g., ABCD-1234)
 */
function formatReferenceId(referenceId) {
    // Remove any existing hyphens and convert to uppercase
    const cleanId = referenceId.replace(/-/g, '').toUpperCase();

    // If the ID is exactly 8 characters, add a hyphen in the middle
    if (cleanId.length === 8) {
        return `${cleanId.slice(0, 4)}-${cleanId.slice(4)}`;
    }

    // Otherwise, return the original ID (but cleaned)
    return cleanId;
}

/**
 * Validate a reference ID format
 * 
 * @param {string} referenceId - The reference ID to validate
 * @returns {boolean} True if the reference ID is valid, false otherwise
 */
function validateReferenceId(referenceId) {
    // Remove hyphens and convert to uppercase
    const cleanId = referenceId.replace(/-/g, '').toUpperCase();

    // Check if the reference ID is exactly 8 characters
    if (cleanId.length !== 8) {
        return false;
    }

    // Check if all characters are alphanumeric
    const alphanumericRegex = /^[A-Z0-9]+$/;
    return alphanumericRegex.test(cleanId);
}

/**
 * Parse a reference ID from a formatted string
 * 
 * @param {string} formattedId - The formatted reference ID (e.g., ABCD-1234)
 * @returns {string} The parsed reference ID (e.g., ABCD1234)
 */
function parseReferenceId(formattedId) {
    return formattedId.replace(/-/g, '').toUpperCase();
}

/**
 * Check if a reference ID exists in the database
 * 
 * @param {string} referenceId - The reference ID to check
 * @returns {Promise<boolean>} True if the reference ID exists, false otherwise
 */
async function referenceIdExists(referenceId) {
    // In a real implementation, this would check a database
    // For now, we'll mock it with some hardcoded values
    const mockExistingIds = ['ABCD1234', 'EFGH5678', 'IJKL9012'];

    // Clean the reference ID for comparison
    const cleanId = referenceId.replace(/-/g, '').toUpperCase();

    // Simulate an async database check
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(mockExistingIds.includes(cleanId));
        }, 300);
    });
}

module.exports = {
    generateReferenceId,
    formatReferenceId,
    validateReferenceId,
    parseReferenceId,
    referenceIdExists
};