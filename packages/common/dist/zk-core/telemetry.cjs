/**
 * Telemetry module for ZK operations
 * 
 * This module provides telemetry functionality for tracking ZK operations,
 * including performance metrics and error reporting.
 */

// Configuration state
let telemetryConfig = {
  enabled: false,
  endpoint: null,
  bufferSize: 10,
  flushInterval: 30000, // 30 seconds
  retryAttempts: 3
};

// Buffer to store telemetry events before sending
const eventBuffer = [];
let flushIntervalId = null;

/**
 * Initialize the telemetry system with configuration
 * @param {Object} config - Telemetry configuration
 * @param {boolean} config.enabled - Whether telemetry is enabled
 * @param {string} config.endpoint - The telemetry endpoint URL
 * @param {number} config.bufferSize - Max events to buffer before sending
 * @param {number} config.flushInterval - Interval in ms to flush buffer
 * @param {number} config.retryAttempts - Number of retry attempts for failed sends
 */
function initialize(config = {}) {
  telemetryConfig = { ...telemetryConfig, ...config };
  
  if (telemetryConfig.enabled && telemetryConfig.endpoint) {
    // Set up interval to flush buffer periodically
    if (flushIntervalId) {
      clearInterval(flushIntervalId);
    }
    
    if (typeof window !== 'undefined') {
      // Browser environment
      flushIntervalId = setInterval(flushBuffer, telemetryConfig.flushInterval);
    } else {
      // Node.js environment - use different timer method if needed
      flushIntervalId = setInterval(flushBuffer, telemetryConfig.flushInterval);
    }
    
    return true;
  } else {
    throw new Error('Telemetry initialization failed: telemetry is disabled or endpoint is not configured');
  }
}

/**
 * Flush the event buffer by sending events to the telemetry endpoint
 * @private
 */
async function flushBuffer() {
  if (eventBuffer.length === 0) {
    return;
  }
  
  if (!telemetryConfig.enabled || !telemetryConfig.endpoint) {
    eventBuffer.length = 0; // Clear buffer if telemetry is disabled
    return;
  }
  
  const events = [...eventBuffer];
  eventBuffer.length = 0; // Clear buffer
  
  let retries = 0;
  let success = false;
  
  while (retries < telemetryConfig.retryAttempts && !success) {
    try {
      const response = await fetch(telemetryConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          events,
          timestamp: new Date().toISOString(),
          version: '0.1.0'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }
      
      success = true;
    } catch (error) {
      console.error(`Failed to send telemetry data (attempt ${retries + 1}/${telemetryConfig.retryAttempts}):`, error);
      retries++;
      
      if (retries < telemetryConfig.retryAttempts) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      } else {
        // Give up after max retries - log the failure but don't rethrow
        console.error('Failed to send telemetry data after maximum retry attempts');
      }
    }
  }
}

/**
 * Record a ZK operation with performance metrics
 * @param {Object} operationData - The operation data to record
 * @param {string} operationData.operation - The name of the operation
 * @param {number} operationData.executionTimeMs - The execution time in milliseconds
 * @param {boolean} operationData.serverSide - Whether the operation was performed server-side
 * @param {boolean} operationData.success - Whether the operation was successful
 * @param {Object} operationData.additionalInfo - Additional information about the operation
 * @throws {Error} If the operation data is invalid or telemetry is not initialized
 */
function recordOperation(operationData) {
  if (!operationData || typeof operationData !== 'object') {
    throw new Error('Invalid operation data: must be an object');
  }
  
  if (!operationData.operation) {
    throw new Error('Invalid operation data: operation name is required');
  }
  
  if (operationData.executionTimeMs === undefined || isNaN(operationData.executionTimeMs)) {
    throw new Error('Invalid operation data: executionTimeMs must be a number');
  }
  
  if (!telemetryConfig.enabled) {
    // If telemetry is disabled, log and exit but don't throw
    console.warn('Telemetry is disabled, operation not recorded:', operationData.operation);
    return;
  }
  
  if (!telemetryConfig.endpoint) {
    throw new Error('Telemetry endpoint not configured');
  }
  
  try {
    // Add event to buffer
    eventBuffer.push({
      type: 'operation',
      timestamp: new Date().toISOString(),
      operation: operationData.operation,
      executionTimeMs: operationData.executionTimeMs,
      serverSide: !!operationData.serverSide,
      success: !!operationData.success,
      additionalInfo: operationData.additionalInfo || {}
    });
    
    // If buffer is full, flush it
    if (eventBuffer.length >= telemetryConfig.bufferSize) {
      flushBuffer();
    }
  } catch (error) {
    const enhancedError = new Error(`Failed to record operation: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.operationData = operationData;
    throw enhancedError;
  }
}

/**
 * Record an error that occurred during a ZK operation
 * @param {string} context - The context in which the error occurred
 * @param {string} errorMessage - The error message
 * @param {Object} additionalInfo - Additional information about the error
 * @throws {Error} If the error data is invalid or telemetry is not initialized
 */
function recordError(context, errorMessage, additionalInfo = {}) {
  if (!context) {
    throw new Error('Invalid error data: context is required');
  }
  
  if (!errorMessage) {
    throw new Error('Invalid error data: errorMessage is required');
  }
  
  if (additionalInfo && typeof additionalInfo !== 'object') {
    throw new Error('Invalid error data: additionalInfo must be an object');
  }
  
  if (!telemetryConfig.enabled) {
    // If telemetry is disabled, log and exit but don't throw
    console.error(`[Telemetry disabled] Error in ${context}: ${errorMessage}`, additionalInfo);
    return;
  }
  
  if (!telemetryConfig.endpoint) {
    throw new Error('Telemetry endpoint not configured');
  }
  
  try {
    // Add event to buffer
    eventBuffer.push({
      type: 'error',
      timestamp: new Date().toISOString(),
      context,
      errorMessage,
      additionalInfo: additionalInfo || {}
    });
    
    // Errors should be flushed immediately
    flushBuffer();
  } catch (error) {
    // Last resort error handling - just log it if we can't even record the error
    console.error('Failed to record error in telemetry system:', error);
    console.error('Original error:', context, errorMessage, additionalInfo);
  }
}

const telemetry = exports.telemetry = {
  initialize,
  recordOperation,
  recordError,
  
  // For testing/debugging only
  _getConfig: () => ({ ...telemetryConfig }),
  _getBufferLength: () => eventBuffer.length,
  _flushBuffer: flushBuffer
};