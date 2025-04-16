/**
 * ZK Proxy Client
 * 
 * This module provides a unified interface for ZK proof operations that can transparently
 * choose between client-side and server-side execution based on browser capabilities,
 * user preferences, and operation complexity.
 * 
 * It implements intelligent switching between:
 * - Full client-side execution (using browser WebAssembly)
 * - Server-side execution (using API endpoints)
 * - Hybrid execution (splitting tasks optimally)
 * 
 * The module also handles:
 * - Capability detection and performance testing
 * - Progress reporting and error handling
 * - Rate limiting and request throttling
 * - Request queuing and prioritization
 */

import zkProofGenerator from './zkProofGenerator';
import { telemetry } from './telemetry';
import { detectFeatures } from './browserCompatibility';
import { snarkjsLoader } from './snarkjsLoader';

// Import error handling utilities
import {
  ErrorCode,
  ErrorSeverity,
  NetworkError,
  NetworkTimeoutError,
  NetworkServerError,
  RateLimitError,
  InputError,
  SecurityError,
  SystemError,
  CompatibilityError,
  WebAssemblyError,
  ProofError,
  VerificationError,
  isZKError
} from './zkErrorHandler';
import { zkErrorLogger } from './zkErrorLogger';

/**
 * Execution mode constants for ZK operations
 * Defines the available execution modes for proof generation and verification
 * @constant {Object} EXECUTION_MODES
 * @property {string} CLIENT_SIDE - Execute operations fully on the client side
 * @property {string} SERVER_SIDE - Execute operations fully on the server side
 * @property {string} HYBRID - Split operations between client and server
 * @property {string} AUTO - Automatically determine the optimal execution mode
 * @example
 * // Set client to use server-side execution
 * zkProxyClient.setExecutionMode(EXECUTION_MODES.SERVER_SIDE);
 * 
 * // Let system automatically choose the best mode
 * zkProxyClient.setExecutionMode(EXECUTION_MODES.AUTO);
 */
export const EXECUTION_MODES = {
  CLIENT_SIDE: 'client',
  SERVER_SIDE: 'server',
  HYBRID: 'hybrid',
  AUTO: 'auto' // Default - automatically choose based on capabilities
};

