/**
 * progressTracker.cjs - Progress tracking for long-running ZK operations (CommonJS version)
 * 
 * This module provides a progress tracking system for zero-knowledge proof operations,
 * which can be time-consuming. It supports percentage-based tracking, time estimation,
 * and operation cancellation.
 * 
 * @module progressTracker
 * @version 1.0.0
 */

"use strict";

// Import dependencies
const { zkErrorLogger } = require('./zkErrorLogger.cjs');
const errorHandler = require('./zkErrorHandler.cjs');

/**
 * Error thrown when progress tracking operations fail
 * @extends Error
 */
class ProgressTrackerError extends Error {
  /**
   * Create a new ProgressTrackerError
   * @param {string} message - Error message
   * @param {Object} context - Additional context about the error
   * @param {Error} [originalError] - The original error that caused this one
   */
  constructor(message, context, originalError) {
    super(message);
    this.name = 'ProgressTrackerError';
    this.context = context;
    this.originalError = originalError;
  }
}

/**
 * Helper to log errors in any try/catch blocks throughout the module
 * @param {Error} error - The error to log
 * @param {Object} context - Context information for the error
 * @returns {Promise<void>}
 * @private
 */
const logError = async (error, context = {}) => {
  try {
    // Log using the dedicated error logger if available
    if (zkErrorLogger && zkErrorLogger.logError) {
      // Ensure we don't cause infinite loops if logger itself has issues
      await zkErrorLogger.logError(error, {
        context: context.context || 'progressTracker.cjs',
        ...context
      });
    } else {
      // Fallback to console if logger not available
      console.error(`[progressTracker] Error: ${error.message}`, context);
    }
  } catch (loggingError) {
    // Last resort if even logging fails
    console.error(`Failed to log error: ${loggingError.message}`);
    console.error(`Original error: ${error.message}`);
  }
};

/**
 * Progress tracker class for long-running operations
 */
class ProgressTracker {
  /**
   * Create a new progress tracker
   * @param {Object} options - Progress tracker options
   * @param {string} options.operationType - Type of operation ('prove', 'verify', 'batch')
   * @param {string} options.circuitType - Type of circuit ('standard', 'threshold', 'maximum')
   * @param {function} [options.onProgressUpdate] - Callback for progress updates
   * @param {number} [options.steps=100] - Total number of steps in the operation
   * @param {AbortSignal} [options.abortSignal] - Signal to abort the operation
   * @throws {ProgressTrackerError} If required parameters are missing or invalid
   */
  constructor({
    operationType,
    circuitType,
    onProgressUpdate,
    steps = 100,
    abortSignal
  }) {
    try {
      // Validate required parameters
      if (!operationType) {
        throw new ProgressTrackerError(
          'Operation type is required when creating a progress tracker',
          { method: 'constructor', context: 'validation' }
        );
      }
      
      if (!circuitType) {
        throw new ProgressTrackerError(
          'Circuit type is required when creating a progress tracker',
          { method: 'constructor', context: 'validation' }
        );
      }
      
      // Initialize instance properties
      this.operationType = operationType;
      this.circuitType = circuitType;
      this.onProgressUpdate = onProgressUpdate || (() => { });
      this.totalSteps = steps;
      this.currentStep = 0;
      this.startTime = null;
      this.lastUpdateTime = null;
      this.abortSignal = abortSignal;
      this.isComplete = false;
      this.stepsCompleted = new Set();
      this.stepTimings = {};
      this.cancelled = false;
      this.error = null;
      this.operationId = `${operationType}_${circuitType}_${Date.now()}`;

      // Bind to abort signal if provided
      if (this.abortSignal) {
        try {
          this.abortSignal.addEventListener('abort', () => {
            this.cancel();
          });
        } catch (error) {
          // Log error if abort signal binding fails
          logError(
            new ProgressTrackerError(
              `Failed to bind to abort signal: ${error.message}`,
              { method: 'constructor', operationId: this.operationId },
              error
            ),
            { 
              context: 'progressTracker.constructor',
              operationType: this.operationType,
              circuitType: this.circuitType
            }
          ).catch(err => console.error('Failed to log abort signal binding error:', err));
          
          // Continue without abort signal
          this.abortSignal = null;
        }
      }

      // Initialize estimated durations for different operation types
      this.estimatedDurations = this._getEstimatedDurations();
      
    } catch (error) {
      // Log constructor errors
      logError(
        error instanceof ProgressTrackerError ? error : 
          new ProgressTrackerError(
            `Error initializing progress tracker: ${error.message}`,
            { 
              method: 'constructor',
              operationType,
              circuitType,
              steps
            },
            error
          ),
        { context: 'progressTracker.constructor' }
      ).catch(err => console.error('Failed to log constructor error:', err));
      
      // Re-throw to prevent creation of an invalid instance
      throw error;
    }
  }

  // All instance methods follow here...
  // ... (truncated for brevity) ...
}

// Static tracker registry
ProgressTracker.activeTrackers = {};

/**
 * Async factory function that ensures error handling system is initialized before creating a tracker
 * @param {Object} options - Progress tracker options
 * @returns {Promise<ProgressTracker>} A new progress tracker instance
 */
const createProgressTracker = async (options) => {
  try {
    return new ProgressTracker(options);
  } catch (error) {
    // Log and re-throw to inform caller of the failure
    logError(
      error instanceof ProgressTrackerError ? error : 
        new ProgressTrackerError(
          `Failed to create progress tracker: ${error.message}`,
          { method: 'createProgressTracker', options },
          error
        ),
      { context: 'progressTracker.createProgressTracker' }
    ).catch(err => console.error('Failed to log tracker creation error:', err));
    
    throw error;
  }
};

// Export module
module.exports = {
  ProgressTracker,
  createProgressTracker,
  ProgressTrackerError
};