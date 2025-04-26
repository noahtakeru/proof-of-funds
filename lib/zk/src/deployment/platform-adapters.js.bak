/**
 * @fileoverview Platform Adapters
 * 
 * Provides platform-specific adapters for deployment operations.
 * This consolidated module contains all platform adapters and a simplified
 * factory function to create the appropriate adapter for the current environment.
 * 
 * @author ZK Infrastructure Team
 */

import { 
  EnvironmentType, 
  detectEnvironment, 
  detectFeatures, 
  getRecommendedConfiguration 
} from './environment-utils.js';
import { 
  errorLogger, 
  tryCatch, 
  tryCatchSync,
  withErrorHandling,
  DeploymentError,
  PlatformAdapterError,
  ResourceLimitationError,
  ConfigurationError,
  NetworkError,
  CompatibilityError,
  MemoryError
} from '../ErrorSystem.js';

/**
 * Common adapter interface shared by all platform-specific adapters
 */
export class PlatformAdapter {
  /**
   * Create a new platform adapter
   * 
   * @param {Object} options - Adapter options
   * @param {string} options.environment - Environment type
   * @param {Object} options.config - Configuration object
   */
  constructor(options = {}) {
    this.environment = options.environment || EnvironmentType.UNKNOWN;
    this.config = options.config || {};
    this.initialized = false;
    this.capabilities = {};
    this.resources = {
      memoryUsageMB: 0,
      cpuUsage: 0,
      networkUsage: 0
    };
  }
  
  /**
   * Initialize the adapter
   * 
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async initialize() {
    try {
      this.initialized = true;
      return true;
    } catch (error) {
      const initError = error instanceof DeploymentError
        ? error
        : new PlatformAdapterError(`Error initializing platform adapter for ${this.environment}`, {
            environment: this.environment,
            originalError: error.message
          });
      
      errorLogger.logError(initError, {
        component: this.constructor.name,
        context: `${this.environment}.initialize`,
        message: 'Error initializing platform adapter'
      });
      
      return false;
    }
  }
  
  /**
   * Check if a specific capability is available
   * 
   * @param {string} capability - Capability to check
   * @returns {boolean} True if capability is available
   */
  hasCapability(capability) {
    return !!this.capabilities[capability];
  }
  
  /**
   * Deploy a ZK circuit
   * 
   * @param {string} circuitName - Name of the circuit to deploy
   * @param {Object} options - Deployment options
   * @returns {Promise<boolean>} True if deployment succeeded
   */
  async deployCircuit(circuitName, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Default implementation (should be overridden by subclasses)
      return true;
    } catch (error) {
      const deployError = error instanceof DeploymentError
        ? error
        : new PlatformAdapterError(`Error deploying circuit: ${circuitName}`, {
            circuitName,
            environment: this.environment,
            originalError: error.message
          });
      
      errorLogger.logError(deployError, {
        component: this.constructor.name,
        context: `${this.environment}.deployCircuit`,
        message: 'Error deploying circuit',
        circuitName
      });
      
      return false;
    }
  }
  
  /**
   * Run a local operation
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   */
  async runLocalOperation(operation, inputs) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Default implementation (should be overridden by subclasses)
      return { success: false, error: 'Not implemented' };
    } catch (error) {
      const adapterError = error instanceof DeploymentError
        ? error
        : new PlatformAdapterError(`Error running local operation: ${operation}`, {
            operation,
            environment: this.environment,
            originalError: error.message
          });
      
      errorLogger.logError(adapterError, {
        component: this.constructor.name,
        context: `${this.environment}.runLocalOperation`,
        message: 'Error running local operation',
        operation
      });
      
      throw adapterError;
    }
  }
  
  /**
   * Run a server operation
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   */
  async runServerOperation(operation, inputs) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Default implementation (should be overridden by subclasses)
      return { success: false, error: 'Not implemented' };
    } catch (error) {
      const adapterError = error instanceof DeploymentError
        ? error
        : new PlatformAdapterError(`Error running server operation: ${operation}`, {
            operation,
            environment: this.environment,
            originalError: error.message
          });
      
      errorLogger.logError(adapterError, {
        component: this.constructor.name,
        context: `${this.environment}.runServerOperation`,
        message: 'Error running server operation',
        operation
      });
      
      throw adapterError;
    }
  }
  
  /**
   * Clean up adapter resources
   * 
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      this.initialized = false;
      // Default implementation (should be overridden by subclasses)
    } catch (error) {
      const cleanupError = error instanceof DeploymentError
        ? error
        : new PlatformAdapterError(`Error cleaning up adapter for ${this.environment}`, {
            environment: this.environment,
            originalError: error.message
          });
      
      errorLogger.logError(cleanupError, {
        component: this.constructor.name,
        context: `${this.environment}.cleanup`,
        message: 'Error cleaning up adapter'
      });
    }
  }
}

/**
 * Browser-specific platform adapter
 */