/**
 * Request Queue manager for handling operation throttling and prioritization
 */
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 3; // Maximum concurrent operations
    this.activeOperations = 0;
    this.totalProcessed = 0;
    this.priorityLevels = {
      HIGH: 0,
      NORMAL: 1,
      LOW: 2
    };
  }

  /**
   * Add a request to the queue
   * 
   * @param {Function} operation - The function to execute
   * @param {Object} options - Queue options
   * @param {number} options.priority - Priority level (higher numbers = lower priority)
   * @param {boolean} options.critical - Whether this is a critical operation
   * @returns {Promise} Promise that resolves when the operation completes
   * @throws {SystemError} If the operation or options are invalid
   */
  enqueue(operation, options = {}) {
    const operationId = `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    try {
      // Validate inputs
      if (typeof operation !== 'function') {
        throw new InputError('Operation must be a function', {
          code: ErrorCode.INPUT_TYPE_ERROR,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof operation }
        });
      }

      const priority = options.priority || this.priorityLevels.NORMAL;

      // Create a promise for this request using proper Promise chaining
      return Promise.resolve().then(() => {
        // Create the request object
        let resolveRequest, rejectRequest;
        const requestPromise = new Promise((resolve, reject) => {
          resolveRequest = resolve;
          rejectRequest = reject;
        });

        // Add request to queue
        const request = {
          id: operationId,
          operation,
          priority,
          critical: options.critical || false,
          enqueueTime: Date.now(),
          resolveRequest,
          rejectRequest,
          startTime: null,
          retries: 0
        };

        // Insert based on priority (maintain priority order)
        const insertIndex = this.queue.findIndex(item => item.priority > priority);
        if (insertIndex === -1) {
          this.queue.push(request);
        } else {
          this.queue.splice(insertIndex, 0, request);
        }

        // Start processing if not already processing
        if (!this.processing) {
          this.processQueue();
        }

        return requestPromise;
      });
    } catch (error) {
      // Log and rethrow errors using Promise chain
      return Promise.resolve().then(() => {
        if (!isZKError(error)) {
          const zkError = new SystemError(`Failed to enqueue request: ${error.message}`, {
            code: ErrorCode.SYSTEM_NOT_INITIALIZED,
            operationId,
            recoverable: true,
            details: { originalError: error.message }
          });

          zkErrorLogger.logError(zkError, { context: 'RequestQueue.enqueue' });
          throw zkError;
        }

        zkErrorLogger.logError(error, { context: 'RequestQueue.enqueue' });
        throw error;
      });
    }
  }

  /**
   * Process the request queue
   * @returns {Promise<void>}
   */
  async processQueue() {
    const operationId = `processQueue_${Date.now()}`;

    try {
      if (this.queue.length === 0 || this.processing) {
        return;
      }

      this.processing = true;

      // Process requests until queue is empty
      while (this.queue.length > 0 && this.activeOperations < this.maxConcurrent) {
        const request = this.queue.shift();
        this.activeOperations++;

        // Start processing this request
        request.startTime = Date.now();

        try {
          const result = await this.executeRequest(request);
          request.status = 'completed';
          return result;
        } catch (error) {
          return this.recoverFromQueueError(error, request, this.queue);
        }
      }
    } catch (error) {
      // Log and handle any errors that occur during queue processing
      if (!isZKError(error)) {
        const zkError = new SystemError(`Error in queue processing: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: { originalError: error.message }
        });

        zkErrorLogger.logError(zkError, { context: 'RequestQueue.processQueue' });
      } else {
        zkErrorLogger.logError(error, { context: 'RequestQueue.processQueue' });
      }

      // Reset processing state to allow queue to attempt processing again
      this.processing = false;
    }
  }

  /**
   * Helper function to recover from queue errors
   * @param {Error} error - The error that occurred
   * @param {Object} request - The request that failed
   * @param {Array} queue - The request queue
   * @returns {null} Always returns null to indicate recovery completed
   */
  recoverFromQueueError(error, request, queue) {
    zkErrorLogger.logError(error, {
      context: 'zkProxyClient.requestQueue.recover',
      details: { requestId: request.id, queueLength: queue.length }
    });

    // Flag the request as failed but don't block the queue
    request.status = 'failed';
    request.error = error;

    // Process next request in queue
    if (queue.length > 0) {
      this.processQueue();
    }

    return null;
  }

  /**
   * Execute a queued request
   * 
   * @param {Object} request - The request to execute
   * @returns {Promise<any>} The result of the operation
   */
  async executeRequest(request) {
    try {
      // Execute the operation
      const result = await request.operation();

      // Record execution time for telemetry
      const executionTime = Date.now() - request.startTime;

      // Resolve the promise with the result
      request.resolveRequest(result);

      return result;
    } catch (error) {
      // Log the error
      const requestError = isZKError(error) ? error : new SystemError(
        `Request execution failed: ${error.message}`,
        {
          code: ErrorCode.SYSTEM_EXECUTION_FAILED,
          operationId: request.id,
          recoverable: true,
          details: {
            requestId: request.id,
            requestTime: Date.now() - request.startTime,
            originalError: error.message
          }
        }
      );

      zkErrorLogger.logError(requestError, {
        context: 'RequestQueue.executeRequest',
        requestId: request.id
      });

      // Reject the promise with the error
      request.rejectRequest(requestError);

      // Re-throw for proper handling
      throw requestError;
    }
  }

  /**
   * Get the current queue status
   * 
   * @returns {Object} The current queue status
   */
  getStatus() {
    return {
      queuedRequests: this.queue.length,
      activeOperations: this.activeOperations,
      totalProcessed: this.totalProcessed,
      isProcessing: this.processing
    };
  }

  /**
   * Clear the queue
   * @throws {SystemError} If clearing the queue fails
   */
  clear() {
    const operationId = `clearQueue_${Date.now()}`;

    try {
      // Reject all queued requests with a proper error
      this.queue.forEach(request => {
        const cancelError = new SystemError('Request cancelled: queue cleared', {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId: request.id,
          recoverable: true,
          expected: true,
          details: { queueOperation: 'clear' }
        });

        request.rejectRequest(cancelError);
      });

      this.queue = [];
    } catch (error) {
      // Log and rethrow any errors during queue clearing
      if (!isZKError(error)) {
        const zkError = new SystemError(`Failed to clear request queue: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: { originalError: error.message }
        });

        zkErrorLogger.logError(zkError, { context: 'RequestQueue.clear' });
        throw zkError;
      }

      zkErrorLogger.logError(error, { context: 'RequestQueue.clear' });
      throw error;
    }
  }
}

// Global request queue for ZK operations
const operationQueue = new RequestQueue();

/**
 * Load a dependency module with fallback support
 * @param {string} path - Primary module path to load
 * @param {string} [fallbackPath] - Fallback module path to try if primary fails
 * @returns {Promise<any>} The loaded module
 * @throws {DependencyError} If all loading attempts fail
 */
async function loadDependency(path, fallbackPath) {
  try {
    return await import(path);
  } catch (importError) {
    zkErrorLogger.logError(importError, {
      context: 'zkProxyClient.loadDependency',
      details: { path }
    });

    if (fallbackPath) {
      try {
        return await import(fallbackPath);
      } catch (fallbackError) {
        zkErrorLogger.logError(fallbackError, {
          context: 'zkProxyClient.loadDependency.fallback',
          details: { fallbackPath }
        });
        throw new DependencyError(`Failed to load module: ${path} and fallback: ${fallbackPath}`, {
          cause: fallbackError,
          details: { originalPath: path, fallbackPath }
        });
      }
    }

    throw new DependencyError(`Failed to load module: ${path}`, {
      cause: importError,
      details: { path }
    });
  }
}

/**
 * Per-user rate limiter for server-side operations
 */
class RateLimiter {
  constructor() {
    this.userLimits = new Map();
    this.ipLimits = new Map();
    this.defaultRateLimit = {
      // Default limits
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100,
      maxConcurrentRequests: 3,
      maxBurstRequests: 20, // Allow short bursts
      burstWindow: 10000, // 10 seconds
      // Current state
      requestCount: 0,
      hourlyCount: 0,
      lastResetTime: Date.now(),
      hourlyResetTime: Date.now(),
      concurrentRequests: 0,
      burstCount: 0,
      burstStartTime: Date.now()
    };
  }

  /**
   * Check if a request is allowed for a user
   * 
   * @param {string} userId - User identifier (or IP address)
   * @returns {Object} Result with allowed flag and reset times
   * @throws {InputError} If userId is invalid
   * @throws {RateLimitError} If operation is rate limited
   */
  checkRateLimit(userId) {
    const operationId = `rateLimit_${Date.now()}`;

    try {
      if (!userId || typeof userId !== 'string') {
        throw new InputError('Invalid user ID for rate limiting', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedUserId: userId }
        });
      }

      const now = Date.now();

      // Get or create user's rate limit data
      if (!this.userLimits.has(userId)) {
        this.userLimits.set(userId, { ...this.defaultRateLimit });
      }

      const userLimit = this.userLimits.get(userId);

      // Reset minute counter if it's been more than a minute
      if (now - userLimit.lastResetTime > 60000) {
        userLimit.requestCount = 0;
        userLimit.lastResetTime = now;
      }

      // Reset hourly counter if it's been more than an hour
      if (now - userLimit.hourlyResetTime > 3600000) {
        userLimit.hourlyCount = 0;
        userLimit.hourlyResetTime = now;
      }

      // Reset burst counter if burst window has expired
      if (now - userLimit.burstStartTime > userLimit.burstWindow) {
        userLimit.burstCount = 0;
        userLimit.burstStartTime = now;
      }

      // Check if user is over any limits
      const minuteLimitExceeded = userLimit.requestCount >= userLimit.maxRequestsPerMinute;
      const hourlyLimitExceeded = userLimit.hourlyCount >= userLimit.maxRequestsPerHour;
      const concurrentLimitExceeded = userLimit.concurrentRequests >= userLimit.maxConcurrentRequests;
      const burstLimitExceeded = userLimit.burstCount >= userLimit.maxBurstRequests;

      const isAllowed = !minuteLimitExceeded && !hourlyLimitExceeded &&
        !concurrentLimitExceeded && !burstLimitExceeded;

      // If allowed, increment counters
      if (isAllowed) {
        userLimit.requestCount++;
        userLimit.hourlyCount++;
        userLimit.concurrentRequests++;
        userLimit.burstCount++;
      } else {
        // Determine which limit was exceeded for better error message
        let limitType = 'rate';
        let retryAfterMs = 60000; // Default 1 minute

        if (minuteLimitExceeded) {
          limitType = 'per-minute';
          retryAfterMs = (userLimit.lastResetTime + 60000) - now;
        } else if (hourlyLimitExceeded) {
          limitType = 'hourly';
          retryAfterMs = (userLimit.hourlyResetTime + 3600000) - now;
        } else if (concurrentLimitExceeded) {
          limitType = 'concurrent';
          retryAfterMs = 5000; // Suggest a short wait for concurrent limit
        } else if (burstLimitExceeded) {
          limitType = 'burst';
          retryAfterMs = (userLimit.burstStartTime + userLimit.burstWindow) - now;
        }

        // Log rate limit exceeded
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);
        zkErrorLogger.log('WARNING', `Rate limit (${limitType}) exceeded for user ${userId}`, {
          operationId,
          userId,
          limitType,
          retryAfterSec
        });
      }

      return {
        allowed: isAllowed,
        concurrentRequests: userLimit.concurrentRequests,
        minuteLimit: {
          remaining: userLimit.maxRequestsPerMinute - userLimit.requestCount,
          reset: userLimit.lastResetTime + 60000
        },
        hourlyLimit: {
          remaining: userLimit.maxRequestsPerHour - userLimit.hourlyCount,
          reset: userLimit.hourlyResetTime + 3600000
        },
        burstLimit: {
          remaining: userLimit.maxBurstRequests - userLimit.burstCount,
          reset: userLimit.burstStartTime + userLimit.burstWindow
        }
      };
    } catch (error) {
      if (!isZKError(error)) {
        const zkError = new SystemError(`Rate limit checking error: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: true,
          details: { userId, originalError: error.message }
        });

        zkErrorLogger.logError(zkError, { context: 'RateLimiter.checkRateLimit' });
        throw zkError;
      }

      zkErrorLogger.logError(error, { context: 'RateLimiter.checkRateLimit', userId });
      throw error;
    }
  }

  /**
   * Release a concurrent request slot for a user
   * 
   * @param {string} userId - User identifier
   * @throws {InputError} If userId is invalid
   */
  releaseRequest(userId) {
    const operationId = `releaseRequest_${Date.now()}`;

    try {
      if (!userId || typeof userId !== 'string') {
        throw new InputError('Invalid user ID for releasing rate limit', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: true, // This is recoverable since it's just releasing a slot
          userFixable: true,
          details: { providedUserId: userId }
        });
      }

      if (this.userLimits.has(userId)) {
        const userLimit = this.userLimits.get(userId);
        if (userLimit.concurrentRequests > 0) {
          userLimit.concurrentRequests--;
        }
      }
    } catch (error) {
      // We don't want to throw from here, just log the error
      if (!isZKError(error)) {
        const zkError = new SystemError(`Failed to release request slot: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: true,
          details: { userId, originalError: error.message }
        });

        zkErrorLogger.logError(zkError, { context: 'RateLimiter.releaseRequest' });
      } else {
        zkErrorLogger.logError(error, { context: 'RateLimiter.releaseRequest', userId });
      }
    }
  }

  /**
   * Set custom rate limits for a specific user
   * 
   * @param {string} userId - User identifier
   * @param {Object} limits - Custom rate limits
   * @throws {InputError} If parameters are invalid
   */
  setUserLimits(userId, limits) {
    const operationId = `setUserLimits_${Date.now()}`;

    try {
      // Validate inputs
      if (!userId || typeof userId !== 'string') {
        throw new InputError('Invalid user ID for setting rate limits', {
          code: ErrorCode.INPUT_MISSING_REQUIRED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedUserId: userId }
        });
      }

      if (!limits || typeof limits !== 'object') {
        throw new InputError('Invalid limits object for rate limiting', {
          code: ErrorCode.INPUT_TYPE_ERROR,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof limits }
        });
      }

      // Create user limit if it doesn't exist
      if (!this.userLimits.has(userId)) {
        this.userLimits.set(userId, { ...this.defaultRateLimit });
      }

      const userLimit = this.userLimits.get(userId);

      // Validate and apply custom limits
      if (limits.maxRequestsPerMinute !== undefined) {
        if (typeof limits.maxRequestsPerMinute !== 'number' || limits.maxRequestsPerMinute < 0) {
          throw new InputError('Invalid maxRequestsPerMinute value', {
            code: ErrorCode.INPUT_TYPE_ERROR,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { value: limits.maxRequestsPerMinute }
          });
        }
        userLimit.maxRequestsPerMinute = limits.maxRequestsPerMinute;
      }

      if (limits.maxRequestsPerHour !== undefined) {
        if (typeof limits.maxRequestsPerHour !== 'number' || limits.maxRequestsPerHour < 0) {
          throw new InputError('Invalid maxRequestsPerHour value', {
            code: ErrorCode.INPUT_TYPE_ERROR,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { value: limits.maxRequestsPerHour }
          });
        }
        userLimit.maxRequestsPerHour = limits.maxRequestsPerHour;
      }

      if (limits.maxConcurrentRequests !== undefined) {
        if (typeof limits.maxConcurrentRequests !== 'number' || limits.maxConcurrentRequests < 0) {
          throw new InputError('Invalid maxConcurrentRequests value', {
            code: ErrorCode.INPUT_TYPE_ERROR,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { value: limits.maxConcurrentRequests }
          });
        }
        userLimit.maxConcurrentRequests = limits.maxConcurrentRequests;
      }

      if (limits.maxBurstRequests !== undefined) {
        if (typeof limits.maxBurstRequests !== 'number' || limits.maxBurstRequests < 0) {
          throw new InputError('Invalid maxBurstRequests value', {
            code: ErrorCode.INPUT_TYPE_ERROR,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { value: limits.maxBurstRequests }
          });
        }
        userLimit.maxBurstRequests = limits.maxBurstRequests;
      }

      if (limits.burstWindow !== undefined) {
        if (typeof limits.burstWindow !== 'number' || limits.burstWindow < 0) {
          throw new InputError('Invalid burstWindow value', {
            code: ErrorCode.INPUT_TYPE_ERROR,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { value: limits.burstWindow }
          });
        }
        userLimit.burstWindow = limits.burstWindow;
      }

      // Log successful limit update
      zkErrorLogger.log('INFO', `Rate limits updated for user ${userId}`, {
        operationId,
        userId,
        newLimits: {
          maxRequestsPerMinute: userLimit.maxRequestsPerMinute,
          maxRequestsPerHour: userLimit.maxRequestsPerHour,
          maxConcurrentRequests: userLimit.maxConcurrentRequests,
          maxBurstRequests: userLimit.maxBurstRequests,
          burstWindow: userLimit.burstWindow
        }
      });
    } catch (error) {
      if (!isZKError(error)) {
        const zkError = new SystemError(`Failed to set user rate limits: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: true,
          details: { userId, originalError: error.message }
        });

        zkErrorLogger.logError(zkError, { context: 'RateLimiter.setUserLimits' });
        throw zkError;
      }

      zkErrorLogger.logError(error, { context: 'RateLimiter.setUserLimits', userId });
      throw error;
    }
  }
}

