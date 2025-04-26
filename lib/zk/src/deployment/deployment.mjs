/**
 * @fileoverview Deployment Module
 * 
 * Main module for ZK proof deployment across different platforms.
 * This consolidated module provides a unified interface for deploying
 * and managing ZK proof systems in various environments.
 * 
 * @author ZK Infrastructure Team
 */

import { 
  EnvironmentType, 
  detectEnvironment, 
  detectFeatures, 
  getRecommendedConfiguration 
} from './environment-utils.js';
import { createAdapter } from './platform-adapters.js';
import { zkErrorLogger } from '../zkErrorLogger.mjs';
import { 
  DeploymentError,
  DeploymentInitializationError,
  CircuitDeploymentError,
  ProofGenerationError,
  ProofVerificationError,
  ConfigurationError
} from './deployment-errors.js';

/**
 * Deployment strategy types
 */
export const StrategyType = {
  FULL_LOCAL: 'full_local',
  HYBRID: 'hybrid',
  SERVER_SIDE: 'server_side',
  LOW_RESOURCE: 'low_resource',
  HIGH_PERFORMANCE: 'high_performance'
};

/**
 * Default deployment strategies
 */
export const predefinedStrategies = {
  // Full local processing - no server reliance
  [StrategyType.FULL_LOCAL]: {
    type: StrategyType.FULL_LOCAL,
    useWorkers: true,
    workerCount: 4,
    useWebAssembly: true,
    serverOffloadThreshold: 'never',
    serverOffloadPercentage: 0,
    memoryLimitMB: 1024,
    preferSpeed: false,
    preferLowMemory: false,
    cachingEnabled: true,
    cacheExpiryMinutes: 60,
    retryCount: 2,
    logLevel: 'error'
  },
  
  // Hybrid processing - balance local and server
  [StrategyType.HYBRID]: {
    type: StrategyType.HYBRID,
    useWorkers: true,
    workerCount: 2,
    useWebAssembly: true,
    serverOffloadThreshold: 'medium',
    serverOffloadPercentage: 50,
    memoryLimitMB: 512,
    preferSpeed: true,
    preferLowMemory: false,
    cachingEnabled: true,
    cacheExpiryMinutes: 30,
    retryCount: 3,
    logLevel: 'warn'
  },
  
  // Server-side processing - minimal local work
  [StrategyType.SERVER_SIDE]: {
    type: StrategyType.SERVER_SIDE,
    useWorkers: false,
    workerCount: 0,
    useWebAssembly: false,
    serverOffloadThreshold: 'all',
    serverOffloadPercentage: 100,
    memoryLimitMB: 128,
    preferSpeed: true,
    preferLowMemory: true,
    cachingEnabled: true,
    cacheExpiryMinutes: 15,
    retryCount: 3,
    logLevel: 'warn'
  },
  
  // Low-resource strategy for constrained devices
  [StrategyType.LOW_RESOURCE]: {
    type: StrategyType.LOW_RESOURCE,
    useWorkers: false,
    workerCount: 0,
    useWebAssembly: true,
    serverOffloadThreshold: 'low',
    serverOffloadPercentage: 90,
    memoryLimitMB: 256,
    preferSpeed: false,
    preferLowMemory: true,
    cachingEnabled: true,
    cacheExpiryMinutes: 120,
    retryCount: 2,
    logLevel: 'error'
  },
  
  // High-performance strategy for powerful devices
  [StrategyType.HIGH_PERFORMANCE]: {
    type: StrategyType.HIGH_PERFORMANCE,
    useWorkers: true,
    workerCount: 8,
    useWebAssembly: true,
    serverOffloadThreshold: 'high',
    serverOffloadPercentage: 10,
    memoryLimitMB: 2048,
    preferSpeed: true,
    preferLowMemory: false,
    cachingEnabled: true,
    cacheExpiryMinutes: 30,
    retryCount: 1,
    logLevel: 'info'
  }
};

/**
 * Main deployment class for cross-platform ZK functionality
 */
export class Deployment {
  /**
   * Create a new deployment instance
   * 
   * @param {Object} options - Deployment options
   * @param {string} [options.strategyType] - Type of strategy to use
   * @param {Object} [options.customStrategy] - Custom deployment strategy
   * @param {string} [options.serverUrl] - Server URL for remote operations
   * @param {boolean} [options.autoInitialize=true] - Auto-initialize on creation
   * @param {string} [options.environment] - Force specific environment
   */
  constructor(options = {}) {
    // Store options
    this.options = { ...options };
    
    // Environment detection
    this.environment = options.environment || detectEnvironment();
    this.features = null;
    
    // Deployment state
    this.initialized = false;
    this.adapter = null;
    this.strategy = null;
    this.serverUrl = options.serverUrl || 'https://api.proof-of-funds.com';
    
    // Circuit state
    this.deployedCircuits = new Map();
    
    // Initialize if requested
    if (options.autoInitialize !== false) {
      this.initialize().catch(error => {
        zkErrorLogger.logError(error, {
          context: 'Deployment.constructor',
          message: 'Auto-initialization failed'
        });
      });
    }
  }
  
