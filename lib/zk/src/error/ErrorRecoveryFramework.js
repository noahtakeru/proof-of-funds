/**
 * @fileoverview Error Recovery Framework
 * 
 * This module provides a comprehensive framework for error recovery 
 * in the ZK system, integrating with the error handling and logging systems.
 * 
 * @module ErrorRecoveryFramework
 */

import { 
  ErrorSeverity, 
  ErrorCategory, 
  errorLogger 
} from './ErrorSystem.js';

import { 
  RecoveryStrategy, 
  RecoveryStatus, 
  RecoveryOrchestrator,
  recoveryOrchestrator
} from './ErrorRecovery.js';

/**
 * Recovery framework configuration
 * @typedef {Object} RecoveryFrameworkConfig
 * @property {boolean} [enabled=true] - Whether recovery is enabled
 * @property {number} [maxAttempts=3] - Maximum recovery attempts
 * @property {boolean} [logRecoveryAttempts=true] - Whether to log recovery attempts
 * @property {boolean} [metricsEnabled=true] - Whether to collect recovery metrics
 * @property {Object} [strategyPriorities] - Strategy priorities by error category
 */

/**
 * Default recovery framework configuration
 * @type {RecoveryFrameworkConfig}
 */
const DEFAULT_CONFIG = {
  enabled: true,
  maxAttempts: 3,
  logRecoveryAttempts: true,
  metricsEnabled: true,
  strategyPriorities: {
    [ErrorCategory.NETWORK]: [
      RecoveryStrategy.RETRY,
      RecoveryStrategy.CACHE,
      RecoveryStrategy.FALLBACK
    ],
    [ErrorCategory.MEMORY]: [
      RecoveryStrategy.SERVER_DELEGATION,
      RecoveryStrategy.ALTERNATE_PATH,
      RecoveryStrategy.GRACEFUL_DEGRADATION
    ],
    [ErrorCategory.CIRCUIT]: [
      RecoveryStrategy.ALTERNATE_PATH,
      RecoveryStrategy.SERVER_DELEGATION,
      RecoveryStrategy.FALLBACK
    ],
    [ErrorCategory.PROOF]: [
      RecoveryStrategy.RETRY,
      RecoveryStrategy.SERVER_DELEGATION,
      RecoveryStrategy.FALLBACK
    ],
    [ErrorCategory.VERIFICATION]: [
      RecoveryStrategy.RETRY,
      RecoveryStrategy.ALTERNATE_PATH,
      RecoveryStrategy.FALLBACK
    ],
    [ErrorCategory.SECURITY]: [
      RecoveryStrategy.FALLBACK,
      RecoveryStrategy.GRACEFUL_DEGRADATION
    ],
    [ErrorCategory.INPUT]: [
      RecoveryStrategy.FALLBACK,
      RecoveryStrategy.RETRY
    ],
    [ErrorCategory.SYSTEM]: [
      RecoveryStrategy.RETRY,
      RecoveryStrategy.ALTERNATE_PATH,
      RecoveryStrategy.FALLBACK
    ],
    [ErrorCategory.COMPATIBILITY]: [
      RecoveryStrategy.ALTERNATE_PATH,
      RecoveryStrategy.GRACEFUL_DEGRADATION,
      RecoveryStrategy.FALLBACK
    ],
    [ErrorCategory.DEPLOYMENT]: [
      RecoveryStrategy.RETRY,
      RecoveryStrategy.ALTERNATE_PATH,
      RecoveryStrategy.FALLBACK
    ],
    [ErrorCategory.GAS]: [
      RecoveryStrategy.RETRY,
      RecoveryStrategy.ALTERNATE_PATH,
      RecoveryStrategy.FALLBACK
    ]
  }
};

/**
 * Recovery metrics for monitoring and analysis
 */
class RecoveryMetrics {
  constructor() {
    this.attemptCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.strategySuccesses = new Map();
    this.categorySuccesses = new Map();
    this.averageRecoveryTime = 0;
    this.totalRecoveryTime = 0;
  }
  
  /**
   * Record a recovery attempt
   * @param {Object} result - Recovery result
   * @param {number} duration - Recovery duration in milliseconds
   */
  recordAttempt(result, duration) {
    this.attemptCount++;
    this.totalRecoveryTime += duration;
    this.averageRecoveryTime = this.totalRecoveryTime / this.attemptCount;
    
    if (result.status === RecoveryStatus.SUCCESS) {
      this.successCount++;
      
      // Record strategy success
      if (result.strategyUsed) {
        const currentCount = this.strategySuccesses.get(result.strategyUsed) || 0;
        this.strategySuccesses.set(result.strategyUsed, currentCount + 1);
      }
      
      // Record category success
      if (result.category) {
        const currentCount = this.categorySuccesses.get(result.category) || 0;
        this.categorySuccesses.set(result.category, currentCount + 1);
      }
    } else {
      this.failureCount++;
    }
  }
  
  /**
   * Get recovery success rate
   * @returns {number} Success rate as a percentage
   */
  getSuccessRate() {
    if (this.attemptCount === 0) return 0;
    return (this.successCount / this.attemptCount) * 100;
  }
  
  /**
   * Get metrics summary
   * @returns {Object} Metrics summary
   */
  getSummary() {
    return {
      attemptCount: this.attemptCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate: this.getSuccessRate(),
      averageRecoveryTime: this.averageRecoveryTime,
      strategySuccesses: Object.fromEntries(this.strategySuccesses),
      categorySuccesses: Object.fromEntries(this.categorySuccesses)
    };
  }
  
  /**
   * Reset metrics
   */
  reset() {
    this.attemptCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.strategySuccesses.clear();
    this.categorySuccesses.clear();
    this.averageRecoveryTime = 0;
    this.totalRecoveryTime = 0;
  }
}

