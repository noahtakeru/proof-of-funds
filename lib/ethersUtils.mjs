/**
 * Ethers.js Utility Module (ESM Version)
 * 
 * Provides centralized access to the ethers.js library with proper dynamic imports
 * to avoid Next.js SSR issues. Uses a singleton pattern to prevent multiple imports.
 */

// Singleton instance of ethers
let ethersInstance = null;

/**
 * Gets the ethers.js library instance, loading it if not already loaded
 * @returns {Promise<object>} The ethers.js library
 */
export const getEthers = async () => {
    if (!ethersInstance) {
        console.log('Dynamically importing ethers.js');
        // For ESM, use dynamic import
        ethersInstance = await import('ethers');
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
export const isValidAmount = (amount) => {
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
export const parseAmount = async (amount, decimals = 18) => {
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

// Default export for compatibility
export default {
    getEthers,
    isValidAmount,
    parseAmount
};