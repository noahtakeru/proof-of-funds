/**
 * Ethers.js Utility Module
 * 
 * Provides centralized access to the ethers.js library with proper dynamic imports
 * to avoid Next.js SSR issues. Uses a singleton pattern to prevent multiple imports.
 * 
 * Enhanced with robust version detection and compatibility layer between ethers.js v5 and v6.
 */

// Singleton instance of ethers
let ethersInstance = null;

/**
 * Gets the ethers.js library instance, loading it if not already loaded.
 * Enhanced with better version detection and compatibility information.
 * 
 * @returns {Promise<object>} The ethers.js library with version info
 */
export const getEthers = async () => {
    if (!ethersInstance) {
        try {
            // Attempt to dynamically import ethers
            let ethers;
            try {
                // Try dynamic import (ESM style)
                if (typeof require === 'undefined') {
                    console.log('Using ESM dynamic import for ethers');
                    ethers = await import('ethers');
                    // Handle both ESM and CommonJS imports
                    ethers = ethers.default || ethers;
                } else {
                    // CommonJS style
                    console.log('Using CommonJS require for ethers');
                    ethers = require('ethers');
                }
            } catch (error) {
                console.warn('Failed to import ethers directly:', error.message);
                // Second attempt with different approach if the first failed
                try {
                    console.log('Attempting alternative ethers import method');
                    if (typeof window !== 'undefined' && window.ethers) {
                        ethers = window.ethers;
                        console.log('Using window.ethers');
                    } else {
                        throw new Error('No fallback ethers source available');
                    }
                } catch (e) {
                    console.error('Could not load ethers via any method:', e.message);
                    throw new Error('Failed to load ethers.js library by any method');
                }
            }
            
            // Detect ethers version and create normalized interface
            const version = ethers.version || (ethers.utils ? '5.x' : '6.x');
            const isV5 = !!ethers.utils;
            const isV6 = !ethers.utils && !!ethers.parseUnits;
            
            console.log(`Detected ethers.js version: ${version}`);
            console.log('Ethers library features:', {
                hasProviders: !!ethers.providers,
                hasWeb3Provider: !!(ethers.providers && ethers.providers.Web3Provider),
                hasBrowserProvider: !!ethers.BrowserProvider,
                hasUtils: !!ethers.utils,
                hasParseUnits: isV5 ? !!ethers.utils.parseUnits : !!ethers.parseUnits,
                hasFormatUnits: isV5 ? !!ethers.utils.formatUnits : !!ethers.formatUnits
            });
            
            // Store with version info for better compatibility
            ethersInstance = {
                ethers,
                version,
                isV5,
                isV6
            };
        } catch (error) {
            console.error('Error in getEthers:', error);
            throw new Error(`Failed to initialize ethers.js: ${error.message}`);
        }
    }
    return ethersInstance;
};

/**
 * Validates if a string is a valid numeric amount
 * Checks if the string is not empty, not null, and can be parsed as a number
 * 
 * @param {string|number} amount - The amount to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidAmount = (amount) => {
    if (amount === undefined || amount === null || amount === '') {
        return false;
    }
    
    // Convert to string and trim
    const stringAmount = String(amount).trim();
    
    // Check for valid number format with optional decimal
    return /^[0-9]+\.?[0-9]*$/.test(stringAmount);
};

/**
 * Version-agnostic parseUnits function that works with both ethers v5 and v6
 * 
 * @param {string|number} value - The value to parse
 * @param {number} decimals - Number of decimals to use
 * @returns {Promise<string>} - The parsed units as a string
 */
export const parseUnits = async (value, decimals = 18) => {
    try {
        const { ethers, isV5, isV6 } = await getEthers();
        
        // Handle different ethers versions
        if (isV5 && ethers.utils && ethers.utils.parseUnits) {
            return ethers.utils.parseUnits(String(value), decimals);
        } else if (isV6 && ethers.parseUnits) {
            return ethers.parseUnits(String(value), decimals);
        } else {
            // Fallback implementation if ethers functions are not available
            return fallbackParseUnits(String(value), decimals);
        }
    } catch (error) {
        console.error('Error in parseUnits:', error);
        // Use fallback in case of any error
        return fallbackParseUnits(String(value), decimals);
    }
};

/**
 * Version-agnostic parseEther function that works with both ethers v5 and v6
 * This is a convenience function equivalent to parseUnits(value, 18)
 * 
 * @param {string|number} value - The value in ether to parse to wei
 * @returns {Promise<string>} - The parsed wei amount as a string
 */
export const parseEther = async (value) => {
    try {
        const { ethers, isV5, isV6 } = await getEthers();
        
        // Handle different ethers versions
        if (isV5 && ethers.utils && ethers.utils.parseEther) {
            return ethers.utils.parseEther(String(value));
        } else if (isV6 && ethers.parseEther) {
            return ethers.parseEther(String(value));
        } else {
            // Fallback to parseUnits with 18 decimals (ether)
            return parseUnits(String(value), 18);
        }
    } catch (error) {
        console.error('Error in parseEther:', error);
        // Use fallback in case of any error
        return fallbackParseUnits(String(value), 18);
    }
};