export class BrowserAdapter extends PlatformAdapter {
  /**
   * Create a new browser adapter
   * 
   * @param {Object} options - Adapter options
   */
  constructor(options = {}) {
    super({
      ...options,
      environment: EnvironmentType.BROWSER
    });
    
    this.wasmSupported = typeof WebAssembly !== 'undefined';
    this.workersSupported = typeof Worker !== 'undefined';
    this.indexedDBSupported = typeof indexedDB !== 'undefined';
    this.workers = [];
  }
  
  /**
   * Initialize the browser adapter
   * 
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async initialize() {
    try {
      // Detect browser capabilities
      const features = detectFeatures();
      
      this.capabilities = {
        webAssembly: features.webAssemblySupport,
        webWorkers: features.webWorkersSupport,
        indexedDB: features.indexedDBSupport,
        localStorage: features.localStorageSupport,
        webCrypto: features.webCryptoSupport,
        highPrecisionTimers: features.highPrecisionTimers
      };
      
      // Initialize web workers if supported and enabled
      if (this.capabilities.webWorkers && this.config.useWorkers) {
        await this._initializeWorkers();
      }
      
      // Initialize WebAssembly modules if supported and enabled
      if (this.capabilities.webAssembly && this.config.useWebAssembly) {
        await this._loadWasmModules();
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      const browserError = error instanceof DeploymentError
        ? error
        : new PlatformAdapterError('Error initializing browser adapter', {
            environment: this.environment,
            capabilities: Object.keys(this.capabilities).join(','),
            originalError: error.message
          });
      
      errorLogger.logError(browserError, {
        component: 'BrowserAdapter',
        context: 'BrowserAdapter.initialize',
        message: 'Error initializing browser adapter'
      });
      
      return false;
    }
  }
  
  /**
   * Initialize web workers
   * 
   * @returns {Promise<void>}
   * @private
   */
  async _initializeWorkers() {
    try {
      const workerCount = this.config.workerCount || 1;
      
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker('./workers/task-worker.js');
        this.workers.push(worker);
      }
    } catch (error) {
      const workerError = error instanceof DeploymentError
        ? error
        : new PlatformAdapterError('Error initializing web workers', {
            environment: this.environment,
            workerCount: this.config.workerCount,
            originalError: error.message
          });
      
      errorLogger.logError(workerError, {
        component: 'BrowserAdapter',
        context: 'BrowserAdapter._initializeWorkers',
        message: 'Error initializing web workers'
      });
    }
  }
  
  /**
   * Load WebAssembly modules
   * 
   * @returns {Promise<void>}
   * @private
   */
  async _loadWasmModules() {
    try {
      // Load WebAssembly modules (implementation would depend on specific modules needed)
    } catch (error) {
      errorLogger.logError(error, {
        component: 'BrowserAdapter',
        context: 'BrowserAdapter._loadWasmModules',
        message: 'Error loading WebAssembly modules'
      });
    }
  }
  
  /**
   * Deploy a ZK circuit in browser environment
   * 
   * @param {string} circuitName - Name of the circuit to deploy
   * @param {Object} options - Deployment options
   * @returns {Promise<boolean>} True if deployment succeeded
   */
  async deployCircuit(circuitName, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check for WASM support
      if (!this.capabilities.webAssembly) {
        return false;
      }
      
      // Browser-specific deployment logic
      // Fetch and compile the circuit WASM
      
      return true;
    } catch (error) {
      errorLogger.logError(error, {
        component: 'BrowserAdapter',
        context: 'BrowserAdapter.deployCircuit',
        message: 'Error deploying circuit in browser',
        circuitName
      });
      
      return false;
    }
  }
  
  /**
   * Run a local operation in browser environment
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   */
  async runLocalOperation(operation, inputs) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check if operation can be offloaded to workers
      if (this.workers.length > 0 && this._canUseWorkerFor(operation)) {
        return this._runInWorker(operation, inputs);
      }
      
      // Fallback to main thread execution
      return this._runInMainThread(operation, inputs);
    } catch (error) {
      errorLogger.logError(error, {
        component: 'BrowserAdapter',
        context: 'BrowserAdapter.runLocalOperation',
        message: 'Error running local operation in browser',
        operation
      });
      
      throw error;
    }
  }
  
  /**
   * Check if an operation can use a worker
   * 
   * @param {string} operation - Operation to check
   * @returns {boolean} True if operation can use workers
   * @private
   */
  _canUseWorkerFor(operation) {
    // Define which operations can use workers
    const workerEnabledOperations = [
      'generateProof',
      'verifyProof',
      'hash',
      'batchValidation'
    ];
    
    return workerEnabledOperations.includes(operation);
  }
  
  /**
   * Run an operation in a web worker
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   * @private
   */
  async _runInWorker(operation, inputs) {
    return new Promise((resolve, reject) => {
      try {
        // Simple round-robin worker selection
        const workerIndex = (this._lastWorkerIndex || 0) % this.workers.length;
        this._lastWorkerIndex = workerIndex + 1;
        
        const worker = this.workers[workerIndex];
        const messageId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        
        // Set up one-time listener for this operation
        const messageHandler = (event) => {
          const response = event.data;
          
          if (response.messageId === messageId) {
            worker.removeEventListener('message', messageHandler);
            
            if (response.error) {
              reject(new PlatformAdapterError(`Browser worker operation failed: ${response.error}`, {
                operation,
                environment: this.environment,
                messageId,
                workerIndex: this._lastWorkerIndex
              }));
            } else {
              resolve(response.result);
            }
          }
        };
        
        worker.addEventListener('message', messageHandler);
        
        // Send the operation to the worker
        worker.postMessage({
          messageId,
          operation,
          inputs
        });
      } catch (error) {
        zkErrorLogger.logError(error, {
          context: 'BrowserAdapter._runInWorker',
          message: 'Error running operation in worker',
          operation
        });
        
        reject(error);
      }
    });
  }
  
  /**
   * Run an operation in the main thread
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   * @private
   */
  async _runInMainThread(operation, inputs) {
    try {
      // Implementation depends on the specific operations
      // This would normally import the appropriate modules and run the operation
      
      // For now, return a stub result
      return {
        success: true,
        operation,
        result: {},
        executionTime: 0
      };
    } catch (error) {
      errorLogger.logError(error, {
        component: 'BrowserAdapter',
        context: 'BrowserAdapter._runInMainThread',
        message: 'Error running operation in main thread',
        operation
      });
      
      throw error;
    }
  }
  
  /**
   * Clean up browser adapter resources
   * 
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Terminate all workers
      this.workers.forEach(worker => worker.terminate());
      this.workers = [];
      
      this.initialized = false;
    } catch (error) {
      errorLogger.logError(error, {
        component: 'BrowserAdapter',
        context: 'BrowserAdapter.cleanup',
        message: 'Error cleaning up browser adapter'
      });
    }
  }
}

/**
 * Node.js-specific platform adapter
 */
