/**
 * progressTracker.js - Progress tracking for long-running ZK operations
 * 
 * This module provides a progress tracking system for zero-knowledge proof operations,
 * which can be time-consuming. It supports percentage-based tracking, time estimation,
 * and operation cancellation.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module works like a high-tech loading bar system for complex financial verification operations.
 * Think of it like these everyday progress tracking examples:
 * 
 * 1. SMART PROGRESS BAR: Similar to a download bar that shows both percentage complete
 *    and estimated time remaining, this helps users understand how long a complex
 *    financial verification will take.
 * 
 * 2. STATUS UPDATES: Like the tracking notifications you get from a package delivery
 *    service, this system provides regular updates on the verification process.
 * 
 * 3. CANCEL BUTTON: Just as you can cancel a file transfer that's taking too long,
 *    this system allows users to cancel verifications that are in progress.
 * 
 * 4. PERFORMANCE ANALYZER: Like a fitness tracker that learns your pace over time,
 *    this system gets smarter about estimating how long operations will take based
 *    on your device's capabilities.
 * 
 * Business value: Improves user experience during lengthy verification processes,
 * reduces abandonment rates by setting clear expectations about processing times,
 * enables users to make informed decisions about waiting or canceling operations,
 * and provides valuable analytics about system performance.
 * 
 * @module progressTracker
 * @version 1.0.0
 */

"use strict";

// Determine runtime environment
const isEsm = typeof require === 'undefined';
let errorHandler, errorLogger;

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

// Setup async module initialization
const modulesPromise = (async function loadModules() {
  try {
    if (isEsm) {
      // ESM environment - dynamically import the .mjs versions
      const [handlerModule, loggerModule] = await Promise.all([
        import('./zkErrorHandler.mjs'),
        import('./zkErrorLogger.mjs')
      ]);
      
      errorHandler = handlerModule;
      errorLogger = loggerModule.zkErrorLogger;
    } else {
      // CommonJS environment - use require for the CJS versions
      errorHandler = require('./zkErrorHandler.js');
      const loggerModule = require('./zkErrorLogger.js');
      errorLogger = loggerModule.zkErrorLogger;
    }
  } catch (err) {
    console.error(`Error in progressTracker module initialization: ${err.message}`);
    throw new ProgressTrackerError(
      `Failed to initialize progress tracker module: ${err.message}`,
      { environment: isEsm ? 'ESM' : 'CommonJS', moduleType: 'progress-tracker' },
      err
    );
  }
})();

/**
 * Helper to log errors in any try/catch blocks throughout the module
 * @param {Error} error - The error to log
 * @param {Object} context - Context information for the error
 * @returns {Promise<void>}
 * @private
 */
