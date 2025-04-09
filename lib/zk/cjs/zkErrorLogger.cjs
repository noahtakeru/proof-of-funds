/**
 * Zero Knowledge Proof Error Logging System
 * CommonJS version
 */

// Simple implementation for CommonJS compatibility 
const zkErrorLogger = {
  /**
   * Log an error with structured data
   * @param {Error} error - The error to log
   * @param {Object} additionalData - Additional data to include
   * @returns {Object} Logged error data
   */
  logError(error, additionalData = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      additionalData
    };
    
    console.error('[ZK ERROR]', errorData);
    return errorData;
  },
  
  /**
   * Log a message with a specific level
   * @param {string} level - Log level (INFO, WARNING, ERROR, DEBUG)
   * @param {string} message - Message to log
   * @param {Object} data - Additional data to include
   * @returns {Object} Logged data
   */
  log(level, message, data = {}) {
    const logData = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    console.log(`[ZK ${level}]`, message);
    return logData;
  }
};

// CommonJS exports
module.exports = {
  zkErrorLogger
};