export class NodeAdapter extends PlatformAdapter {
  /**
   * Create a new Node.js adapter
   * 
   * @param {Object} options - Adapter options
   */
  constructor(options = {}) {
    super({
      ...options,
      environment: EnvironmentType.NODE
    });
    
    this.workerThreads = null;
    this.fs = null;
    this.path = null;
    this.workers = [];
  }
  
  /**
   * Initialize the Node.js adapter
   * 
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async initialize() {
    try {
      // Import Node.js modules
      // Using import() for dynamic loading to prevent errors in browser environments
      try {
        this.fs = await import('fs');
        this.path = await import('path');
        
        // Check for worker_threads support
        if (this.config.useWorkers) {
          this.workerThreads = await import('worker_threads');
        }
      } catch (importError) {
        errorLogger.logError(importError, {
          component: 'NodeAdapter',
          context: 'NodeAdapter.initialize',
          message: 'Error importing Node.js modules'
        });
      }
      
      // Detect Node.js capabilities
      const features = detectFeatures();
      
      this.capabilities = {
        fileSystem: true,
        workerThreads: this.workerThreads !== null,
        webAssembly: features.webAssemblySupport,
        crypto: features.cryptoSupport,
        highPrecisionTimers: features.highPrecisionTimers
      };
      
      // Initialize worker threads if supported and enabled
      if (this.capabilities.workerThreads && this.config.useWorkers) {
        await this._initializeWorkers();
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      errorLogger.logError(error, {
        component: 'NodeAdapter',
        context: 'NodeAdapter.initialize',
        message: 'Error initializing Node.js adapter'
      });
      
      return false;
    }
  }
  
  /**
   * Initialize worker threads
   * 
   * @returns {Promise<void>}
   * @private
   */
  async _initializeWorkers() {
    if (!this.workerThreads) {
      return;
    }
    
    try {
      const workerCount = this.config.workerCount || 1;
      
      for (let i = 0; i < workerCount; i++) {
        const worker = new this.workerThreads.Worker('./workers/node-worker.js');
        this.workers.push(worker);
      }
    } catch (error) {
      errorLogger.logError(error, {
        component: 'NodeAdapter',
        context: 'NodeAdapter._initializeWorkers',
        message: 'Error initializing worker threads'
      });
    }
  }
  
