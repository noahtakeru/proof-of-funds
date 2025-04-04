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
 * Version: 1.0.0
 */

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
   */
  constructor({
    operationType,
    circuitType,
    onProgressUpdate,
    steps = 100,
    abortSignal
  }) {
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

    // Bind to abort signal if provided
    if (this.abortSignal) {
      this.abortSignal.addEventListener('abort', () => {
        this.cancel();
      });
    }

    // Initialize estimated durations for different operation types
    this.estimatedDurations = this._getEstimatedDurations();
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
      } catch (e) {
        // Ignore errors in device detection
      }
    }

    // Apply the multiplier to all durations
    const result = {};
    for (const [circuit, operations] of Object.entries(base)) {
      result[circuit] = {};
      for (const [operation, duration] of Object.entries(operations)) {
        result[circuit][operation] = Math.round(duration * deviceMultiplier);
      }
    }

    return result;
  }

  /**
   * Start tracking progress
   * @returns {ProgressTracker} This instance for chaining
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
   * @param {Error} [error] - Optional error that caused the cancellation
   * @returns {ProgressTracker} This instance for chaining
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
   * Check if the operation has been cancelled
   * @returns {boolean} True if cancelled
   */
  isCancelled() {
    // Check both local cancellation and abort signal
    return this.cancelled || (this.abortSignal && this.abortSignal.aborted);
  }

  /**
   * Calculate the estimated remaining time
   * @returns {number} Estimated remaining time in milliseconds
   * @private
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
   * Calculate the current speed in steps per second
   * @returns {number} Steps per second
   * @private
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
   * Send progress update to the callback
   * @private
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
   * Create a progress tracker with a reusable ID
   * @param {string} id - Progress tracker ID
   * @param {Object} options - Progress tracker options
   * @returns {ProgressTracker} Progress tracker instance
   * @static
   */
  static create(id, options) {
    // Remove any existing tracker with this ID
    if (ProgressTracker.activeTrackers[id]) {
      ProgressTracker.activeTrackers[id].cancel();
    }

    // Create new tracker
    const tracker = new ProgressTracker(options);
    ProgressTracker.activeTrackers[id] = tracker;

    return tracker;
  }

  /**
   * Get an existing progress tracker by ID
   * @param {string} id - Progress tracker ID
   * @returns {ProgressTracker|null} Progress tracker instance or null if not found
   * @static
   */
  static get(id) {
    return ProgressTracker.activeTrackers[id] || null;
  }

  /**
   * Remove a progress tracker by ID
   * @param {string} id - Progress tracker ID
   * @static
   */
  static remove(id) {
    if (ProgressTracker.activeTrackers[id]) {
      delete ProgressTracker.activeTrackers[id];
    }
  }
}

// Static tracker registry
ProgressTracker.activeTrackers = {};

export { ProgressTracker };
export default ProgressTracker;