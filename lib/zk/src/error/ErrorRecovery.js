/**
 * @fileoverview Error Recovery System
 * 
 * This module provides functionality for recovering from errors in the ZK system.
 * It includes strategies for different types of errors, fallback mechanisms,
 * and a system for registering custom recovery strategies.
 * 
 * @module ErrorRecovery
 */

import { ErrorCategory, ErrorSeverity } from './ErrorSystem.js';

/**
 * Recovery strategies for different error types.
 * @enum {string}
 */
export const RecoveryStrategy = {
  RETRY: 'retry',
  FALLBACK: 'fallback',
  CACHE: 'cache',
  ALTERNATE_PATH: 'alternate_path',
  GRACEFUL_DEGRADATION: 'graceful_degradation',
  SERVER_DELEGATION: 'server_delegation'
};

/**
 * Recovery result status
 * @enum {string}
 */
export const RecoveryStatus = {
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  FAILURE: 'failure',
  UNRECOVERABLE: 'unrecoverable'
};

/**
 * Base class for recovery strategies
 */
export class BaseRecoveryStrategy {
  /**
   * Create a new recovery strategy
   * @param {string} name - Strategy name
   * @param {Object} options - Strategy options
   */
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
  }
  
  /**
   * Check if this strategy can handle a given error
   * @param {Error} error - Error to check
   * @param {Object} context - Error context
   * @returns {boolean} True if this strategy can handle the error
   */
  canHandle(error, context) {
    return false; // Subclasses should override this
  }
  
  /**
   * Attempt to recover from an error
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   * @async
   */
  async recover(error, context) {
    throw new Error('recover() method must be implemented by subclasses');
  }
}

/**
 * Retry recovery strategy
 */
export class RetryStrategy extends BaseRecoveryStrategy {
  /**
   * Create a new retry strategy
   * @param {Object} options - Strategy options
   * @param {number} [options.maxRetries=3] - Maximum number of retries
   * @param {number} [options.initialDelay=1000] - Initial delay in milliseconds
   * @param {boolean} [options.exponentialBackoff=true] - Whether to use exponential backoff
   * @param {Array<string>} [options.retryableCategories] - Error categories that can be retried
   */
  constructor(options = {}) {
    super('retry', options);
    
    this.maxRetries = options.maxRetries || 3;
    this.initialDelay = options.initialDelay || 1000;
    this.exponentialBackoff = options.exponentialBackoff !== false;
    this.retryableCategories = options.retryableCategories || [
      ErrorCategory.NETWORK,
      ErrorCategory.SYSTEM
    ];
  }
  
  /**
   * Check if this strategy can handle a given error
   * @param {Error} error - Error to check
   * @param {Object} context - Error context
   * @returns {boolean} True if this strategy can handle the error
   */
  canHandle(error, context) {
    // Check if the error is in a retryable category
    if (error.category && this.retryableCategories.includes(error.category)) {
      return true;
    }
    
    // Check if there's an operation to retry
    return Boolean(context && context.operation && typeof context.operation === 'function');
  }
  
  /**
   * Attempt to recover by retrying the operation
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   * @async
   */
  async recover(error, context) {
    if (!context.retryCount) {
      context.retryCount = 0;
    }
    
    if (context.retryCount >= this.maxRetries) {
      return {
        status: RecoveryStatus.FAILURE,
        message: `Maximum retries (${this.maxRetries}) exceeded`,
        error
      };
    }
    
    // Calculate delay with exponential backoff if enabled
    const delay = this.exponentialBackoff
      ? this.initialDelay * Math.pow(2, context.retryCount)
      : this.initialDelay;
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Increment retry count
    context.retryCount++;
    
    try {
      // Retry the operation
      const result = await context.operation(context.operationParams || {});
      
      return {
        status: RecoveryStatus.SUCCESS,
        message: `Successfully recovered after ${context.retryCount} retries`,
        result
      };
    } catch (retryError) {
      // If this still fails, try again with the same strategy
      return this.recover(retryError, context);
    }
  }
}

/**
 * Fallback recovery strategy
 */
export class FallbackStrategy extends BaseRecoveryStrategy {
  /**
   * Create a new fallback strategy
   * @param {Object} options - Strategy options
   * @param {Function} [options.fallbackProvider] - Function to provide fallback value
   * @param {any} [options.staticFallback] - Static fallback value
   * @param {Array<string>} [options.applicableCategories] - Error categories for which this fallback applies
   */
  constructor(options = {}) {
    super('fallback', options);
    
    this.fallbackProvider = options.fallbackProvider;
    this.staticFallback = options.staticFallback;
    this.applicableCategories = options.applicableCategories || [
      ErrorCategory.CIRCUIT,
      ErrorCategory.PROOF,
      ErrorCategory.VERIFICATION
    ];
  }
  