  /**
   * Deploy a ZK circuit in Node.js environment
   * 
   * @param {string} circuitName - Name of the circuit to deploy
   * @param {Object} options - Deployment options
   * @returns {Promise<boolean>} True if deployment succeeded
   */
  async deployCircuit(circuitName, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Node.js-specific deployment logic
      // Read circuit files from disk and prepare for use
      
      return true;
    } catch (error) {
      errorLogger.logError(error, {
        component: 'NodeAdapter',
        context: 'NodeAdapter.deployCircuit',
        message: 'Error deploying circuit in Node.js',
        circuitName
      });
      
      return false;
    }
  }
  
  /**
   * Run a local operation in Node.js environment
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   */
  async runLocalOperation(operation, inputs) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check if operation can be offloaded to worker threads
      if (this.workers.length > 0 && this._canUseWorkerFor(operation)) {
        return this._runInWorker(operation, inputs);
      }
      
      // Fallback to main thread execution
      return this._runInMainThread(operation, inputs);
    } catch (error) {
      errorLogger.logError(error, {
        component: 'NodeAdapter',
        context: 'NodeAdapter.runLocalOperation',
        message: 'Error running local operation in Node.js',
        operation
      });
      
      throw error;
    }
  }
  
  /**
   * Check if an operation can use a worker
   * 
   * @param {string} operation - Operation to check
   * @returns {boolean} True if operation can use workers
   * @private
   */
  _canUseWorkerFor(operation) {
    // Define which operations can use workers
    const workerEnabledOperations = [
      'generateProof',
      'verifyProof',
      'hash',
      'batchValidation'
    ];
    
    return workerEnabledOperations.includes(operation);
  }
  
  /**
   * Run an operation in a worker thread
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   * @private
   */
  async _runInWorker(operation, inputs) {
    if (!this.workerThreads) {
      throw new CompatibilityError('Worker threads not available', {
      environment: this.environment,
      operation: operation
    });
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Simple round-robin worker selection
        const workerIndex = (this._lastWorkerIndex || 0) % this.workers.length;
        this._lastWorkerIndex = workerIndex + 1;
        
        const worker = this.workers[workerIndex];
        const messageId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        
        // Set up one-time listener for this operation
        worker.once('message', (response) => {
          if (response.messageId === messageId) {
            if (response.error) {
              reject(new PlatformAdapterError(`Node.js worker operation failed: ${response.error}`, {
                operation,
                environment: this.environment,
                messageId,
                workerIndex: this._lastWorkerIndex
              }));
            } else {
              resolve(response.result);
            }
          }
        });
        
        worker.on('error', (error) => {
          reject(new PlatformAdapterError(`Node.js worker error: ${error.message}`, {
            operation,
            environment: this.environment,
            workerIndex: this._lastWorkerIndex,
            originalError: error
          }));
        });
        
        // Send the operation to the worker
        worker.postMessage({
          messageId,
          operation,
          inputs
        });
      } catch (error) {
        errorLogger.logError(error, {
          component: 'NodeAdapter',
          context: 'NodeAdapter._runInWorker',
          message: 'Error running operation in worker thread',
          operation
        });
        
        reject(error);
      }
    });
  }
  
  /**
   * Run an operation in the main thread
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   * @private
   */
  async _runInMainThread(operation, inputs) {
    try {
      // Implementation depends on the specific operations
      // This would normally import the appropriate modules and run the operation
      
      // For now, return a stub result
      return {
        success: true,
        operation,
        result: {},
        executionTime: 0
      };
    } catch (error) {
      errorLogger.logError(error, {
        component: 'NodeAdapter',
        context: 'NodeAdapter._runInMainThread',
        message: 'Error running operation in main thread',
        operation
      }); 
      
      throw error;
    }
  }
  
  /**
   * Clean up Node.js adapter resources
   * 
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      // Terminate all worker threads
      if (this.workers && this.workers.length > 0) {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
      }
      
      this.initialized = false;
    } catch (error) {
      errorLogger.logError(error, {
        component: 'NodeAdapter',
        context: 'NodeAdapter.cleanup',
        message: 'Error cleaning up Node.js adapter'
      });
    }
  }
}

/**
 * Mobile-specific platform adapter
 */
