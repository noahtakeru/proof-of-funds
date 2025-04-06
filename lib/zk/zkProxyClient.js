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

// Constants for execution modes
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
   */
  enqueue(operation, options = {}) {
    const priority = options.priority || this.priorityLevels.NORMAL;
    
    // Create a promise for this request
    let resolveRequest, rejectRequest;
    const requestPromise = new Promise((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });
    
    // Add request to queue
    const request = {
      id: `req_${Date.now()}_${Math.random().toString(16).slice(2)}`,
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
  }

  /**
   * Process the request queue
   */
  async processQueue() {
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
  }

  /**
   * Execute a queued request
   * 
   * @param {Object} request - The request to execute
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
      // Retry critical operations
      if (request.critical && request.retries < 3) {
        request.retries++;
        
        // Add a delay before retrying
        const retryDelay = Math.pow(2, request.retries) * 1000; 
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Re-queue with higher priority
        this.queue.unshift(request);
        this.processQueue();
        return; // Don't resolve/reject yet
      }
      
      // Reject the promise with the error
      request.rejectRequest(error);
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
   */
  clear() {
    // Reject all queued requests
    this.queue.forEach(request => {
      request.rejectRequest(new Error('Request cancelled: queue cleared'));
    });
    
    this.queue = [];
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
   */
  checkRateLimit(userId) {
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
  }
  
  /**
   * Release a concurrent request slot for a user
   * 
   * @param {string} userId - User identifier
   */
  releaseRequest(userId) {
    if (this.userLimits.has(userId)) {
      const userLimit = this.userLimits.get(userId);
      if (userLimit.concurrentRequests > 0) {
        userLimit.concurrentRequests--;
      }
    }
  }
  
  /**
   * Set custom rate limits for a specific user
   * 
   * @param {string} userId - User identifier
   * @param {Object} limits - Custom rate limits
   */
  setUserLimits(userId, limits) {
    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, { ...this.defaultRateLimit });
    }
    
    const userLimit = this.userLimits.get(userId);
    
    // Apply custom limits
    if (limits.maxRequestsPerMinute) {
      userLimit.maxRequestsPerMinute = limits.maxRequestsPerMinute;
    }
    
    if (limits.maxRequestsPerHour) {
      userLimit.maxRequestsPerHour = limits.maxRequestsPerHour;
    }
    
    if (limits.maxConcurrentRequests) {
      userLimit.maxConcurrentRequests = limits.maxConcurrentRequests;
    }
    
    if (limits.maxBurstRequests) {
      userLimit.maxBurstRequests = limits.maxBurstRequests;
    }
    
    if (limits.burstWindow) {
      userLimit.burstWindow = limits.burstWindow;
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
   */
  async initialize(options = {}) {
    try {
      // Set user ID for rate limiting
      this.userId = options.userId || `user_${Date.now()}`;
      
      // Apply custom user preferences
      if (options.userPreferences) {
        this.userPreferences = {
          ...this.userPreferences,
          ...options.userPreferences
        };
      }
      
      // Override execution mode if specified
      if (options.executionMode) {
        this.executionMode = options.executionMode;
      }
      
      // Detect browser capabilities
      this.capabilities = detectFeatures();
      console.log('ZK Proxy Client initialized with capabilities:', this.capabilities.compatibility);
      
      // Check server availability
      await this.checkServerStatus();
      
      // Based on capabilities and preferences, determine optimal execution mode
      if (this.executionMode === EXECUTION_MODES.AUTO) {
        this.determineOptimalExecutionMode();
      }
      
      // Initialize snarkjs for client-side operations if needed
      if (this.executionMode !== EXECUTION_MODES.SERVER_SIDE) {
        try {
          await snarkjsLoader.initialize();
        } catch (error) {
          console.warn('Failed to initialize snarkjs:', error);
          // If client-side is required but failed to initialize, change mode to server-side
          if (this.executionMode === EXECUTION_MODES.CLIENT_SIDE) {
            console.warn('Falling back to server-side execution');
            this.executionMode = EXECUTION_MODES.SERVER_SIDE;
          }
        }
      }
      
      this.isInitialized = true;
      telemetry.recordOperation({
        operation: 'zkProxyClient.initialize',
        success: true,
        additionalInfo: {
          executionMode: this.executionMode,
          capabilities: this.capabilities.compatibility.level
        }
      });
      
      return true;
    } catch (error) {
      telemetry.recordError('zkProxyClient.initialize', error.message);
      throw error;
    }
  }
  
  /**
   * Check if the server is available for ZK operations
   * 
   * @returns {Promise<boolean>} Server availability
   */
  async checkServerStatus() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/status`);
      if (!response.ok) {
        this.serverAvailable = false;
        return false;
      }
      
      const status = await response.json();
      this.lastServerStatus = status;
      this.serverAvailable = status.available;
      
      return this.serverAvailable;
    } catch (error) {
      console.warn('Failed to check server status:', error);
      this.serverAvailable = false;
      return false;
    }
  }
  
  /**
   * Determine the optimal execution mode based on capabilities and preferences
   */
  determineOptimalExecutionMode() {
    // If user has a preference, honor it
    if (this.userPreferences.preferServerSide) {
      this.executionMode = EXECUTION_MODES.SERVER_SIDE;
      return;
    }
    
    if (this.userPreferences.preferClientSide) {
      // Only honor if client-side is actually viable
      if (this.capabilities.features.webAssembly && this.capabilities.features.webCrypto) {
        this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
        return;
      }
    }
    
    // Check if server is available
    if (!this.serverAvailable) {
      // If server is unavailable but client side is possible, use client side
      if (this.capabilities.features.webAssembly && this.capabilities.features.webCrypto) {
        this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
      } else {
        // Neither server nor client is viable
        throw new Error('ZK operations are not available: server is down and browser does not support required features');
      }
      return;
    }
    
    // Use the recommended path from browser compatibility detection
    switch (this.capabilities.compatibility.recommendedPath) {
      case 'clientSide':
        this.executionMode = EXECUTION_MODES.CLIENT_SIDE;
        break;
      case 'serverSide':
        this.executionMode = EXECUTION_MODES.SERVER_SIDE;
        break;
      case 'hybrid':
      case 'progressiveLoading':
      case 'webWorker':
        this.executionMode = EXECUTION_MODES.HYBRID;
        break;
      default:
        // Default to server side as the safest option
        this.executionMode = EXECUTION_MODES.SERVER_SIDE;
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
        clientInfo: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
          wasmSupported: this.capabilities?.features?.webAssembly || false,
          timestamp: new Date().toISOString(),
          operationId
        }
      };
      
      // Send request to server
      this.reportProgress(operationId, 30, 'Processing on server');
      const response = await fetch(`${this.apiBaseUrl}/fullProve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operation-Id': operationId,
          'X-User-Id': this.userId
        },
        body: JSON.stringify(requestData)
      });
      
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
        
        throw new Error(errorMessage);
      }
      
      this.reportProgress(operationId, 90, 'Receiving proof from server');
      
      // Parse response
      const result = await response.json();
      
      // Release rate limit slot
      this.rateLimiter.releaseRequest(this.userId);
      
      return {
        proof: result.proof,
        publicSignals: result.publicSignals,
        proofType: params.proofType,
        executionTimeMs: result.executionTimeMs || result.serverTiming?.totalTime,
        operationId: result.operationId || operationId,
        isServerSide: true
      };
    } catch (error) {
      // Release rate limit slot even on error
      this.rateLimiter.releaseRequest(this.userId);
      
      telemetry.recordError('generateProofServerSide', error.message);
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
      // Send verification request to server
      const response = await fetch(`${this.apiBaseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operation-Id': operationId,
          'X-User-Id': this.userId
        },
        body: JSON.stringify(params)
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
      
      return {
        verified: result.verified,
        executionTimeMs: result.executionTimeMs || result.serverTiming?.totalTime,
        operationId: result.operationId || operationId,
        isServerSide: true
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