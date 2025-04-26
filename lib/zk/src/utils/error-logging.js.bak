/**
 * Error Logging Utility
 * 
 * This module re-exports the zkErrorLogger to be used across the application
 * in a consistent way. It provides a simple and unified interface for error logging.
 */

import { zkErrorLogger } from '../zkErrorLogger.js';

/**
 * Log an error with context information
 * 
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context information
 * @returns {string} The operation ID for tracking
 */
export function logError(error, context = {}) {
    return zkErrorLogger.logError(error, context);
}

/**
 * Log an informational message
 * 
 * @param {string} message - The message to log
 * @param {Object} data - Additional data to include in the log
 * @returns {string} The operation ID for tracking
 */
export function logInfo(message, data = {}) {
    return zkErrorLogger.info(message, data);
}

/**
 * Log a warning message
 * 
 * @param {string} message - The message to log
 * @param {Object} data - Additional data to include in the log
 * @returns {string} The operation ID for tracking
 */
export function logWarning(message, data = {}) {
    return zkErrorLogger.warn(message, data);
}

/**
 * Log a debug message
 * 
 * @param {string} message - The message to log
 * @param {Object} data - Additional data to include in the log
 * @returns {string} The operation ID for tracking
 */
export function logDebug(message, data = {}) {
    return zkErrorLogger.debug(message, data);
}

/**
 * Log a critical error message
 * 
 * @param {string} message - The message to log
 * @param {Object} data - Additional data to include in the log
 * @returns {string} The operation ID for tracking
 */
export function logCritical(message, data = {}) {
    return zkErrorLogger.critical(message, data);
}

/**
 * The zkErrorLogger singleton instance.
 * Provides advanced error logging capabilities and direct access
 * to all logging methods for more complex logging scenarios.
 * 
 * @type {import('../zkErrorLogger.js').ZKErrorLogger}
 */
export const logger = zkErrorLogger;

/**
 * Default export for the error logging utilities.
 * Provides all logging functions as a single object for convenient default imports.
 * 
 * @type {Object}
 * @property {Function} logError - Log an error with context information
 * @property {Function} logInfo - Log an informational message
 * @property {Function} logWarning - Log a warning message
 * @property {Function} logDebug - Log a debug message
 * @property {Function} logCritical - Log a critical error message
 * @property {Object} logger - The zkErrorLogger instance for advanced usage
 */
export default {
    logError,
    logInfo,
    logWarning,
    logDebug,
    logCritical,
    logger
}; 