/**
 * Main recovery framework class that coordinates error recovery
 */
export class ErrorRecoveryFramework {
  /**
   * Create a new error recovery framework
   * @param {RecoveryFrameworkConfig} config - Framework configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.orchestrator = recoveryOrchestrator;
    this.metrics = new RecoveryMetrics();
    this.attemptsByOperation = new Map();
    this.enabled = this.config.enabled;
  }
  
  /**
   * Enable or disable recovery
   * @param {boolean} enabled - Whether recovery is enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  
  /**
   * Check if recovery is enabled
   * @returns {boolean} Whether recovery is enabled
   */
  isEnabled() {
    return this.enabled;
  }
  
  /**
   * Get metrics for monitoring and analysis
   * @returns {Object} Metrics summary
   */
  getMetrics() {
    return this.metrics.getSummary();
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics.reset();
  }
  
  /**
   * Determine the best recovery strategies for an error
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Array<string>} Prioritized strategy names
   * @private
   */
  getPrioritizedStrategies(error, context) {
    // If context specifies strategies, use those
    if (context.strategies && Array.isArray(context.strategies)) {
      return context.strategies;
    }
    
    // Otherwise, use priorities based on error category
    const category = error.category || 
      (context.zkError ? context.zkError.category : ErrorCategory.SYSTEM);
    
    return this.config.strategyPriorities[category] || 
      this.config.strategyPriorities[ErrorCategory.SYSTEM];
  }
  
  /**
   * Check if an operation has exceeded maximum recovery attempts
   * @param {string} operationId - Operation ID
   * @returns {boolean} True if maximum attempts exceeded
   * @private
   */
  hasExceededMaxAttempts(operationId) {
    const attempts = this.attemptsByOperation.get(operationId) || 0;
    return attempts >= this.config.maxAttempts;
  }
  
  /**
   * Track recovery attempt for an operation
   * @param {string} operationId - Operation ID
   * @private
   */
  trackAttempt(operationId) {
    const attempts = this.attemptsByOperation.get(operationId) || 0;
    this.attemptsByOperation.set(operationId, attempts + 1);
  }
  
  /**
   * Attempt to recover from an error
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   * @async
   */
  async recover(error, context = {}) {
    if (!this.enabled) {
      return {
        status: RecoveryStatus.FAILURE,
        message: 'Recovery is disabled',
        error
      };
    }
    
    const operationId = context.operationId || 
      `recovery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Check if max attempts exceeded
    if (this.hasExceededMaxAttempts(operationId)) {
      return {
        status: RecoveryStatus.FAILURE,
        message: `Maximum recovery attempts (${this.config.maxAttempts}) exceeded`,
        error,
        maxAttemptsExceeded: true
      };
    }
    
    // Track this attempt
    this.trackAttempt(operationId);
    
    // Get prioritized strategies
    const strategies = this.getPrioritizedStrategies(error, context);
    
    // Log recovery attempt if enabled
    if (this.config.logRecoveryAttempts) {
      errorLogger.info(`Attempting recovery for operation ${operationId}`, {
        operationId,
        error: error.message,
        strategies,
        attemptNumber: this.attemptsByOperation.get(operationId)
      });
    }
    
    // Record start time for metrics
    const startTime = Date.now();
    
    try {
      // Attempt recovery with the orchestrator
      const result = await this.orchestrator.recover(error, {
        ...context,
        operationId,
        strategies
      });
      
      // Record metrics
      if (this.config.metricsEnabled) {
        const duration = Date.now() - startTime;
        this.metrics.recordAttempt(result, duration);
      }
      
      // Log result if logging enabled
      if (this.config.logRecoveryAttempts) {
        if (result.status === RecoveryStatus.SUCCESS) {
          errorLogger.info(`Recovery succeeded for operation ${operationId}`, {
            operationId,
            strategyUsed: result.strategyUsed,
            duration: Date.now() - startTime
          });
        } else {
          errorLogger.warn(`Recovery failed for operation ${operationId}`, {
            operationId,
            error: error.message,
            strategiesAttempted: result.strategiesAttempted,
            duration: Date.now() - startTime
          });
        }
      }
      
      return result;
    } catch (recoveryError) {
      // Log recovery error
      errorLogger.error(`Error during recovery for operation ${operationId}`, {
        operationId,
        originalError: error.message,
        recoveryError: recoveryError.message
      });
      
      return {
        status: RecoveryStatus.FAILURE,
        message: 'Error occurred during recovery process',
        error,
        recoveryError
      };
    }
  }
  
  /**
   * Execute an operation with automatic error recovery
   * @param {Function} operation - Operation to execute
   * @param {Object} context - Operation context
   * @returns {Promise<any>} Operation result or recovery result
   * @async
   */
  async executeWithRecovery(operation, context = {}) {
    if (!this.enabled) {
      // If recovery is disabled, just execute the operation normally
      return operation();
    }
    
    try {
      // Attempt to execute the operation
      return await operation();
    } catch (error) {
      // Operation failed, attempt recovery
      const recoveryResult = await this.recover(error, {
        ...context,
        operation,
        operationParams: context.params
      });
      
      if (recoveryResult.status === RecoveryStatus.SUCCESS) {
        // Recovery succeeded, return the recovered result
        return recoveryResult.result;
      }
      
      // Recovery failed, throw the original error
      throw error;
    }
  }
}

// Create default instance
export const errorRecoveryFramework = new ErrorRecoveryFramework();

// Export default for ESM
export default {
  ErrorRecoveryFramework,
  errorRecoveryFramework,
  RecoveryMetrics
};