  /**
   * Initialize the deployment
   * 
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async initialize() {
    try {
      if (this.initialized) {
        return true;
      }
      
      // Detect environment features
      this.features = detectFeatures();
      
      // Determine the most appropriate strategy
      this.strategy = this._selectStrategy(this.options.strategyType, this.options.customStrategy);
      
      // Create platform adapter
      this.adapter = createAdapter({
        environment: this.environment,
        config: {
          ...this.strategy,
          serverUrl: this.serverUrl
        }
      });
      
      // Initialize adapter
      const adapterInitialized = await this.adapter.initialize();
      
      if (!adapterInitialized) {
        const error = new DeploymentInitializationError('Failed to initialize platform adapter', {
          environment: this.environment,
          adapterType: this.adapter.constructor.name
        });
        zkErrorLogger.logError(error, {
          context: 'Deployment.initialize',
          message: 'Adapter initialization failed'
        });
        return false;
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      const deploymentError = error instanceof DeploymentError 
        ? error 
        : new DeploymentInitializationError('Deployment initialization failed', {
            originalError: error.message,
            environment: this.environment
          });
      
      zkErrorLogger.logError(deploymentError, {
        context: 'Deployment.initialize',
        message: 'Deployment initialization error'
      });
      
      this.initialized = false;
      return false;
    }
  }
  
  /**
   * Deploy a specific circuit
   * 
   * @param {string} circuitName - Name of the circuit to deploy
   * @param {Object} options - Circuit-specific options
   * @returns {Promise<boolean>} True if deployment succeeded
   */
  async deployCircuit(circuitName, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!circuitName) {
        throw new ConfigurationError('Circuit name is required', {
          operation: 'deployCircuit'
        });
      }
      
      // Check if circuit is already deployed
      if (this.deployedCircuits.has(circuitName)) {
        return true;
      }
      
      // Deploy the circuit
      const deployOptions = {
        ...options,
        strategy: this.strategy,
        serverUrl: this.serverUrl
      };
      
      const deploymentSucceeded = await this.adapter.deployCircuit(circuitName, deployOptions);
      
      if (deploymentSucceeded) {
        // Track deployed circuit
        this.deployedCircuits.set(circuitName, {
          name: circuitName,
          deployedAt: new Date(),
          options: deployOptions
        });
      }
      
