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
 * This function works with both ethers v5 and v6
 * @returns {Promise<object>} The ethers.js library
 */
const getEthers = async () => {
    if (!ethersInstance) {
        try {
            let ethers;
            
            // Try dynamic import (ESM style)
            if (typeof require === 'undefined') {

                ethers = await import('ethers');
                
                // Handle ESM differences between v5 and v6
                // In v6, the default export is the ethers object
                // In v5, we need to use the named exports
                if (ethers.default && typeof ethers.default === 'object') {
                    ethers = ethers.default;
                }
            } else {
                // CommonJS style

                ethers = require('ethers');
            }
            
            // Determine if it's v5 or v6
            const isV5 = !!ethers.utils;
            const isV6 = !ethers.utils && !!ethers.parseUnits;
            
            // Create a consistent interface regardless of version
            ethersInstance = { 
                ethers,
                version: ethers.version || 'unknown',
                isV5,
                isV6
            };

        } catch (error) {
            console.error('Failed to load ethers.js library:', error);
            throw new Error(`Failed to load ethers.js library: ${error.message}`);
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
 * Works with both ethers v5 and v6
 * 
 * @param {string} amount - The amount as a decimal string (e.g. "10.5")
 * @param {number} decimals - Number of decimals to use (default: 18 for ETH)
 * @returns {Promise<string>} - The amount in wei as a string
 */
const parseAmount = async (amount, decimals = 18) => {
    try {
        // Handle empty or invalid inputs with clear error messages
        if (!amount) {
            console.warn('No amount provided. Using 0 as fallback.');
            return '0';
        }
        
        // Ensure amount is a string
        const amountStr = String(amount).trim();
        
        if (!isValidAmount(amountStr)) {
            console.warn(`Invalid amount provided: "${amountStr}". Using 0 as fallback.`);
            return '0';
        }
        
        // Get ethers instance with version detection
        const ethersData = await getEthers();
        
        if (!ethersData || !ethersData.ethers) {
            throw new Error('Failed to initialize ethers library');
        }
        
        const { ethers, isV5, isV6 } = ethersData;

        // Create a unified parse function that works with both v5 and v6
        let parsedValue;
        
        // Handle ethers v5
        if (isV5 && ethers.utils && typeof ethers.utils.parseUnits === 'function') {

            parsedValue = ethers.utils.parseUnits(amountStr, decimals);
        } 
        // Handle ethers v6
        else if (isV6 && typeof ethers.parseUnits === 'function') {

            parsedValue = ethers.parseUnits(amountStr, decimals);
        }
        // Fallback implementation if standard methods are not available
        else {
            console.warn('Could not find native parseUnits, using fallback implementation');
            
            // Implement our own parseUnits as a real fallback (not a placeholder)
            const decimalSplit = amountStr.split('.');
            const wholePart = decimalSplit[0] || '0';
            let fractionalPart = decimalSplit[1] || '';
            
            // Pad or truncate the fractional part to match decimals
            if (fractionalPart.length > decimals) {
                fractionalPart = fractionalPart.substring(0, decimals);
            } else {
                fractionalPart = fractionalPart.padEnd(decimals, '0');
            }
            
            // Combine to create the full amount in smallest units
            const fullValue = wholePart + fractionalPart;
            
            // Remove leading zeros
            const trimmedValue = fullValue.replace(/^0+/, '') || '0';
            
            return trimmedValue;
        }
        
        // Return the result as a string (works for both BigNumber from v5 and bigint from v6)
        return parsedValue.toString();
    } catch (error) {
        // Detailed error with context for debugging
        console.error('Error parsing amount:', error);
        
        // Check if we have specific error information that would help diagnostics
        let errorDetails = '';
        
        if (error.code) {
            errorDetails += ` (Code: ${error.code})`;
        }
        
        if (error.reason) {
            errorDetails += ` Reason: ${error.reason}`;
        }
        
        throw new Error(`Failed to parse amount: ${error.message}${errorDetails}`);
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