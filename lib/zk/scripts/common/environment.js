/**
 * Environment detection utilities for ZK Fix Script
 * Provides functions to detect environment details like module format, Node version, etc.
 */

/**
 * Detects if the current environment is using ESM or CommonJS
 * @returns {boolean} True if ESM, false if CommonJS
 */
export function isESM() {
    return typeof import.meta === 'object';
}

/**
 * Gets the current Node.js version
 * @returns {string} Node.js version
 */
export function getNodeVersion() {
    return process.version;
}

/**
 * Checks if the Node.js version meets the minimum requirement
 * @param {string} minVersion - Minimum version required (e.g., '14.0.0')
 * @returns {boolean} True if current version meets or exceeds minimum
 */
export function checkNodeVersion(minVersion) {
    const current = process.version.slice(1); // Remove 'v' prefix
    const minimum = minVersion.startsWith('v') ? minVersion.slice(1) : minVersion;

    const currentParts = current.split('.').map(Number);
    const minParts = minimum.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const currentPart = currentParts[i] || 0;
        const minPart = minParts[i] || 0;

        if (currentPart > minPart) return true;
        if (currentPart < minPart) return false;
    }

    return true; // Versions are equal
}

/**
 * Get information about the current environment
 * @returns {Object} Environment information object
 */
export function getEnvironmentInfo() {
    return {
        nodeVersion: getNodeVersion(),
        esm: isESM(),
        platform: process.platform,
        arch: process.arch
    };
}

// Default export for convenience
export default {
    isESM,
    getNodeVersion,
    checkNodeVersion,
    getEnvironmentInfo
}; 