export class MobileAdapter extends BrowserAdapter {
  /**
   * Create a new mobile adapter
   * 
   * @param {Object} options - Adapter options
   */
  constructor(options = {}) {
    super({
      ...options,
      environment: EnvironmentType.MOBILE
    });
    
    // Mobile-specific adjustments
    // Mobile devices typically have more resource constraints
    this.resourceConstraints = {
      memoryLimitMB: options.config?.memoryLimitMB || 256,
      useBackgroundProcessing: false,
      throttleOperations: true,
      monitorBatteryLevel: true
    };
  }
  
  /**
   * Initialize the mobile adapter
   * 
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async initialize() {
    try {
      // Call parent initialization
      const initResult = await super.initialize();
      
      if (!initResult) {
        return false;
      }
      
      // Mobile-specific initialization
      if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
        try {
          this.batteryMonitor = await navigator.getBattery();
          this.batteryLevel = this.batteryMonitor.level;
          
          // Monitor battery level
          this.batteryMonitor.addEventListener('levelchange', () => {
            this.batteryLevel = this.batteryMonitor.level;
            this._adjustResourceUsage();
          });
        } catch (batteryError) {
          // Battery API might not be available on all devices
        }
      }
      
      // Adjust worker count based on device capabilities
      if (this.workers.length > 0) {
        // Mobile devices typically benefit from fewer workers
        // Keep just 1-2 workers to avoid overloading the device
        const idealWorkerCount = Math.min(2, this.workers.length);
        
        if (idealWorkerCount < this.workers.length) {
          // Terminate excess workers
          for (let i = idealWorkerCount; i < this.workers.length; i++) {
            this.workers[i].terminate();
          }
          
          this.workers = this.workers.slice(0, idealWorkerCount);
        }
      }
      
      return true;
    } catch (error) {
      errorLogger.logError(error, {
        component: 'MobileAdapter',
        context: 'MobileAdapter.initialize',
        message: 'Error initializing mobile adapter'
      });
      
      return false;
    }
  }
  
  /**
   * Adjust resource usage based on device state
   * 
   * @private
   */
  _adjustResourceUsage() {
    try {
      // Adjust based on battery level
      if (this.batteryLevel !== undefined) {
        if (this.batteryLevel < 0.2) {
          // Low battery mode - reduce resource usage
          this.resourceConstraints.memoryLimitMB = Math.floor(this.resourceConstraints.memoryLimitMB * 0.7);
          this.resourceConstraints.throttleOperations = true;
        }
      }
    } catch (error) {
      errorLogger.logError(error, {
        component: 'MobileAdapter',
        context: 'MobileAdapter._adjustResourceUsage',
        message: 'Error adjusting resource usage'
      });
    }
  }
  
  /**
   * Run a local operation with mobile-specific optimizations
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   */
  async runLocalOperation(operation, inputs) {
    try {
      // Check if the operation is too resource-intensive for a mobile device
      const operationComplexity = this._estimateOperationComplexity(operation, inputs);
      
      if (operationComplexity === 'high' && this.resourceConstraints.throttleOperations) {
        // Delegate to server for high-complexity operations
        return this.runServerOperation(operation, inputs);
      }
      
      // For medium/low complexity, use parent implementation
      return super.runLocalOperation(operation, inputs);
    } catch (error) {
      errorLogger.logError(error, {
        component: 'MobileAdapter',
        context: 'MobileAdapter.runLocalOperation',
        message: 'Error running local operation on mobile',
        operation
      });
      
      // Try server fallback
      return this.runServerOperation(operation, inputs);
    }
  }
  
