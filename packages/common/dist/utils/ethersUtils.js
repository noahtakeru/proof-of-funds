/**
 * Ethers.js Utility Module
 * 
 * Provides centralized access to the ethers.js library with proper dynamic imports
 * to avoid Next.js SSR issues. Uses a singleton pattern to prevent multiple imports.
 */

// This pattern allows both ESM and CommonJS to work without conditional exports
// that would cause syntax errors in bundlers

// Singleton instance of ethers
let ethersInstance = null;

/**
 * Gets the ethers.js library instance, loading it if not already loaded
 * @returns {Promise<object>} The ethers.js library
 */
const getEthers = async () => {
    if (!ethersInstance) {
        try {
            // Try dynamic import (ESM style)
            if (typeof require === 'undefined') {
                const ethers = await import('ethers');
                ethersInstance = { ethers };
            } else {
                // CommonJS style
                ethersInstance = { ethers: require('ethers') };
            }
        } catch (error) {
            console.error('Failed to load ethers.js library:', error);
            throw new Error('Failed to load ethers.js library. This functionality requires ethers.js to be installed.');
        }
    }
    return ethersInstance;
};

/**
 * Validates if a string is a valid numeric amount
 * Checks if the string is not empty, not null, and can be parsed as a number
 * 
 * @param {string} amount - The amount string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidAmount = (amount) => {
    if (!amount || amount.trim() === '') return false;

    // Try to parse as number
    const num = Number(amount);
    if (isNaN(num)) return false;

    // Ensure it's positive
    if (num < 0) return false;

    return true;
};

/**
 * Parses a decimal amount string to BigNumber wei representation
 * Handles empty or invalid inputs gracefully
 * 
 * @param {string} amount - The amount as a decimal string (e.g. "10.5")
 * @param {number} decimals - Number of decimals to use (default: 18 for ETH)
 * @returns {Promise<string>} - The amount in wei as a string
 */
const parseAmount = async (amount, decimals = 18) => {
    try {
        const { ethers } = await getEthers();

        // Handle empty or invalid inputs
        if (!isValidAmount(amount)) {
            console.warn(`Invalid amount provided: "${amount}". Using 0 as fallback.`);
            return '0';
        }

        // Parse the amount using ethers utils
        return ethers.utils.parseUnits(amount, decimals).toString();
    } catch (error) {
        console.error('Error parsing amount:', error);
        throw new Error(`Failed to parse amount: ${error.message}`);
    }
};

// Define the exports object
const ethersUtils = {
    getEthers,
    isValidAmount,
    parseAmount
};

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ethersUtils;
}

// For ESM environments
export default ethersUtils;

// Named exports
export {
  getEthers,
  isValidAmount,
  parseAmount
};