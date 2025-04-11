/**
 * ZK Proxy Client (CommonJS Version)
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

const zkProofGenerator = require('./zkProofGenerator');
const telemetry = require('./telemetry').telemetry;
const detectFeatures = require('./browserCompatibility').detectFeatures;
const snarkjsLoader = require('./snarkjsLoader').snarkjsLoader;

// Import error handling utilities
const zkErrorHandler = require('./zkErrorHandler');
const zkErrorLogger = require('./zkErrorLogger').zkErrorLogger;

// Extract error handling elements
const {
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
} = zkErrorHandler;

// Constants for execution modes
const EXECUTION_MODES = {
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
      
      // Create a promise for this request
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
    } catch (error) {
      // Log and rethrow errors
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
        
        // Execute operation in a non-blocking manner
        this.executeRequest(request)
          .catch(error => {
            // Log any unexpected errors that weren't handled by executeRequest
            if (!isZKError(error)) {
              const zkError = new SystemError(`Unexpected error in queue processing: ${error.message}`, {
                code: ErrorCode.SYSTEM_NOT_INITIALIZED,
                operationId,
                recoverable: true,
                details: { requestId: request.id, originalError: error.message }
              });
              
              zkErrorLogger.logError(zkError, { context: 'RequestQueue.processQueue' });
            } else {
              zkErrorLogger.logError(error, { context: 'RequestQueue.processQueue', requestId: request.id });
            }
          })
          .finally(() => {
            this.activeOperations--;
            this.totalProcessed++;
            // Continue processing if there are more requests
            if (this.queue.length > 0) {
              this.processQueue();
            } else if (this.activeOperations === 0) {
              this.processing = false;
            }
          });
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
      // Wrap error in proper ZKError if needed
      const zkError = isZKError(error) ? error : new SystemError(`Operation error: ${error.message}`, {
        code: ErrorCode.SYSTEM_NOT_INITIALIZED,
        operationId: request.id,
        recoverable: request.critical, // Assume recoverable if marked as critical
        details: { 
          originalError: error.message,
          retryCount: request.retries 
        }
      });
      
      // Log the error
      zkErrorLogger.logError(zkError, { 
        context: 'RequestQueue.executeRequest',
        requestId: request.id,
        critical: request.critical
      });
      
      // Retry critical operations
      if (request.critical && request.retries < 3) {
        request.retries++;
        
        // Add a delay before retrying
        const retryDelay = Math.pow(2, request.retries) * 1000; 
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Log retry attempt
        zkErrorLogger.log('INFO', `Retrying critical operation (attempt ${request.retries})`, {
          requestId: request.id,
          retryDelay,
          operationId: request.id
        });
        
        // Re-queue with higher priority
        this.queue.unshift(request);
        this.processQueue();
        return; // Don't resolve/reject yet
      }
      
      // Reject the promise with the error
      request.rejectRequest(zkError);
      throw zkError; // Re-throw for the caller
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
  
  // ... rest of implementation ...
}

// Create singleton instance
const zkProxyClient = new ZKProxyClient();

// CommonJS exports
module.exports = {
  zkProxyClient,
  ZKProxyClient,
  EXECUTION_MODES,
  RequestQueue,
  RateLimiter
};