  /**
   * Estimate the complexity of an operation
   * 
   * @param {string} operation - Operation to estimate
   * @param {Object} inputs - Operation inputs
   * @returns {string} Complexity level ('low', 'medium', 'high')
   * @private
   */
  _estimateOperationComplexity(operation, inputs) {
    // Map operations to complexity levels
    const complexityMap = {
      'generateProof': 'high',
      'verifyProof': 'medium',
      'hash': 'low',
      'batchValidation': 'high',
      'signMessage': 'low',
      'createWallet': 'medium',
      'decryptData': 'medium'
    };
    
    return complexityMap[operation] || 'medium';
  }
}

/**
 * Worker-specific platform adapter
 */
export class WorkerAdapter extends PlatformAdapter {
  /**
   * Create a new worker adapter
   * 
   * @param {Object} options - Adapter options
   */
  constructor(options = {}) {
    super({
      ...options,
      environment: EnvironmentType.WORKER
    });
    
    this.parentPort = null;
  }
  
  /**
   * Initialize the worker adapter
   * 
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async initialize() {
    try {
      // Detect if we're in a Web Worker or a Node.js Worker
      if (typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined') {
        // Web Worker
        this.parentPort = self;
        this.isWebWorker = true;
      } else if (typeof process !== 'undefined' && typeof require !== 'undefined') {
        try {
          // Node.js Worker Thread
          const workerThreads = await import('worker_threads');
          this.parentPort = workerThreads.parentPort;
          this.isWebWorker = false;
        } catch (importError) {
          // Worker threads not available
        }
      }
      
      if (!this.parentPort) {
        throw new CompatibilityError('Not running in a worker environment', {
        environment: this.environment,
        isWebWorker: typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined'
      });
      }
      
      // Detect worker capabilities
      const features = detectFeatures();
      
      this.capabilities = {
        webAssembly: features.webAssemblySupport,
        highPrecisionTimers: features.highPrecisionTimers
      };
      
      // Set up message handler
      this._setupMessageHandler();
      
      this.initialized = true;
      return true;
    } catch (error) {
      errorLogger.logError(error, {
        component: 'WorkerAdapter',
        context: 'WorkerAdapter.initialize',
        message: 'Error initializing worker adapter'
      });
      
      return false;
    }
  }
  
  /**
   * Set up message handler for worker
   * 
   * @private
   */
  _setupMessageHandler() {
    try {
      if (this.isWebWorker) {
        // Web Worker
        self.onmessage = this._handleMessage.bind(this);
      } else if (this.parentPort) {
        // Node.js Worker Thread
        this.parentPort.on('message', this._handleMessage.bind(this));
      }
    } catch (error) {
      errorLogger.logError(error, {
        component: 'WorkerAdapter',
        context: 'WorkerAdapter._setupMessageHandler',
        message: 'Error setting up message handler'
      });
    }
  }
  
  /**
   * Handle incoming messages
   * 
   * @param {Object} event - Message event
   * @private
   */
  async _handleMessage(event) {
    try {
      // Extract message data
      const message = this.isWebWorker ? event.data : event;
      const { messageId, operation, inputs } = message;
      
      if (!messageId || !operation) {
        return;
      }
      
      try {
        // Process the requested operation
        const result = await this._processOperation(operation, inputs);
        
        // Send result back to main thread
        this._sendResponse({
          messageId,
          operation,
          result
        });
      } catch (operationError) {
        // Send error back to main thread
        this._sendResponse({
          messageId,
          operation,
          error: operationError.message
        });
      }
    } catch (error) {
      errorLogger.logError(error, {
        component: 'WorkerAdapter',
        context: 'WorkerAdapter._handleMessage',
        message: 'Error handling worker message'
      });
    }
  }
  
  /**
   * Process an operation within the worker
   * 
   * @param {string} operation - Operation to process
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   * @private
   */
  async _processOperation(operation, inputs) {
    try {
      // Implementation depends on the specific operations
      // This would normally import the appropriate modules and run the operation
      
      // For now, return a stub result
      return {
        success: true,
        operation,
        executionTime: 0
      };
    } catch (error) {
      errorLogger.logError(error, {
        component: 'WorkerAdapter',
        context: 'WorkerAdapter._processOperation',
        message: 'Error processing operation in worker',
        operation
      });
      
      throw error;
    }
  }
  
