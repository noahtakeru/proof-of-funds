/**
 * @fileoverview Error logging adapter
 * 
 * Provides backward compatibility with existing error logging code
 * while implementing the new structured logger functionality.
 * 
 * @author ZK Infrastructure Team
 * @created August 2024
 */

import { logger } from './security/zkErrorLogger.mjs';
import { ZKError, handleError } from './security/zkErrorHandler.mjs';

/**
 * Legacy error logger compatible with existing code
 * @param {string|Error} messageOrError - Message or error to log
 * @param {Object} [metadata={}] - Additional metadata to include in log
 * @param {boolean} [isFatal=false] - Whether this is a fatal error
 * @returns {void}
 */
function logError(messageOrError, metadata = {}, isFatal = false) {
    if (isFatal) {
        logger.fatal(messageOrError, metadata);
    } else {
        logger.error(messageOrError, metadata);
    }
}

/**
 * Logs a warning message
 * @param {string} message - Warning message to log
 * @param {Object} [metadata={}] - Additional metadata to include in log
 * @returns {void}
 */
function logWarning(message, metadata = {}) {
    logger.warn(message, metadata);
}

/**
 * Logs an informational message
 * @param {string} message - Info message to log
 * @param {Object} [metadata={}] - Additional metadata to include in log
 * @returns {void}
 */
function logInfo(message, metadata = {}) {
    logger.info(message, metadata);
}

/**
 * Logs a debug message
 * @param {string} message - Debug message to log
 * @param {Object} [metadata={}] - Additional metadata to include in log
 * @returns {void}
 */
function logDebug(message, metadata = {}) {
    logger.debug(message, metadata);
}

// Export all the functions and logger instance
export {
    logger,
    logError,
    logWarning,
    logInfo,
    logDebug,
    handleError
};

// Export default object with all exports
export default {
    logger,
    logError,
    logWarning,
    logInfo,
    logDebug,
    handleError
}; 