  /**
   * Check if this strategy can handle a given error
   * @param {Error} error - Error to check
   * @param {Object} context - Error context
   * @returns {boolean} True if this strategy can handle the error
   */
  canHandle(error, context) {
    // Check if the error is in an applicable category
    if (error.category && this.applicableCategories.includes(error.category)) {
      return true;
    }
    
    // Check if we have a fallback
    return Boolean(
      this.fallbackProvider || 
      this.staticFallback !== undefined || 
      (context && context.fallbackValue !== undefined)
    );
  }
  
  /**
   * Attempt to recover using a fallback value
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   * @async
   */
  async recover(error, context) {
    let fallbackValue;
    
    // Try getting fallback from context first
    if (context && context.fallbackValue !== undefined) {
      fallbackValue = context.fallbackValue;
    }
    // Then try using fallback provider if available
    else if (this.fallbackProvider && typeof this.fallbackProvider === 'function') {
      try {
        fallbackValue = await this.fallbackProvider(error, context);
      } catch (fallbackError) {
        return {
          status: RecoveryStatus.FAILURE,
          message: 'Fallback provider failed',
          error: fallbackError
        };
      }
    }
    // Finally fall back to static value
    else if (this.staticFallback !== undefined) {
      fallbackValue = this.staticFallback;
    }
    // No fallback available
    else {
      return {
        status: RecoveryStatus.FAILURE,
        message: 'No fallback value available',
        error
      };
    }
    
    return {
      status: RecoveryStatus.SUCCESS,
      message: 'Recovered using fallback value',
      result: fallbackValue
    };
  }
}

/**
 * Server delegation recovery strategy
 */
export class ServerDelegationStrategy extends BaseRecoveryStrategy {
  /**
   * Create a new server delegation strategy
   * @param {Object} options - Strategy options
   * @param {Function} options.delegatedOperation - Server-side operation to call
   * @param {Array<string>} [options.delegatableCategories] - Error categories that can be delegated
   */
  constructor(options = {}) {
    super('server_delegation', options);
    
    this.delegatedOperation = options.delegatedOperation;
    this.delegatableCategories = options.delegatableCategories || [
      ErrorCategory.MEMORY,
      ErrorCategory.CIRCUIT,
      ErrorCategory.RESOURCE
    ];
  }
  
  /**
   * Check if this strategy can handle a given error
   * @param {Error} error - Error to check
   * @param {Object} context - Error context
   * @returns {boolean} True if this strategy can handle the error
   */
  canHandle(error, context) {
    // Check if the error is in a delegatable category
    if (error.category && this.delegatableCategories.includes(error.category)) {
      return true;
    }
    
    // Check if we have a delegated operation
    return Boolean(
      this.delegatedOperation && 
      typeof this.delegatedOperation === 'function'
    );
  }
  
  /**
   * Attempt to recover by delegating to server
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   * @async
   */
  async recover(error, context) {
    // Get delegated operation from options or context
    const delegatedOperation = this.delegatedOperation || 
      (context && context.delegatedOperation);
    
    if (!delegatedOperation) {
      return {
        status: RecoveryStatus.FAILURE,
        message: 'No delegated operation available',
        error
      };
    }
    
    try {
      // Execute the delegated operation
      const result = await delegatedOperation(context.operationParams || {}, error);
      
      return {
        status: RecoveryStatus.SUCCESS,
        message: 'Successfully recovered by delegating to server',
        result,
        delegated: true
      };
    } catch (delegationError) {
      return {
        status: RecoveryStatus.FAILURE,
        message: 'Server delegation failed',
        error: delegationError
      };
    }
  }
}

/**
 * Cache recovery strategy
 */
export class CacheStrategy extends BaseRecoveryStrategy {
  /**
   * Create a new cache strategy
   * @param {Object} options - Strategy options
   * @param {Object} options.cache - Cache object with get() and set() methods
   * @param {Function} [options.keyGenerator] - Function to generate cache key
   * @param {Array<string>} [options.cacheableCategories] - Error categories for which caching can be used
   */
  constructor(options = {}) {
    super('cache', options);
    
    this.cache = options.cache;
    this.keyGenerator = options.keyGenerator;
    this.cacheableCategories = options.cacheableCategories || [
      ErrorCategory.NETWORK,
      ErrorCategory.SYSTEM
    ];
  }
  
  /**
   * Check if this strategy can handle a given error
   * @param {Error} error - Error to check
   * @param {Object} context - Error context
   * @returns {boolean} True if this strategy can handle the error
   */
  canHandle(error, context) {
    // Check if the error is in a cacheable category
    if (error.category && this.cacheableCategories.includes(error.category)) {
      return true;
    }
    
    // Check if we have a cache and context with cache key or params
    return Boolean(
      this.cache && 
      (context.cacheKey || (context.operationParams && this.keyGenerator))
    );
  }
  