/**
 * Version-agnostic formatUnits function that works with both ethers v5 and v6
 * 
 * @param {string|number} value - The value to format
 * @param {number} decimals - Number of decimals to use
 * @returns {Promise<string>} - The formatted value as a string
 */
export const formatUnits = async (value, decimals = 18) => {
    try {
        const { ethers, isV5, isV6 } = await getEthers();
        
        // Handle different ethers versions
        if (isV5 && ethers.utils && ethers.utils.formatUnits) {
            return ethers.utils.formatUnits(value, decimals);
        } else if (isV6 && ethers.formatUnits) {
            return ethers.formatUnits(value, decimals);
        } else {
            // Fallback implementation if ethers functions are not available
            return fallbackFormatUnits(value, decimals);
        }
    } catch (error) {
        console.error('Error in formatUnits:', error);
        // Use fallback in case of any error
        return fallbackFormatUnits(value, decimals);
    }
};

/**
 * Fallback implementation of parseUnits that doesn't depend on ethers.js
 * Used when ethers.js is not available or throws an error
 * 
 * @param {string} value - The value to parse
 * @param {number} decimals - Number of decimals to use
 * @returns {string} - The parsed amount as a string
 */
export const fallbackParseUnits = (value, decimals = 18) => {
    if (!value) return '0';
    
    // Remove extra spaces and ensure it's a string
    const stringValue = String(value).trim();
    
    // Check if the value is valid
    if (!/^[0-9]+\.?[0-9]*$/.test(stringValue)) {
        console.warn(`Invalid amount format: "${stringValue}". Using 0 as fallback.`);
        return '0';
    }
    
    // Split into whole and decimal parts
    const parts = stringValue.split('.');
    const wholePart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : '';
    
    // Pad or truncate decimal part as needed
    let paddedDecimal = decimalPart;
    if (paddedDecimal.length > decimals) {
        // Truncate if too long
        paddedDecimal = paddedDecimal.substring(0, decimals);
    } else {
        // Pad with zeros if too short
        paddedDecimal = paddedDecimal.padEnd(decimals, '0');
    }
    
    // Remove any leading zeros from whole part
    const normalizedWhole = wholePart.replace(/^0+/, '') || '0';
    
    // Combine whole part with padded decimal
    const result = normalizedWhole + paddedDecimal;
    
    // Remove leading zeros
    return result.replace(/^0+/, '') || '0';
};

/**
 * Fallback implementation of formatUnits that doesn't depend on ethers.js
 * Used when ethers.js is not available or throws an error
 * 
 * @param {string} value - The value to format
 * @param {number} decimals - Number of decimals to use
 * @returns {string} - The formatted amount as a string
 */
export const fallbackFormatUnits = (value, decimals = 18) => {
    if (!value) return '0';
    
    // Ensure value is a string and remove any non-numeric characters
    const stringValue = String(value).replace(/[^0-9]/g, '');
    
    // If empty after cleaning, return 0
    if (stringValue === '') return '0';
    
    // Pad the string with leading zeros if needed
    const paddedValue = stringValue.padStart(decimals + 1, '0');
    
    // Split the string at the decimal point position
    const insertIndex = paddedValue.length - decimals;
    const wholePart = paddedValue.substring(0, insertIndex).replace(/^0+/, '') || '0';
    const decimalPart = paddedValue.substring(insertIndex).replace(/0+$/, '');
    
    // Format the result
    return decimalPart ? `${wholePart}.${decimalPart}` : wholePart;
};

/**
 * Enhanced parseAmount function with better error handling and version compatibility
 * 
 * @param {string|number} amount - The amount as a decimal string (e.g. "10.5")
 * @param {number} decimals - Number of decimals to use (default: 18 for ETH)
 * @returns {Promise<string>} - The amount in wei as a string
 */
export const parseAmount = async (amount, decimals = 18) => {
    try {
        // Handle empty or invalid inputs with clear logging
        if (!isValidAmount(amount)) {
            console.warn(`Invalid amount provided: "${amount}". Using 0 as fallback.`);
            return '0';
        }
        
        // Convert amount to string and clean it
        const stringAmount = String(amount).trim();
        
        // Use version-agnostic parseUnits function
        const parsedUnits = await parseUnits(stringAmount, decimals);
        return parsedUnits.toString();
    } catch (error) {
        console.error('Error parsing amount:', error);
        // Provide detailed error for debugging
        throw new Error(`Failed to parse amount "${amount}": ${error.message}`);
    }
};

// Define and export object with all methods
const ethersUtils = {
    getEthers,
    isValidAmount,
    parseAmount,
    parseUnits,
    parseEther,
    formatUnits,
    fallbackParseUnits,
    fallbackFormatUnits
};

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ethersUtils;
}

// For ESM environments - export both default and named exports
export default ethersUtils;

// Named exports already defined above individually