      return deploymentSucceeded;
    } catch (error) {
      const deploymentError = error instanceof DeploymentError 
        ? error 
        : new CircuitDeploymentError(`Failed to deploy circuit ${circuitName}`, {
            circuitName,
            originalError: error.message
          });
      
      zkErrorLogger.logError(deploymentError, {
        context: 'Deployment.deployCircuit',
        message: 'Circuit deployment error',
        circuitName
      });
      
      return false;
    }
  }
  
  /**
   * Generate a proof using a deployed circuit
   * 
   * @param {string} circuitName - Name of the circuit to use
   * @param {Object} inputs - Circuit inputs
   * @param {Object} options - Proof generation options
   * @returns {Promise<Object>} Generated proof
   */
  async generateProof(circuitName, inputs, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check if circuit is deployed
      if (!this.deployedCircuits.has(circuitName)) {
        // Try to deploy it first
        const deployed = await this.deployCircuit(circuitName);
        
        if (!deployed) {
          throw new CircuitDeploymentError(`Circuit ${circuitName} is not deployed and could not be auto-deployed`, {
            circuitName,
            operation: 'generateProof'
          });
        }
      }
      
      // Prepare proof generation options
      const proofOptions = {
        ...options,
        strategy: this.strategy,
        serverUrl: this.serverUrl
      };
      
      // Determine if we should use local or server operation
      if (this._shouldUseServerOperation('generateProof', inputs, options)) {
        // Use server operation
        return this.adapter.runServerOperation('generateProof', {
          circuitName,
          inputs,
          options: proofOptions
        });
      } else {
        // Use local operation
        return this.adapter.runLocalOperation('generateProof', {
          circuitName,
          inputs,
          options: proofOptions
        });
      }
    } catch (error) {
      const proofError = error instanceof DeploymentError 
        ? error 
        : new ProofGenerationError(`Failed to generate proof for circuit ${circuitName}`, {
            circuitName,
            originalError: error.message
          });
      
      zkErrorLogger.logError(proofError, {
        context: 'Deployment.generateProof',
        message: 'Proof generation error',
        circuitName
      });
      
      throw proofError;
    }
  }
  
  /**
   * Verify a proof
   * 
   * @param {string} circuitName - Name of the circuit used
   * @param {Object} proof - Proof to verify
   * @param {Object} publicInputs - Public inputs
   * @param {Object} options - Verification options
   * @returns {Promise<boolean>} True if proof is valid
   */
  async verifyProof(circuitName, proof, publicInputs, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check if circuit is deployed
      if (!this.deployedCircuits.has(circuitName)) {
        // Try to deploy it first
        const deployed = await this.deployCircuit(circuitName);
        
        if (!deployed) {
          throw new CircuitDeploymentError(`Circuit ${circuitName} is not deployed and could not be auto-deployed`, {
            circuitName,
            operation: 'verifyProof'
          });
        }
      }
      
      // Prepare verification options
      const verifyOptions = {
        ...options,
        strategy: this.strategy,
        serverUrl: this.serverUrl
      };
      
      // Determine if we should use local or server operation
      if (this._shouldUseServerOperation('verifyProof', { proof, publicInputs }, options)) {
        // Use server operation
        const response = await this.adapter.runServerOperation('verifyProof', {
          circuitName,
          proof,
          publicInputs,
          options: verifyOptions
        });
        
        return response.valid === true;
      } else {
        // Use local operation
        const response = await this.adapter.runLocalOperation('verifyProof', {
          circuitName,
          proof,
          publicInputs,
          options: verifyOptions
        });
        
        return response.valid === true;
      }
    } catch (error) {
      const verificationError = error instanceof DeploymentError 
        ? error 
        : new ProofVerificationError(`Failed to verify proof for circuit ${circuitName}`, {
            circuitName,
            originalError: error.message
          });
      
      zkErrorLogger.logError(verificationError, {
        context: 'Deployment.verifyProof',
        message: 'Proof verification error',
        circuitName
      });
      
      throw verificationError;
    }
  }
  
  /**
   * Get the verification key for a circuit
   * 
   * @param {string} circuitName - Name of the circuit
   * @param {Object} options - Options
   * @returns {Promise<Object>} Verification key
   */
  async getVerificationKey(circuitName, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Verification keys are small, so we can generally use local operation
      // unless we're in server-side mode
      if (this.strategy.serverOffloadPercentage >= 100) {
        return this.adapter.runServerOperation('getVerificationKey', {
          circuitName,
          options
        });
      } else {
        return this.adapter.runLocalOperation('getVerificationKey', {
          circuitName,
          options
        });
      }
    } catch (error) {
      const keyError = error instanceof DeploymentError 
        ? error 
        : new DeploymentError(`Failed to get verification key for circuit ${circuitName}`, {
            circuitName,
            originalError: error.message
          });
      
      zkErrorLogger.logError(keyError, {
        context: 'Deployment.getVerificationKey',
        message: 'Error getting verification key',
        circuitName
      });
      
      throw keyError;
    }
  }
  
  /**
   * Run a custom operation
   * 
   * @param {string} operation - Operation name
   * @param {Object} inputs - Operation inputs
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Operation result
   */
  async runOperation(operation, inputs, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Prepare operation options
      const operationOptions = {
        ...options,
        strategy: this.strategy,
        serverUrl: this.serverUrl
      };
      
      // Determine if we should use local or server operation
      if (this._shouldUseServerOperation(operation, inputs, options)) {
        // Use server operation
        return this.adapter.runServerOperation(operation, {
          inputs,
          options: operationOptions
        });
      } else {
        // Use local operation
        return this.adapter.runLocalOperation(operation, {
          inputs,
          options: operationOptions
        });
      }
    } catch (error) {
      const operationError = error instanceof DeploymentError 
        ? error 
        : new DeploymentError(`Failed to run operation: ${operation}`, {
            operation,
            originalError: error.message
          });
      
      zkErrorLogger.logError(operationError, {
        context: 'Deployment.runOperation',
        message: 'Error running custom operation',
        operation
      });
      
      throw operationError;
    }
  }
  
  /**
   * Decide whether to use server operation based on strategy
   * 
   * @param {string} operation - Operation to check
   * @param {Object} inputs - Operation inputs
   * @param {Object} options - Operation options
   * @returns {boolean} True if server operation should be used
   * @private
   */
  _shouldUseServerOperation(operation, inputs, options = {}) {
    try {
      // Force options override strategy
      if (options.forceServer === true) {
        return true;
      }
      
      if (options.forceLocal === true) {
        return false;
      }
      
      // Check server offload percentage
      const offloadPercentage = this.strategy.serverOffloadPercentage || 0;
      
      if (offloadPercentage >= 100) {
        // Always use server
        return true;
      }
      
      if (offloadPercentage <= 0) {
        // Always use local
        return false;
      }
      
      // Check server offload threshold
      const threshold = this.strategy.serverOffloadThreshold || 'medium';
      
      // Operation-specific thresholds
      const operationComplexity = this._getOperationComplexity(operation, inputs);
      
      switch (threshold) {
        case 'low':
          // Offload even low-complexity operations
          return true;
          
        case 'medium':
          // Offload medium and high-complexity operations
          return operationComplexity !== 'low';
          
        case 'high':
          // Only offload high-complexity operations
          return operationComplexity === 'high';
          
        case 'all':
          // Offload all operations
          return true;
          
        case 'never':
          // Never offload
          return false;
          
        default:
          // Default to medium threshold
          return operationComplexity !== 'low';
      }
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'Deployment._shouldUseServerOperation',
        message: 'Error deciding operation location',
        operation
      });
      
      // Default to server on error
      return true;
    }
  }
  
  /**
   * Get the complexity of an operation
   * 
   * @param {string} operation - Operation to check
   * @param {Object} inputs - Operation inputs
   * @returns {string} Complexity level ('low', 'medium', 'high')
   * @private
   */
  _getOperationComplexity(operation, inputs) {
    // Classify operations by their typical complexity
    const complexityMap = {
      'generateProof': 'high',
      'verifyProof': 'medium',
      'getVerificationKey': 'low',
      'deployCircuit': 'medium',
      'batchValidation': 'high',
      'signMessage': 'low',
      'createWallet': 'medium',
      'decryptData': 'medium'
    };
    
    return complexityMap[operation] || 'medium';
  }
  
  /**
   * Select the appropriate deployment strategy
   * 
   * @param {string} strategyType - Type of strategy to use
   * @param {Object} customStrategy - Custom strategy configuration
   * @returns {Object} Deployment strategy
   * @private
   */
  _selectStrategy(strategyType, customStrategy) {
    try {
      // Use custom strategy if provided
      if (customStrategy) {
        return {
          // Start with hybrid strategy defaults
          ...predefinedStrategies[StrategyType.HYBRID],
          // Apply custom settings
          ...customStrategy
        };
      }
      
      // Use predefined strategy if specified
      if (strategyType && predefinedStrategies[strategyType]) {
        return { ...predefinedStrategies[strategyType] };
      }
      
      // Auto-select based on device capabilities
      if (!this.features) {
        this.features = detectFeatures();
      }
      
      const config = getRecommendedConfiguration(this.features);
      
      if (this.features.deviceClass === 'high') {
        return { ...predefinedStrategies[StrategyType.HIGH_PERFORMANCE] };
      } else if (this.features.deviceClass === 'low') {
        return { ...predefinedStrategies[StrategyType.LOW_RESOURCE] };
      } else if (this.environment === EnvironmentType.NODE) {
        return { ...predefinedStrategies[StrategyType.FULL_LOCAL] };
      } else {
        return { ...predefinedStrategies[StrategyType.HYBRID] };
      }
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'Deployment._selectStrategy',
        message: 'Error selecting deployment strategy'
      });
      
      // Default to hybrid strategy on error
      return { ...predefinedStrategies[StrategyType.HYBRID] };
    }
  }
  
  /**
   * Check deployment status
   * 
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      environment: this.environment,
      strategyType: this.strategy?.type,
      deployedCircuits: Array.from(this.deployedCircuits.keys()),
      features: this.features,
      capabilities: this.adapter?.capabilities
    };
  }
  
  /**
   * Clean up deployment resources
   * 
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      if (this.adapter) {
        await this.adapter.cleanup();
      }
      
      this.initialized = false;
      this.deployedCircuits.clear();
    } catch (error) {
      zkErrorLogger.logError(error, {
        context: 'Deployment.cleanup',
        message: 'Error cleaning up deployment'
      });
    }
  }
}

/**
 * Create a deployment instance with the specified options
 * 
 * @param {Object} options - Deployment options
 * @returns {Deployment} Deployment instance
 */
export function createDeployment(options = {}) {
  return new Deployment(options);
}

/**
 * Module exports
 */
export default {
  Deployment,
  StrategyType,
  predefinedStrategies,
  createDeployment
};