  /**
   * Attempt to recover using cached value
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   * @async
   */
  async recover(error, context) {
    if (!this.cache) {
      return {
        status: RecoveryStatus.FAILURE,
        message: 'No cache available',
        error
      };
    }
    
    // Generate cache key
    const cacheKey = context.cacheKey || 
      (this.keyGenerator && context.operationParams 
        ? this.keyGenerator(context.operationParams) 
        : null);
    
    if (!cacheKey) {
      return {
        status: RecoveryStatus.FAILURE,
        message: 'Could not generate cache key',
        error
      };
    }
    
    try {
      // Try to get value from cache
      const cachedValue = await this.cache.get(cacheKey);
      
      if (cachedValue === undefined || cachedValue === null) {
        return {
          status: RecoveryStatus.FAILURE,
          message: 'No cached value found',
          error
        };
      }
      
      return {
        status: RecoveryStatus.SUCCESS,
        message: 'Recovered using cached value',
        result: cachedValue,
        fromCache: true
      };
    } catch (cacheError) {
      return {
        status: RecoveryStatus.FAILURE,
        message: 'Cache retrieval failed',
        error: cacheError
      };
    }
  }
}

/**
 * Recovery orchestrator that manages strategies and handles errors
 */
export class RecoveryOrchestrator {
  /**
   * Create a new recovery orchestrator
   * @param {Object} options - Orchestrator options
   * @param {Array<BaseRecoveryStrategy>} [options.strategies] - Initial strategies
   */
  constructor(options = {}) {
    this.strategies = new Map();
    
    // Register initial strategies
    if (options.strategies && Array.isArray(options.strategies)) {
      options.strategies.forEach(strategy => {
        this.registerStrategy(strategy);
      });
    }
    
    // Register built-in strategies if none provided
    if (this.strategies.size === 0) {
      this.registerStrategy(new RetryStrategy());
      this.registerStrategy(new FallbackStrategy());
      this.registerStrategy(new ServerDelegationStrategy());
      this.registerStrategy(new CacheStrategy({ cache: new Map() }));
    }
  }
  
  /**
   * Register a recovery strategy
   * @param {BaseRecoveryStrategy} strategy - Strategy to register
   */
  registerStrategy(strategy) {
    if (!(strategy instanceof BaseRecoveryStrategy)) {
      throw new Error('Strategy must be an instance of BaseRecoveryStrategy');
    }
    
    this.strategies.set(strategy.name, strategy);
  }
  
  /**
   * Get a strategy by name
   * @param {string} name - Strategy name
   * @returns {BaseRecoveryStrategy|undefined} Strategy or undefined if not found
   */
  getStrategy(name) {
    return this.strategies.get(name);
  }
  
  /**
   * Find applicable strategies for an error
   * @param {Error} error - Error to check
   * @param {Object} context - Error context
   * @returns {Array<BaseRecoveryStrategy>} Applicable strategies
   */
  findApplicableStrategies(error, context) {
    const applicable = [];
    
    for (const strategy of this.strategies.values()) {
      if (strategy.canHandle(error, context)) {
        applicable.push(strategy);
      }
    }
    
    return applicable;
  }
  
  /**
   * Attempt to recover from an error using all applicable strategies
   * @param {Error} error - Error to recover from
   * @param {Object} context - Error context
   * @returns {Promise<Object>} Recovery result
   * @async
   */
  async recover(error, context = {}) {
    const applicableStrategies = this.findApplicableStrategies(error, context);
    
    if (applicableStrategies.length === 0) {
      return {
        status: RecoveryStatus.UNRECOVERABLE,
        message: 'No applicable recovery strategies found',
        error
      };
    }
    
    // Try strategies in order
    for (const strategy of applicableStrategies) {
      try {
        const result = await strategy.recover(error, context);
        
        if (result.status === RecoveryStatus.SUCCESS) {
          return {
            ...result,
            strategyUsed: strategy.name
          };
        }
      } catch (strategyError) {
        console.error(`Recovery strategy ${strategy.name} failed:`, strategyError);
      }
    }
    
    return {
      status: RecoveryStatus.FAILURE,
      message: 'All recovery strategies failed',
      error,
      strategiesAttempted: applicableStrategies.map(s => s.name)
    };
  }
}

// Create default instance
export const recoveryOrchestrator = new RecoveryOrchestrator();

// Export default for ESM compatibility
export default {
  RecoveryStrategy,
  RecoveryStatus,
  BaseRecoveryStrategy,
  RetryStrategy,
  FallbackStrategy,
  ServerDelegationStrategy,
  CacheStrategy,
  RecoveryOrchestrator,
  recoveryOrchestrator
};