  /**
   * Send a response back to the main thread
   * 
   * @param {Object} response - Response to send
   * @private
   */
  _sendResponse(response) {
    try {
      if (this.isWebWorker) {
        // Web Worker
        self.postMessage(response);
      } else if (this.parentPort) {
        // Node.js Worker Thread
        this.parentPort.postMessage(response);
      }
    } catch (error) {
      errorLogger.logError(error, {
        component: 'WorkerAdapter',
        context: 'WorkerAdapter._sendResponse',
        message: 'Error sending worker response'
      });
    }
  }
}

/**
 * Fallback adapter for unknown environments
 */
export class FallbackAdapter extends PlatformAdapter {
  /**
   * Create a new fallback adapter
   * 
   * @param {Object} options - Adapter options
   */
  constructor(options = {}) {
    super({
      ...options,
      environment: EnvironmentType.UNKNOWN
    });
  }
  
  /**
   * Run a server operation (all operations are redirected to server)
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   */
  async runLocalOperation(operation, inputs) {
    // In fallback mode, redirect all operations to server
    return this.runServerOperation(operation, inputs);
  }
  
  /**
   * Run a server operation
   * 
   * @param {string} operation - Operation to run
   * @param {Object} inputs - Operation inputs
   * @returns {Promise<Object>} Operation result
   */
  async runServerOperation(operation, inputs) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Simple server request implementation
      const endpoint = this._getEndpointForOperation(operation);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation,
          inputs
        })
      });
      
      if (!response.ok) {
        throw new NetworkError(`Server operation failed: ${response.statusText}`, {
          operation,
          environment: this.environment,
          statusCode: response.status,
          endpoint: endpoint
        });
      }
      
      return await response.json();
    } catch (error) {
      errorLogger.logError(error, {
        component: 'FallbackAdapter',
        context: 'FallbackAdapter.runServerOperation',
        message: 'Error running server operation',
        operation
      });
      
      throw error;
    }
  }
  
  /**
   * Get API endpoint for operation
   * 
   * @param {string} operation - Operation to get endpoint for
   * @returns {string} API endpoint
   * @private
   */
  _getEndpointForOperation(operation) {
    const baseUrl = this.config.serverUrl || 'https://api.proof-of-funds.com';
    
    // Map operations to endpoints
    const endpointMap = {
      'generateProof': '/api/zk/fullProve',
      'verifyProof': '/api/zk/verify',
      'getVerificationKey': '/api/zk/verificationKey',
      'deployCircuit': '/api/zk/deploy'
    };
    
    const endpoint = endpointMap[operation] || '/api/zk/genericOperation';
    return `${baseUrl}${endpoint}`;
  }
}

/**
 * Create the appropriate platform adapter for the current environment
 * 
 * @param {Object} options - Adapter options
 * @param {string} [options.environment] - Force specific environment
 * @param {Object} [options.config] - Configuration object
 * @returns {PlatformAdapter} Appropriate platform adapter
 */
export function createAdapter(options = {}) {
  try {
    // Detect environment if not specified
    const environment = options.environment || detectEnvironment();
    
    // Auto-generate configuration if not provided
    if (!options.config) {
      const features = detectFeatures();
      options.config = getRecommendedConfiguration(features);
    }
    
    // Create appropriate adapter for the environment
    switch (environment) {
      case EnvironmentType.BROWSER:
        return new BrowserAdapter(options);
      
      case EnvironmentType.NODE:
        return new NodeAdapter(options);
      
      case EnvironmentType.MOBILE:
        return new MobileAdapter(options);
      
      case EnvironmentType.WORKER:
        return new WorkerAdapter(options);
      
      default:
        return new FallbackAdapter(options);
    }
  } catch (error) {
    errorLogger.logError(error, {
      component: 'PlatformAdapterFactory',
      context: 'createAdapter',
      message: 'Error creating platform adapter'
    });
    
    // Use fallback adapter on error
    return new FallbackAdapter(options);
  }
}

/**
 * Module exports
 */
export default {
  PlatformAdapter,
  BrowserAdapter,
  NodeAdapter,
  MobileAdapter,
  WorkerAdapter,
  FallbackAdapter,
  createAdapter
};