const logError = async (error, context = {}) => {
  try {
    // Wait for modules to load if they haven't already
    await modulesPromise;
    
    // Log using the dedicated error logger if available
    if (errorLogger && errorLogger.logError) {
      // Ensure we don't cause infinite loops if logger itself has issues
      await errorLogger.logError(error, {
        context: context.context || 'progressTracker.js',
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

  /**
   * Get estimated durations for different operation types
   * @returns {Object} Estimated durations in milliseconds
   * @private
   */
  _getEstimatedDurations() {
    // These are rough estimates and would be refined based on real measurements
    const base = {
      standard: {
        prove: 5000,  // 5 seconds
        verify: 2000   // 2 seconds
      },
      threshold: {
        prove: 8000,  // 8 seconds
        verify: 3000   // 3 seconds
      },
      maximum: {
        prove: 8000,  // 8 seconds
        verify: 3000   // 3 seconds
      }
    };

    // Apply device-specific adjustments if available
    let deviceMultiplier = 1.0;

    // In a browser environment, we could use the deviceCapabilities module
    // to adjust the multiplier based on the device class
    if (typeof window !== 'undefined') {
      try {
        // This is a simplified example - in practice, you'd import the deviceCapabilities module
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          deviceMultiplier = 2.5; // Mobile devices are typically 2.5x slower
        }
      } catch (error) {
        // Log errors in device detection
        logError(
          new ProgressTrackerError(
            `Error detecting device type: ${error.message}`,
            { method: '_getEstimatedDurations', deviceDetection: true },
            error
          ),
          { 
            context: 'progressTracker._getEstimatedDurations',
            operationType: this.operationType,
            circuitType: this.circuitType
          }
        ).catch(err => {
          // Last resort fallback if logging itself fails
          console.error('Failed to log device detection error:', err);
          console.error('Original error:', error);
        });
        
        // Use default multiplier
        deviceMultiplier = 1.5; // Use a moderate multiplier as fallback
      }
    }

    // Apply the multiplier to all durations
    const result = {};
    try {
      for (const [circuit, operations] of Object.entries(base)) {
        result[circuit] = {};
        for (const [operation, duration] of Object.entries(operations)) {
          result[circuit][operation] = Math.round(duration * deviceMultiplier);
        }
      }
    } catch (error) {
      // Log any errors in duration calculation
      logError(
        new ProgressTrackerError(
          `Error calculating operation durations: ${error.message}`,
          { method: '_getEstimatedDurations', multiplier: deviceMultiplier },
          error
        ),
        { 
          context: 'progressTracker._getEstimatedDurations',
          operationType: this.operationType,
          circuitType: this.circuitType
        }
      ).catch(err => console.error('Failed to log duration calculation error:', err));
      
      // Return default durations if calculation fails
      return base;
    }

    return result;
  }

  /**
   * Start tracking progress
   * @returns {ProgressTracker} This instance for chaining
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like pressing the "Start" button on a stopwatch before beginning
   * an activity. It initializes the tracking system, records the starting time, and
   * resets all progress counters to zero - similar to how you might reset a timer
   * before beginning a cooking recipe or starting a race. This prepares the system
   * to accurately track how long the verification process takes and provide useful
   * updates to the user.
   */
  start() {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.currentStep = 0;
    this.isComplete = false;
    this.stepsCompleted.clear();
    this.stepTimings = {};

    // Send initial progress update
    this._sendProgressUpdate();

    return this;
  }

  /**
   * Update progress to a specific percentage
   * @param {number} percentage - Progress percentage (0-100)
   * @returns {ProgressTracker} This instance for chaining
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like updating a loading bar to show how much of a download
   * or installation has completed. When the verification process reaches a new
   * milestone (like completing 25% or 50% of the calculations), this function:
   * 
   * 1. Updates the progress display to show the current percentage completed
   * 2. Recalculates the estimated time remaining based on progress so far
   * 3. Notifies the user of the updated status
   * 
   * It's similar to how video streaming services show "buffering" progress or how
   * file transfers display completion percentage so you know how much longer to wait.
   */
  updateProgress(percentage) {
    if (this.cancelled) return this;

    const newStep = Math.floor((percentage / 100) * this.totalSteps);

    // Only update if there's actual progress
    if (newStep > this.currentStep) {
      const now = Date.now();

      // Record timing for steps
      for (let step = this.currentStep + 1; step <= newStep; step++) {
        if (!this.stepsCompleted.has(step)) {
          this.stepsCompleted.add(step);
          this.stepTimings[step] = now;
        }
      }

      this.currentStep = newStep;
      this.lastUpdateTime = now;

      // Send progress update
      this._sendProgressUpdate();
    }

    return this;
  }

  /**
   * Advance progress by a number of steps
   * @param {number} steps - Number of steps to advance
   * @returns {ProgressTracker} This instance for chaining
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like checking off multiple items on a to-do list at once.
   * Rather than updating to a specific percentage, it moves the progress forward
   * by a certain number of steps or tasks completed.
   * 
   * For example, if a verification process has 10 steps and you've completed 3 more,
   * this function advances the progress by those 3 steps and calculates the new
   * percentage automatically - similar to how you might check off multiple completed
   * items on a project task list and see the overall project progress update.
   */
  advanceSteps(steps) {
    if (this.cancelled) return this;

    const newStep = Math.min(this.currentStep + steps, this.totalSteps);
    const percentage = (newStep / this.totalSteps) * 100;

    return this.updateProgress(percentage);
  }

  /**
   * Complete the progress tracking
   * @returns {ProgressTracker} This instance for chaining
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like pressing the "Finish" button when a process is complete.
   * It marks the verification process as 100% complete, stops the timer, and sends
   * a final notification to the user.
   * 
   * Similar to how a fitness app might record your final time and stats when you
   * complete a workout, this function finalizes all tracking data and provides a
   * completion message to the user, confirming that their verification is now complete
   * and providing information about how long it took.
   */
  complete() {
    if (this.cancelled) return this;

    this.currentStep = this.totalSteps;
    this.isComplete = true;

    // Record completion time
    const now = Date.now();
    this.lastUpdateTime = now;
    this.stepTimings[this.totalSteps] = now;

    // Send final progress update
    this._sendProgressUpdate();

    return this;
  }

  /**
   * Cancel the operation
   * @param {Error} [error] - Optional error that caused cancellation
   * @returns {ProgressTracker} This instance for chaining
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like pressing the "Cancel" button during a download or installation.
   * When a user decides to stop a verification process before it completes, or if an error
   * occurs that prevents completion, this function:
   * 
   * 1. Immediately stops the verification process
   * 2. Records why it was cancelled (error or user request)
   * 3. Notifies the user that the operation has been stopped
   * 
   * It's similar to how you might cancel a money transfer that's taking too long or
   * stop a navigation app when you decide to take a different route - providing a clean
   * way to abort an operation that's in progress.
   */
  cancel(error) {
    if (this.cancelled) return this;

    this.cancelled = true;
    this.error = error;

    // Send cancellation update
    this._sendProgressUpdate();

    return this;
  }

  /**
   * Check if the operation was cancelled
   * @returns {boolean} Whether the operation was cancelled
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like checking if a "Stop" sign is currently displayed.
   * It simply returns whether the verification process has been cancelled,
   * allowing other parts of the system to quickly check this status before
   * attempting to continue with any processing.
   * 
   * It's similar to how a train conductor might check if a stop signal is showing
   * before proceeding - a simple check that prevents wasted effort on operations
   * that should no longer continue.
   */
  isCancelled() {
    // Check both local cancellation and abort signal
    return this.cancelled || (this.abortSignal && this.abortSignal.aborted);
  }

  /**
   * Calculate estimated time remaining based on progress so far
   * @returns {number} Estimated time remaining in milliseconds
   * @private
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like calculating "arrival time" during a car journey.
   * Just as a GPS navigation system uses your current speed and the remaining
   * distance to estimate when you'll arrive at your destination, this function:
   * 
   * 1. Looks at how fast the verification has been processing so far
   * 2. Considers how much more needs to be completed
   * 3. Calculates approximately how much longer it will take to finish
   * 
   * This helps set realistic expectations for users about how long they'll need
   * to wait, allowing them to decide whether to continue or try again later.
   */
  _calculateEstimatedTimeRemaining() {
    if (this.isComplete) return 0;
    if (this.currentStep === 0) {
      // No progress yet, use predefined estimates
      const estimates = this.estimatedDurations[this.circuitType] || {};
      return estimates[this.operationType] || 5000; // Default to 5 seconds if no estimate
    }

    const now = Date.now();
    const elapsed = now - this.startTime;
    const progressRatio = this.currentStep / this.totalSteps;

    // Avoid division by zero
    if (progressRatio === 0) return 0;

    // Calculate estimated total time based on current progress
    const estimatedTotal = elapsed / progressRatio;

    // Return remaining time
    return Math.max(0, estimatedTotal - elapsed);
  }

  /**
   * Calculate current operation speed in steps per second
   * @returns {number} Current speed in steps per second
   * @private
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like checking your current speed on a speedometer.
   * It calculates how quickly the verification process is progressing by
   * measuring how many steps or calculations are being completed per second.
   * 
   * Similar to how a download manager might display "3.2 MB/sec" to indicate
   * download speed, this function determines the processing speed, which helps
   * in estimating completion time and identifying whether the process is running
   * at expected performance levels.
   */
  _calculateSpeed() {
    if (this.currentStep === 0) return 0;

    const now = Date.now();
    const elapsed = now - this.startTime;

    // Avoid division by zero
    if (elapsed === 0) return 0;

    return (this.currentStep / elapsed) * 1000;
  }

  /**
   * Send a progress update to the callback
   * @private
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like a news broadcaster sending regular updates about an
   * ongoing situation. When there's new information about the verification process,
   * this function creates a complete update package with information such as:
   * 
   * - Current percentage complete
   * - Estimated time remaining
   * - Whether the process is still active or has been cancelled
   * - Any error information if problems have occurred
   * 
   * It then delivers this update to the user interface so the user stays informed
   * about what's happening with their verification request.
   */
  _sendProgressUpdate() {
    if (!this.onProgressUpdate) return;

    const percentage = (this.currentStep / this.totalSteps) * 100;
    const estimatedTimeRemaining = this._calculateEstimatedTimeRemaining();
    const speed = this._calculateSpeed();

    const update = {
      percentage: Math.min(100, Math.round(percentage * 10) / 10), // Round to 1 decimal place
      step: this.currentStep,
      totalSteps: this.totalSteps,
      elapsed: Date.now() - this.startTime,
      estimatedTimeRemaining,
      speed,
      operationType: this.operationType,
      circuitType: this.circuitType,
      isComplete: this.isComplete,
      isCancelled: this.cancelled,
      error: this.error
    };

    this.onProgressUpdate(update);
  }

  /**
   * Create a new named progress tracker
   * @param {string} id - Unique identifier for this tracker
   * @param {Object} options - Progress tracker options
   * @returns {ProgressTracker} New progress tracker instance
   * @throws {ProgressTrackerError} If id is not provided or options are invalid
   * @static
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like setting up a new package tracking number in a delivery system.
   * When the application needs to track a new verification process, this function:
   * 
   * 1. Creates a new progress tracker with a unique ID (like a tracking number)
   * 2. Configures it with the specific options needed for that particular verification
   * 3. Stores it in a central registry so it can be accessed by its ID
   * 
   * This allows the system to track multiple verification processes simultaneously,
   * each with its own unique identifier, similar to how a shipping company can track
   * multiple packages at once using different tracking numbers.
   */
  static create(id, options) {
    try {
      // Validate id parameter
      if (!id) {
        throw new ProgressTrackerError(
          'Tracker ID is required when creating a named progress tracker',
          { method: 'create', context: 'validation' }
        );
      }
      
      // Remove any existing tracker with this ID
      if (ProgressTracker.activeTrackers[id]) {
        try {
          ProgressTracker.activeTrackers[id].cancel();
        } catch (error) {
          // Log error if cancellation fails
          logError(
            new ProgressTrackerError(
              `Failed to cancel existing tracker with ID ${id}: ${error.message}`,
              { method: 'create', trackerId: id },
              error
            ),
            { context: 'progressTracker.create' }
          ).catch(err => console.error('Failed to log tracker cancellation error:', err));
        }
      }

      // Create new tracker
      const tracker = new ProgressTracker(options);
      
      // Add tracker to registry
      ProgressTracker.activeTrackers[id] = tracker;

      return tracker;
    } catch (error) {
      // Log error during tracker creation
      logError(
        error instanceof ProgressTrackerError ? error : 
          new ProgressTrackerError(
            `Failed to create progress tracker with ID ${id}: ${error.message}`,
            { method: 'create', trackerId: id, options },
            error
          ),
        { context: 'progressTracker.create' }
      ).catch(err => console.error('Failed to log tracker creation error:', err));
      
      // Re-throw to inform caller of the failure
      throw error;
    }
  }

  /**
   * Get a progress tracker by ID
   * @param {string} id - Tracker identifier
   * @returns {ProgressTracker|null} The progress tracker or null if not found
   * @throws {ProgressTrackerError} If id is not provided
   * @static
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like looking up a package using its tracking number.
   * It retrieves a specific verification progress tracker from the central
   * registry by using its unique ID.
   * 
   * Similar to how you might enter a tracking number on a delivery company's
   * website to see the status of your specific package, this function retrieves
   * the tracker for a specific verification process so the application can check
   * or update its status.
   */
  static get(id) {
    try {
      // Validate id parameter
      if (!id) {
        throw new ProgressTrackerError(
          'Tracker ID is required when getting a progress tracker',
          { method: 'get', context: 'validation' }
        );
      }
      
      return ProgressTracker.activeTrackers[id] || null;
    } catch (error) {
      // Log error during tracker retrieval
      logError(
        error instanceof ProgressTrackerError ? error : 
          new ProgressTrackerError(
            `Failed to get progress tracker with ID ${id}: ${error.message}`,
            { method: 'get', trackerId: id },
            error
          ),
        { context: 'progressTracker.get' }
      ).catch(err => console.error('Failed to log tracker retrieval error:', err));
      
      // Return null for non-validation errors
      if (!(error instanceof ProgressTrackerError) || error.context?.context !== 'validation') {
        return null;
      }
      
      // Re-throw validation errors
      throw error;
    }
  }

  /**
   * Remove a progress tracker from the registry
   * @param {string} id - Tracker identifier
   * @throws {ProgressTrackerError} If id is not provided
   * @static
   * 
   * ---------- NON-TECHNICAL SUMMARY ----------
   * This function is like closing a completed tracking record in a delivery system.
   * Once a verification process is fully complete (whether successful or cancelled),
   * this function removes its tracking information from the central registry to:
   * 
   * 1. Free up system resources
   * 2. Keep the registry clean and focused only on active verifications
   * 3. Prevent confusion with old or outdated tracking information
   * 
   * It's similar to how a project management system might archive completed projects
   * to keep the active projects list manageable and relevant.
   */
  static remove(id) {
    try {
      // Validate id parameter
      if (!id) {
        throw new ProgressTrackerError(
          'Tracker ID is required when removing a progress tracker',
          { method: 'remove', context: 'validation' }
        );
      }
      
      if (ProgressTracker.activeTrackers[id]) {
        // Attempt to cancel the tracker first if it's still active
        try {
          if (!ProgressTracker.activeTrackers[id].isComplete && 
              !ProgressTracker.activeTrackers[id].cancelled) {
            ProgressTracker.activeTrackers[id].cancel();
          }
        } catch (error) {
          // Log but continue with removal even if cancellation fails
          logError(
            new ProgressTrackerError(
              `Failed to cancel tracker during removal (ID ${id}): ${error.message}`,
              { method: 'remove', trackerId: id },
              error
            ),
            { context: 'progressTracker.remove' }
          ).catch(err => console.error('Failed to log tracker cancellation error during removal:', err));
        }
        
        // Remove tracker from registry
        delete ProgressTracker.activeTrackers[id];
      }
    } catch (error) {
      // Log error during tracker removal
      logError(
        error instanceof ProgressTrackerError ? error : 
          new ProgressTrackerError(
            `Failed to remove progress tracker with ID ${id}: ${error.message}`,
            { method: 'remove', trackerId: id },
            error
          ),
        { context: 'progressTracker.remove' }
      ).catch(err => console.error('Failed to log tracker removal error:', err));
      
      // Only re-throw validation errors
      if (error instanceof ProgressTrackerError && error.context?.context === 'validation') {
        throw error;
      }
    }
  }
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
    // Ensure error handling modules are loaded
    await modulesPromise;
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

// Export all components
export { ProgressTracker, createProgressTracker, ProgressTrackerError };

// Default export for compatibility
const progressTrackerExports = {
  ProgressTracker,
  createProgressTracker,
  ProgressTrackerError
};

export default progressTrackerExports;