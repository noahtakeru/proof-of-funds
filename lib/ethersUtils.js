/**
 * Ethers.js Utility Module
 * 
 * Provides centralized access to the ethers.js library with proper dynamic imports
 * to avoid Next.js SSR issues. This module includes various utility functions for
 * working with Ethereum transactions, amounts, and blockchain interactions.
 * 
 * Key features:
 * - Singleton pattern for ethers.js library access
 * - Dynamic imports for SSR compatibility
 * - Amount validation and parsing utilities
 * - Conversion between decimal amounts and wei values
 * 
 * This module helps prevent common errors when working with blockchain values like:
 * - Proper decimal handling for token amounts
 * - Avoiding multiple imports of ethers.js
 * - Dealing with Next.js SSR rendering challenges
 * 
 * @module ethersUtils
 * @see https://docs.ethers.org/v5/ - Official ethers.js documentation
 * @see lib/walletHelpers.js - Related wallet connection utilities
 */

// Singleton instance of ethers
let ethersInstance = null;

/**
 * Gets the ethers.js library instance, loading it if not already loaded
 * Uses a singleton pattern to prevent multiple imports of the library.
 * 
 * @returns {Promise<object>} The ethers.js library
 * 
 * @example
 * // Import ethers library dynamically
 * const { ethers } = await getEthers();
 * 
 * // Use ethers utilities
 * const wei = ethers.utils.parseEther('1.0');
 */
export const getEthers = async () => {
    if (!ethersInstance) {
        console.log('Dynamically importing ethers.js');
        ethersInstance = await import('ethers');
    }
    return ethersInstance;
};

/**
 * Validates if a string is a valid numeric amount
 * Checks if the string is not empty, not null, and can be parsed as a positive number.
 * This function is used to validate user input before processing blockchain transactions.
 * 
 * @param {string} amount - The amount string to validate
 * @returns {boolean} - True if valid, false otherwise
 * 
 * @example
 * // Valid inputs
 * isValidAmount('10.5'); // true
 * isValidAmount('0.01'); // true
 * 
 * // Invalid inputs
 * isValidAmount(''); // false
 * isValidAmount('abc'); // false
 * isValidAmount('-1'); // false
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
 * Handles empty or invalid inputs by providing appropriate fallbacks.
 * This is essential for converting human-readable amounts to blockchain-compatible values.
 * 
 * @param {string} amount - The amount as a decimal string (e.g. "10.5")
 * @param {number} decimals - Number of decimals to use (default: 18 for ETH)
 * @returns {Promise<string>} - The amount in wei as a string
 * @throws {Error} If the conversion fails for any reason other than invalid input
 * 
 * @example
 * // Converting ETH to wei
 * const weiAmount = await parseAmount('1.5'); // '1500000000000000000'
 * 
 * // Converting token amount with different decimals (USDC uses 6 decimals)
 * const usdcAmount = await parseAmount('100', 6); // '100000000'
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