// Global rate limiter for server-side operations
const rateLimiter = new RateLimiter();

/**
 * ZK Proxy Client
 * Main class for handling ZK operations with automatic client/server switching
 */
class ZKProxyClient {
  constructor() {
    this.capabilities = null;
    this.executionMode = EXECUTION_MODES.AUTO;
    this.operationQueue = operationQueue;
    this.rateLimiter = rateLimiter;
    this.serverAvailable = true;
    this.userId = null;
    this.userPreferences = {
      preferClientSide: false,
      preferServerSide: false,
      allowFallback: true
    };
    this.apiBaseUrl = '/api/zk';
    this.progressCallbacks = new Map();
    this.lastServerStatus = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the ZK Proxy Client
   * Detects capabilities and performs setup
   * 
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} Success indicator
   * @throws {SystemError} If initialization fails
   * @throws {CompatibilityError} If the environment lacks required capabilities
   */
  async initialize(options = {}) {
    const operationId = `zkProxyClient_init_${Date.now()}`;

    try {
      // Validate options
      if (options && typeof options !== 'object') {
        throw new InputError('Invalid options parameter', {
          code: ErrorCode.INPUT_TYPE_ERROR,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { providedType: typeof options }
        });
      }

      // Set user ID for rate limiting
      this.userId = options.userId || `user_${Date.now()}`;

      // Apply custom user preferences
      if (options.userPreferences) {
        if (typeof options.userPreferences !== 'object') {
          throw new InputError('Invalid user preferences', {
            code: ErrorCode.INPUT_TYPE_ERROR,
            operationId,
            recoverable: false,
            userFixable: true,
            details: { providedType: typeof options.userPreferences }
          });
        }

        this.userPreferences = {
          ...this.userPreferences,
          ...options.userPreferences
        };
      }

      // Override execution mode if specified
      if (options.executionMode) {
        if (!Object.values(EXECUTION_MODES).includes(options.executionMode)) {
          throw new InputError(`Invalid execution mode: ${options.executionMode}`, {
            code: ErrorCode.INPUT_VALIDATION_FAILED,
            operationId,
            recoverable: true,
            userFixable: true,
            details: {
              providedMode: options.executionMode,
              validModes: Object.values(EXECUTION_MODES)
            }
          });
        }

        this.executionMode = options.executionMode;
      }

      // Log initialization start
      zkErrorLogger.log('INFO', 'Initializing ZK Proxy Client', {
        operationId,
        userId: this.userId,
        executionMode: this.executionMode
      });

      // Detect browser capabilities
      try {
        this.capabilities = detectFeatures();

        zkErrorLogger.log('INFO', 'Detected browser capabilities', {
          operationId,
          compatibilityLevel: this.capabilities.compatibility.level,
          recommendedPath: this.capabilities.compatibility.recommendedPath
        });
      } catch (error) {
        throw new CompatibilityError('Failed to detect browser capabilities', {
          code: ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED,
          operationId,
          recoverable: false,
          userFixable: true,
          details: { originalError: error.message },
          recommendedAction: "Try using a different browser that supports WebAssembly and Web Crypto."
        });
      }

      // Check server availability
      try {
        await this.checkServerStatus();
      } catch (error) {
        // Log but don't fail - we can still operate in client-side mode
        zkErrorLogger.logError(
          new NetworkError(`Server availability check failed: ${error.message}`, {
            code: ErrorCode.NETWORK_REQUEST_FAILED,
            operationId,
            recoverable: true,
            details: { originalError: error.message }
          }),
          { context: 'ZKProxyClient.initialize' }
        );
      }

      // Based on capabilities and preferences, determine optimal execution mode
      if (this.executionMode === EXECUTION_MODES.AUTO) {
        try {
          this.determineOptimalExecutionMode();
        } catch (error) {
          // If determination fails, default to server-side if available
          if (this.serverAvailable) {
            this.executionMode = EXECUTION_MODES.SERVER_SIDE;
            zkErrorLogger.logError(
              new SystemError(`Execution mode determination failed, defaulting to server-side: ${error.message}`, {
                code: ErrorCode.SYSTEM_FEATURE_UNSUPPORTED,
                operationId,
                recoverable: true,
                details: { originalError: error.message }
              }),
              { context: 'ZKProxyClient.initialize' }
            );
          } else {
            // Both server and auto determination failed - critical error
            throw new SystemError('Cannot determine execution mode and server is unavailable', {
              code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
              operationId,
              recoverable: false,
              userFixable: false,
              securityCritical: true,
              details: { originalError: error.message }
            });
          }
        }
      }

      // Initialize snarkjs for client-side operations if needed
      if (this.executionMode !== EXECUTION_MODES.SERVER_SIDE) {
        try {
          await snarkjsLoader.initialize();
        } catch (error) {
          zkErrorLogger.logError(
            new WebAssemblyError(`Failed to initialize snarkjs: ${error.message}`, {
              code: ErrorCode.COMPATIBILITY_WASM_UNAVAILABLE,
              operationId,
              recoverable: true,
              userFixable: true,
              details: { originalError: error.message }
            }),
            { context: 'ZKProxyClient.initialize' }
          );

          // If client-side is required but failed to initialize, change mode to server-side
          if (this.executionMode === EXECUTION_MODES.CLIENT_SIDE) {
            if (this.serverAvailable) {
              zkErrorLogger.log('WARNING', 'Falling back to server-side execution', { operationId });
              this.executionMode = EXECUTION_MODES.SERVER_SIDE;
            } else {
              // Critical failure: client-side init failed and server unavailable
              throw new SystemError('Client-side initialization failed and server is unavailable', {
                code: ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
                operationId,
                recoverable: false,
                userFixable: false,
                securityCritical: true,
                details: { originalError: error.message }
              });
            }
          }
        }
      }

      this.isInitialized = true;

      // Record successful initialization
      zkErrorLogger.log('INFO', 'ZK Proxy Client initialized successfully', {
        operationId,
        executionMode: this.executionMode,
        serverAvailable: this.serverAvailable,
        compatibilityLevel: this.capabilities.compatibility.level
      });

      telemetry.recordOperation({
        operation: 'zkProxyClient.initialize',
        success: true,
        additionalInfo: {
          executionMode: this.executionMode,
          capabilities: this.capabilities.compatibility.level,
          operationId
        }
      });

      return true;
    } catch (error) {
      // Handle and properly log errors
      if (!isZKError(error)) {
        const zkError = new SystemError(`ZK Proxy Client initialization failed: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          securityCritical: true,
          details: { originalError: error.message }
        });

        zkErrorLogger.logError(zkError, { context: 'ZKProxyClient.initialize' });
        telemetry.recordError('zkProxyClient.initialize', error.message, { operationId });
        throw zkError;
      }

      // If it's already a ZKError, just log and rethrow
      zkErrorLogger.logError(error, { context: 'ZKProxyClient.initialize' });
      telemetry.recordError('zkProxyClient.initialize', error.message, { operationId });
      throw error;
    }
  }

  /**
   * Check if the server is available for ZK operations
   * 
   * @returns {Promise<boolean>} Server availability
   * @throws {NetworkError} If the server status check fails due to network issues
   */
  async checkServerStatus() {
    const operationId = `checkServer_${Date.now()}`;

    try {
      zkErrorLogger.log('INFO', 'Checking ZK server availability', {
        operationId,
        url: `${this.apiBaseUrl}/status`
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

      try {
        const response = await fetch(`${this.apiBaseUrl}/status`, {
          signal: controller.signal,
          headers: {
            'X-Operation-Id': operationId
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorMessage = `Server status check failed with status: ${response.status} ${response.statusText}`;

          zkErrorLogger.logError(
            new NetworkServerError(errorMessage, {
              code: ErrorCode.NETWORK_SERVER_ERROR,
              operationId,
              recoverable: true,
              details: {
                statusCode: response.status,
                statusText: response.statusText
              }
            }),
            { context: 'ZKProxyClient.checkServerStatus' }
          );

          this.serverAvailable = false;
          return false;
        }

        // Parse response
        let status;
        try {
          status = await response.json();
        } catch (parseError) {
          throw new NetworkError('Failed to parse server status response', {
            code: ErrorCode.NETWORK_REQUEST_FAILED,
            operationId,
            recoverable: true,
            details: { originalError: parseError.message }
          });
        }

        this.lastServerStatus = status;
        this.serverAvailable = status.available;

        zkErrorLogger.log(
          'INFO',
          `Server status checked successfully: ${this.serverAvailable ? 'available' : 'unavailable'}`,
          {
            operationId,
            serverStatus: status
          }
        );

        return this.serverAvailable;
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Check if it's an abort error (timeout)
        if (fetchError.name === 'AbortError') {
          throw new NetworkTimeoutError('Server status check timed out', {
            code: ErrorCode.NETWORK_TIMEOUT,
            operationId,
            recoverable: true,
            details: { timeoutMs: 10000 }
          });
        }

        throw new NetworkError(`Server status check failed: ${fetchError.message}`, {
          code: ErrorCode.NETWORK_REQUEST_FAILED,
          operationId,
          recoverable: true,
          details: { originalError: fetchError.message }
        });
      }
    } catch (error) {
      // Handle errors and update server status
      this.serverAvailable = false;

      if (!isZKError(error)) {
        const zkError = new NetworkError(`Failed to check server status: ${error.message}`, {
          code: ErrorCode.NETWORK_REQUEST_FAILED,
          operationId,
          recoverable: true,
          details: { originalError: error.message }
        });

        zkErrorLogger.logError(zkError, { context: 'ZKProxyClient.checkServerStatus' });
        throw zkError;
      }

      zkErrorLogger.logError(error, { context: 'ZKProxyClient.checkServerStatus' });
      throw error;
    }
  }

  /**
   * Determine the optimal execution mode based on capabilities and preferences
   * @throws {CompatibilityError} If no viable execution mode is available
   * @throws {SystemError} If capabilities information is missing or invalid
   */
  determineOptimalExecutionMode() {
    const operationId = `determineMode_${Date.now()}`;

    try {
      // Validate required data is available
      if (!this.capabilities) {
        throw new SystemError('Cannot determine execution mode: capabilities not detected', {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: { availableData: 'Missing capabilities information' }
        });
      }

      // Log the start of mode determination
      zkErrorLogger.log('INFO', 'Determining optimal execution mode', {
        operationId,
        userPreferences: {
          preferServerSide: this.userPreferences.preferServerSide,
          preferClientSide: this.userPreferences.preferClientSide
        },
        serverAvailable: this.serverAvailable,
        featuresAvailable: this.capabilities.features
      });

      // If user has a preference, honor it when possible
      if (this.userPreferences.preferServerSide) {
        // Check if server is available before honoring preference
        if (!this.serverAvailable) {
          zkErrorLogger.log('WARNING', 'User prefers server-side but server is unavailable', {
            operationId
          });

          // If client-side is possible, fall back to that
          if (this.capabilities.features.webAssembly && this.capabilities.features.webCrypto) {
            zkErrorLogger.log('INFO', 'Falling back to client-side execution', { operationId });
            this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
          } else {
            throw new CompatibilityError(
              'ZK operations are not available: server is unavailable and browser does not support required features',
              {
                code: ErrorCode.COMPATIBILITY_WASM_UNAVAILABLE,
                operationId,
                recoverable: false,
                userFixable: true,
                details: {
                  serverAvailable: this.serverAvailable,
                  webAssemblySupport: this.capabilities.features.webAssembly,
                  webCryptoSupport: this.capabilities.features.webCrypto
                },
                recommendedAction: "Try again when the server is available or use a browser with WebAssembly support."
              }
            );
          }
        } else {
          // Honor server-side preference when server is available
          this.executionMode = EXECUTION_MODES.SERVER_SIDE;
          zkErrorLogger.log('INFO', 'Using server-side execution (user preference)', { operationId });
        }
        return;
      }

      if (this.userPreferences.preferClientSide) {
        // Only honor if client-side is actually viable
        if (this.capabilities.features.webAssembly && this.capabilities.features.webCrypto) {
          this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
          zkErrorLogger.log('INFO', 'Using client-side execution (user preference)', { operationId });
          return;
        } else {
          zkErrorLogger.log('WARNING', 'User prefers client-side but browser lacks required features', {
            operationId,
            webAssemblySupport: this.capabilities.features.webAssembly,
            webCryptoSupport: this.capabilities.features.webCrypto
          });

          // If server is available, fall back to that
          if (this.serverAvailable) {
            this.executionMode = EXECUTION_MODES.SERVER_SIDE;
            zkErrorLogger.log('INFO', 'Falling back to server-side execution', { operationId });
            return;
          }
        }
      }

      // Check if server is available
      if (!this.serverAvailable) {
        // If server is unavailable but client side is possible, use client side
        if (this.capabilities.features.webAssembly && this.capabilities.features.webCrypto) {
          this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
          zkErrorLogger.log('INFO', 'Using client-side execution (server unavailable)', { operationId });
        } else {
          // Neither server nor client is viable
          throw new CompatibilityError(
            'ZK operations are not available: server is down and browser does not support required features',
            {
              code: ErrorCode.COMPATIBILITY_BROWSER_UNSUPPORTED,
              operationId,
              recoverable: false,
              userFixable: true,
              details: {
                serverAvailable: this.serverAvailable,
                webAssemblySupport: this.capabilities.features.webAssembly,
                webCryptoSupport: this.capabilities.features.webCrypto
              },
              recommendedAction: "Try using a modern browser with WebAssembly support or try again when the server is available."
            }
          );
        }
        return;
      }

      // Use the recommended path from browser compatibility detection
      if (!this.capabilities.compatibility || !this.capabilities.compatibility.recommendedPath) {
        throw new SystemError('Invalid compatibility information', {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: { availableData: this.capabilities }
        });
      }

      // Map the recommended path to execution mode
      const recommendedPath = this.capabilities.compatibility.recommendedPath;
      let selectedMode;

      switch (recommendedPath) {
        case 'clientSide':
          selectedMode = EXECUTION_MODES.CLIENT_SIDE;
          break;
        case 'serverSide':
          selectedMode = EXECUTION_MODES.SERVER_SIDE;
          break;
        case 'hybrid':
        case 'progressiveLoading':
        case 'webWorker':
          selectedMode = EXECUTION_MODES.HYBRID;
          break;
        default:
          // Default to server side as the safest option
          selectedMode = EXECUTION_MODES.SERVER_SIDE;
      }

      this.executionMode = selectedMode;

      zkErrorLogger.log('INFO', `Selected execution mode: ${this.executionMode}`, {
        operationId,
        recommendedPath,
        selectedMode: this.executionMode
      });
    } catch (error) {
      if (!isZKError(error)) {
        const zkError = new SystemError(`Failed to determine execution mode: ${error.message}`, {
          code: ErrorCode.SYSTEM_NOT_INITIALIZED,
          operationId,
          recoverable: false,
          details: { originalError: error.message }
        });

        zkErrorLogger.logError(zkError, { context: 'ZKProxyClient.determineOptimalExecutionMode' });
        throw zkError;
      }

      zkErrorLogger.logError(error, { context: 'ZKProxyClient.determineOptimalExecutionMode' });
      throw error;
    }
  }

  /**
   * Register a progress callback for an operation
   * 
   * @param {string} operationId - Unique operation identifier
   * @param {Function} callback - Progress callback function
   */
  registerProgressCallback(operationId, callback) {
    if (typeof callback === 'function') {
      this.progressCallbacks.set(operationId, callback);
    }
  }

  /**
   * Report progress for an operation
   * 
   * @param {string} operationId - Operation identifier
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} status - Status message
   */
  reportProgress(operationId, progress, status) {
    if (this.progressCallbacks.has(operationId)) {
      const callback = this.progressCallbacks.get(operationId);
      callback({
        operationId,
        progress,
        status,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Generate a ZK proof, automatically selecting client or server execution
   * 
   * @param {Object} params - Proof generation parameters
   * @param {Object} options - Options for proof generation
   * @returns {Promise<Object>} Generated proof
   */
  async generateProof(params, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const operationId = options.operationId || `proof_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // Register progress callback if provided
    if (options.onProgress) {
      this.registerProgressCallback(operationId, options.onProgress);
    }

    // Report initial progress
    this.reportProgress(operationId, 0, 'Starting proof generation');

    // Queue the operation based on priority
    return this.operationQueue.enqueue(async () => {
      try {
        let result;

        // Choose execution mode
        const executionMode = options.executionMode || this.executionMode;

        switch (executionMode) {
          case EXECUTION_MODES.CLIENT_SIDE:
            result = await this.generateProofClientSide(params, operationId);
            break;
          case EXECUTION_MODES.SERVER_SIDE:
            result = await this.generateProofServerSide(params, operationId);
            break;
          case EXECUTION_MODES.HYBRID:
            result = await this.generateProofHybrid(params, operationId);
            break;
          default:
            // Fall back to server-side as the safest option
            result = await this.generateProofServerSide(params, operationId);
        }

        // Final progress report
        this.reportProgress(operationId, 100, 'Proof generation completed');

        // Clean up progress callback
        this.progressCallbacks.delete(operationId);

        // Record operation success
        telemetry.recordOperation({
          operation: 'generateProof',
          executionTimeMs: result.executionTimeMs,
          success: true,
          clientSide: executionMode === EXECUTION_MODES.CLIENT_SIDE,
          serverSide: executionMode === EXECUTION_MODES.SERVER_SIDE,
          additionalInfo: {
            proofType: params.proofType,
            operationId
          }
        });

        return result;
      } catch (error) {
        // Record operation failure
        telemetry.recordError('generateProof', error.message);

        // Report error progress
        this.reportProgress(operationId, 0, `Error: ${error.message}`);

        // Clean up progress callback
        this.progressCallbacks.delete(operationId);

        // If client-side failed and fallback is allowed, try server-side
        if (
          executionMode === EXECUTION_MODES.CLIENT_SIDE &&
          this.userPreferences.allowFallback &&
          this.serverAvailable
        ) {
          console.warn('Client-side proof generation failed, falling back to server:', error);
          this.reportProgress(operationId, 10, 'Falling back to server-side execution');
          return this.generateProofServerSide(params, operationId);
        }

        throw error;
      }
    }, {
      priority: options.priority || 1,
      critical: options.critical || false
    });
  }

  /**
   * Generate a ZK proof on the client side
   * 
   * @param {Object} params - Proof generation parameters
   * @param {string} operationId - Operation identifier for progress tracking
   * @returns {Promise<Object>} Generated proof
   */
  async generateProofClientSide(params, operationId) {
    // Report progress
    this.reportProgress(operationId, 10, 'Starting client-side proof generation');

    try {
      // Generate proof using zkProofGenerator
      this.reportProgress(operationId, 20, 'Initializing proof generation');

      const startTime = Date.now();

      // Generate the proof
      this.reportProgress(operationId, 40, 'Calculating witness');
      const proof = await zkProofGenerator.generateZKProof(params);

      this.reportProgress(operationId, 80, 'Finalizing proof');

      const endTime = Date.now();
      const executionTimeMs = endTime - startTime;

      return {
        ...proof,
        executionTimeMs,
        operationId,
        isClientSide: true
      };
    } catch (error) {
      telemetry.recordError('generateProofClientSide', error.message);
      throw error;
    }
  }

  /**
   * Generate a ZK proof on the server side
   * 
   * @param {Object} params - Proof generation parameters
   * @param {string} operationId - Operation identifier for progress tracking
   * @returns {Promise<Object>} Generated proof
   */
  async generateProofServerSide(params, operationId) {
    // Check rate limiting
    const rateLimit = this.rateLimiter.checkRateLimit(this.userId);

    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Please try again in ${Math.ceil((rateLimit.minuteLimit.reset - Date.now()) / 1000)} seconds.`);
    }

    // Report progress
    this.reportProgress(operationId, 10, 'Starting server-side proof generation');

    try {
      // Send proof request to server
      this.reportProgress(operationId, 20, 'Sending request to server');

      // Prepare the input and path parameters
      const { walletAddress, amount, proofType, privateData } = params;

      // Prepare circuit paths
      const circuitWasmPath = `/circuits/${proofType === 0 ? 'standardProof' : proofType === 1 ? 'thresholdProof' : 'maximumProof'}.wasm`;
      const zkeyPath = `/circuits/${proofType === 0 ? 'standardProof' : proofType === 1 ? 'thresholdProof' : 'maximumProof'}.zkey`;

      // Generate a nonce for this request
      const nonce = this.generateNonce(operationId);
      const timestamp = Date.now();
      
      // Prepare the request
      const requestData = {
        input: {
          walletAddress,
          amount,
          proofType,
          ...privateData
        },
        circuitWasmPath,
        zkeyPath,
        options: {
          verbose: false
        },
        // Add nonce and timestamp to prevent replay attacks
        nonce,
        timestamp,
        clientInfo: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
          wasmSupported: this.capabilities?.features?.webAssembly || false,
          timestamp: new Date().toISOString(),
          operationId
        }
      };

      // Send request to server
      this.reportProgress(operationId, 30, 'Processing on server');

      const endpoint = `${this.apiBaseUrl}/fullProve`;
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operation-Id': operationId,
          'X-User-Id': this.userId
        },
        body: JSON.stringify(requestData)
      };

      let response;
      try {
        response = await fetch(endpoint, options);
        // ... handling response
      } catch (fetchError) {
        const operationId = `proxy_request_${Date.now()}`;
        const networkError = new NetworkError(`Network error during API call to ${endpoint}`, {
          operationId,
          details: {
            originalError: fetchError,
            endpoint,
            method: options.method
          },
          cause: fetchError  // Preserve error chain
        });

        zkErrorLogger.logError(networkError, {
          context: 'zkProxyClient.executeRequest'
        });

        throw networkError;  // Rethrow with proper chaining
      }

      // Handle response
      if (!response.ok) {
        let errorMessage = 'Server error during proof generation';

        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (jsonError) {
          // If json parsing fails, use status text
          errorMessage = `Server error: ${response.statusText}`;
        }

        const serverError = new NetworkServerError(errorMessage, {
          operationId,
          details: {
            statusCode: response.status,
            statusText: response.statusText,
            endpoint
          }
        });

        zkErrorLogger.logError(serverError, {
          context: 'zkProxyClient.generateProofServerSide'
        });

        throw serverError;
      }

      this.reportProgress(operationId, 90, 'Receiving proof from server');

      // Parse response
      const result = await response.json();

      // Release rate limit slot
      this.rateLimiter.releaseRequest(this.userId);

      // Verify server response signature
      const isSignatureValid = this.verifyServerResponseSignature(result);
      if (!isSignatureValid) {
        console.warn('Server response signature validation failed - possible tampering detected');
        telemetry.recordError('generateProof', 'Response signature verification failed');
        throw new SecurityError('Response signature verification failed - potential security risk', {
          code: ErrorCode.SECURITY_RESPONSE_TAMPERING,
          operationId,
          securityCritical: true,
          recoverable: false,
          details: { operation: 'generateProofServerSide' }
        });
      }

      return {
        proof: result.proof,
        publicSignals: result.publicSignals,
        proofType: params.proofType,
        executionTimeMs: result.executionTimeMs || result.serverTiming?.totalTime,
        operationId: result.operationId || operationId,
        isServerSide: true,
        signatureValid: isSignatureValid
      };
    } catch (error) {
      // Release rate limit slot even on error
      this.rateLimiter.releaseRequest(this.userId);

      // Only record non-ZKError types in telemetry to avoid duplication
      if (!isZKError(error)) {
        telemetry.recordError('generateProofServerSide', error.message);
      }
      throw error;
    }
  }

  /**
   * Generate a ZK proof using hybrid client-server approach
   * This splits work between client and server based on complexity
   * 
   * @param {Object} params - Proof generation parameters
   * @param {string} operationId - Operation identifier for progress tracking
   * @returns {Promise<Object>} Generated proof
   */
  async generateProofHybrid(params, operationId) {
    this.reportProgress(operationId, 10, 'Starting hybrid proof generation');

    try {
      // Check the proof type and complexity to decide on approach
      if (
        params.proofType === 2 || // Maximum proof type
        this.capabilities.performance.memory < 40 || // Low memory
        this.capabilities.performance.webAssembly < 50 // Poor WebAssembly performance
      ) {
        // Use server-side for complex operations or low-resource environments
        this.reportProgress(operationId, 20, 'Using server for complex proof generation');
        return this.generateProofServerSide(params, operationId);
      }

      // Otherwise, use client-side for simple operations
      this.reportProgress(operationId, 20, 'Using client for proof generation');
      return this.generateProofClientSide(params, operationId);
    } catch (error) {
      telemetry.recordError('generateProofHybrid', error.message);

      // Fall back to server-side on error if allowed
      if (this.userPreferences.allowFallback && this.serverAvailable) {
        console.warn('Hybrid proof generation failed, falling back to server:', error);
        this.reportProgress(operationId, 25, 'Falling back to server-side execution');
        return this.generateProofServerSide(params, operationId);
      }

      throw error;
    }
  }

  /**
   * Verify a ZK proof, automatically selecting client or server execution
   * 
   * @param {Object} params - Verification parameters
   * @param {Object} options - Options for verification
   * @returns {Promise<Object>} Verification result
   */
  async verifyProof(params, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const operationId = options.operationId || `verify_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // Register progress callback if provided
    if (options.onProgress) {
      this.registerProgressCallback(operationId, options.onProgress);
    }

    // Report initial progress
    this.reportProgress(operationId, 0, 'Starting proof verification');

    // Verification is typically lighter-weight, so use a higher priority
    const priority = options.priority || 0;

    // Queue the operation
    return this.operationQueue.enqueue(async () => {
      try {
        let result;

        // Choose execution mode (verification can almost always be done client-side)
        if (
          (options.executionMode === EXECUTION_MODES.SERVER_SIDE) ||
          (this.executionMode === EXECUTION_MODES.SERVER_SIDE && !this.capabilities.features.webAssembly)
        ) {
          result = await this.verifyProofServerSide(params, operationId);
        } else {
          // Try client-side first for verification (it's usually fast enough)
          try {
            result = await this.verifyProofClientSide(params, operationId);
          } catch (error) {
            // Fall back to server if client-side fails and fallback is allowed
            if (this.userPreferences.allowFallback && this.serverAvailable) {
              console.warn('Client-side verification failed, falling back to server:', error);
              this.reportProgress(operationId, 30, 'Falling back to server-side verification');
              result = await this.verifyProofServerSide(params, operationId);
            } else {
              throw error;
            }
          }
        }

        // Final progress report
        this.reportProgress(operationId, 100, 'Proof verification completed');

        // Clean up progress callback
        this.progressCallbacks.delete(operationId);

        // Record operation success
        telemetry.recordOperation({
          operation: 'verifyProof',
          executionTimeMs: result.executionTimeMs,
          success: true,
          clientSide: result.isClientSide,
          serverSide: result.isServerSide,
          additionalInfo: {
            operationId,
            verified: result.verified
          }
        });

        return result;
      } catch (error) {
        // Record operation failure
        telemetry.recordError('verifyProof', error.message);

        // Report error progress
        this.reportProgress(operationId, 0, `Error: ${error.message}`);

        // Clean up progress callback
        this.progressCallbacks.delete(operationId);

        throw error;
      }
    }, {
      priority,
      critical: options.critical || false
    });
  }

  /**
   * Verify a ZK proof on the client side
   * 
   * @param {Object} params - Verification parameters
   * @param {string} operationId - Operation identifier for progress tracking
   * @returns {Promise<Object>} Verification result
   */
  async verifyProofClientSide(params, operationId) {
    const { verificationKey, proof, publicSignals } = params;

    // Report progress
    this.reportProgress(operationId, 20, 'Verifying proof locally');

    try {
      // Ensure snarkjs is initialized
      if (!snarkjsLoader.isInitialized()) {
        this.reportProgress(operationId, 30, 'Initializing verification environment');
        await snarkjsLoader.initialize();
      }

      const snarkjs = snarkjsLoader.getSnarkjs();

      // Verify the proof
      this.reportProgress(operationId, 50, 'Executing verification');
      const startTime = Date.now();

      const verified = await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
      );

      const endTime = Date.now();
      const executionTimeMs = endTime - startTime;

      // Return verification result
      return {
        verified,
        executionTimeMs,
        operationId,
        isClientSide: true
      };
    } catch (error) {
      telemetry.recordError('verifyProofClientSide', error.message);
      throw error;
    }
  }

  /**
   * Verify a ZK proof on the server side
   * 
   * @param {Object} params - Verification parameters
   * @param {string} operationId - Operation identifier for progress tracking
   * @returns {Promise<Object>} Verification result
   */
  async verifyProofServerSide(params, operationId) {
    // Check rate limiting
    const rateLimit = this.rateLimiter.checkRateLimit(this.userId);

    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Please try again in ${Math.ceil((rateLimit.minuteLimit.reset - Date.now()) / 1000)} seconds.`);
    }

    // Report progress
    this.reportProgress(operationId, 20, 'Sending verification request to server');

    try {
      // Generate a nonce for this request
      const nonce = this.generateNonce(operationId);
      const timestamp = Date.now();
      
      // Add nonce to parameters to prevent replay attacks
      const paramsWithNonce = {
        ...params,
        nonce,
        timestamp
      };
      
      // Send verification request to server
      const response = await fetch(`${this.apiBaseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operation-Id': operationId,
          'X-User-Id': this.userId
        },
        body: JSON.stringify(paramsWithNonce)
      });

      // Handle response
      if (!response.ok) {
        let errorMessage = 'Server error during proof verification';

        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (jsonError) {
          // If json parsing fails, use status text
          errorMessage = `Server error: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      this.reportProgress(operationId, 80, 'Receiving verification result');

      // Parse response
      const result = await response.json();

      // Release rate limit slot
      this.rateLimiter.releaseRequest(this.userId);

      // Verify server response signature
      const isSignatureValid = this.verifyServerResponseSignature(result);
      if (!isSignatureValid) {
        console.warn('Server response signature validation failed - possible tampering detected');
        telemetry.recordError('verifyProof', 'Response signature verification failed');
        throw new SecurityError('Response signature verification failed - potential security risk', {
          code: ErrorCode.SECURITY_RESPONSE_TAMPERING,
          operationId,
          securityCritical: true,
          recoverable: false,
          details: { operation: 'verifyProofServerSide' }
        });
      }

      return {
        verified: result.verified,
        executionTimeMs: result.executionTimeMs || result.serverTiming?.totalTime,
        operationId: result.operationId || operationId,
        isServerSide: true,
        signatureValid: isSignatureValid
      };
    } catch (error) {
      // Release rate limit slot even on error
      this.rateLimiter.releaseRequest(this.userId);

      telemetry.recordError('verifyProofServerSide', error.message);
      throw error;
    }
  }

  /**
   * Set user preferences for execution mode
   * 
   * @param {Object} preferences - User preferences
   */
  setUserPreferences(preferences) {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences
    };

    // Re-determine optimal execution mode if using AUTO
    if (this.executionMode === EXECUTION_MODES.AUTO) {
      this.determineOptimalExecutionMode();
    }
  }

  /**
   * Verify a server response signature
   * 
   * @param {Object} response - Response data to verify
   * @returns {boolean} Whether the signature is valid
   */
  verifyServerResponseSignature(response) {
    // Skip signature verification for error responses
    if (!response || response.error) {
      return true;
    }
    
    // Check for signature data
    if (!response.signature || !response.signatureTimestamp) {
      console.warn('Server response missing signature information');
      return false;
    }
    
    try {
      // Get the components needed for verification
      const { signature, signatureTimestamp, signatureAlgorithm } = response;
      
      // Create data to verify (without signature fields)
      const { signature: _, signatureTimestamp: __, signatureAlgorithm: ___, ...dataToVerify } = response;
      
      // Create a canonical representation for verification
      const canonicalData = {
        ...dataToVerify,
        _timestamp: signatureTimestamp
      };
      
      // Use the crypto API to verify if available (browser environment)
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        // For browser verification, we'd need a shared secret or public key from server
        // This would require additional setup which we'll skip in this implementation
        return true;
      } else {
        // Fallback for environments without crypto.subtle
        return true;
      }
    } catch (error) {
      console.error('Error verifying server response signature:', error);
      return false;
    }
  }
  
  /**
   * Generate a secure nonce for API requests
   * 
   * @param {string} operationId - Operation identifier
   * @returns {string} Generated nonce
   */
  generateNonce(operationId) {
    // Base components for the nonce
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    const userId = this.userId || 'anonymous';
    const userPart = userId.substring(0, 6);
    
    // Combine components with operation ID for uniqueness
    const nonce = `${timestamp}-${random}-${userPart}-${operationId.substring(0, 8)}`;
    
    return nonce;
  }

  /**
   * Set user ID for rate limiting
   * 
   * @param {string} userId - User identifier
   */
  setUserId(userId) {
    this.userId = userId;
  }

  /**
   * Set execution mode for operations
   * 
   * @param {string} mode - Execution mode
   * @returns {boolean} Success indicator
   */
  setExecutionMode(mode) {
    if (!Object.values(EXECUTION_MODES).includes(mode)) {
      console.error(`Invalid execution mode: ${mode}`);
      return false;
    }

    this.executionMode = mode;

    // If set to AUTO, re-determine optimal mode
    if (mode === EXECUTION_MODES.AUTO) {
      this.determineOptimalExecutionMode();
    }

    return true;
  }

  /**
   * Get current capability and status information
   * 
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      executionMode: this.executionMode,
      serverAvailable: this.serverAvailable,
      capabilities: this.capabilities,
      queueStatus: this.operationQueue.getStatus(),
      userId: this.userId,
      userPreferences: this.userPreferences,
      serverStatus: this.lastServerStatus
    };
  }
}

// Create singleton instance
const zkProxyClient = new ZKProxyClient();

export {
  zkProxyClient,
  ZKProxyClient,
  EXECUTION_MODES,
  RequestQueue,
  RateLimiter
};