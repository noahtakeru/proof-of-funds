/**
 * @fileoverview Gas Optimizer
 * 
 * Provides strategies for optimizing gas usage in ZK proof verification.
 * 
 * @module GasOptimizer
 */

// Import dependencies
import { errorLogger } from '../error/ErrorSystem.js';
import { gasEstimator } from './GasEstimator.js';
import { gasPriceMonitor } from './GasPriceMonitor.js';

// Optimization strategies
const OPTIMIZATION_STRATEGIES = {
  PROOF_BATCHING: 'proof_batching',
  CALLDATA_COMPRESSION: 'calldata_compression',
  RECURSIVE_PROOFS: 'recursive_proofs',
  CIRCUIT_OPTIMIZATION: 'circuit_optimization',
  TIMING_OPTIMIZATION: 'timing_optimization'
};

// Optimization levels
const OPTIMIZATION_LEVELS = {
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EXTREME: 'extreme'
};

/**
 * Gas optimizer for ZK proof operations
 */
class GasOptimizer {
  /**
   * Create a new gas optimizer
   * @param {Object} options - Configuration options
   * @param {string} [options.defaultLevel='medium'] - Default optimization level
   * @param {Object} [options.costThresholds] - Cost thresholds for dynamic optimization
   * @param {boolean} [options.dynamicOptimization=true] - Whether to use dynamic optimization
   */
  constructor(options = {}) {
    this.defaultLevel = options.defaultLevel || OPTIMIZATION_LEVELS.MEDIUM;
    this.dynamicOptimization = options.dynamicOptimization !== false;
    
    // Cost thresholds for dynamic optimization (in USD)
    this.costThresholds = {
      low: options.costThresholds?.low || 5, // $5
      medium: options.costThresholds?.medium || 20, // $20
      high: options.costThresholds?.high || 50, // $50
      ...options.costThresholds
    };
    
    // Track optimization statistics
    this.stats = {
      optimizationsApplied: 0,
      totalGasSaved: 0,
      lastOptimizationTime: 0
    };
  }
  
  /**
   * Get optimization strategies for a given level
   * @param {string} level - Optimization level
   * @returns {Array<string>} Applicable strategies
   * @private
   */
  getStrategiesForLevel(level) {
    switch (level) {
      case OPTIMIZATION_LEVELS.NONE:
        return [];
      case OPTIMIZATION_LEVELS.LOW:
        return [
          OPTIMIZATION_STRATEGIES.CALLDATA_COMPRESSION
        ];
      case OPTIMIZATION_LEVELS.MEDIUM:
        return [
          OPTIMIZATION_STRATEGIES.CALLDATA_COMPRESSION,
          OPTIMIZATION_STRATEGIES.TIMING_OPTIMIZATION
        ];
      case OPTIMIZATION_LEVELS.HIGH:
        return [
          OPTIMIZATION_STRATEGIES.CALLDATA_COMPRESSION,
          OPTIMIZATION_STRATEGIES.TIMING_OPTIMIZATION,
          OPTIMIZATION_STRATEGIES.PROOF_BATCHING
        ];
      case OPTIMIZATION_LEVELS.EXTREME:
        return [
          OPTIMIZATION_STRATEGIES.CALLDATA_COMPRESSION,
          OPTIMIZATION_STRATEGIES.TIMING_OPTIMIZATION,
          OPTIMIZATION_STRATEGIES.PROOF_BATCHING,
          OPTIMIZATION_STRATEGIES.RECURSIVE_PROOFS,
          OPTIMIZATION_STRATEGIES.CIRCUIT_OPTIMIZATION
        ];
      default:
        return [
          OPTIMIZATION_STRATEGIES.CALLDATA_COMPRESSION,
          OPTIMIZATION_STRATEGIES.TIMING_OPTIMIZATION
        ];
    }
  }
  
  /**
   * Determine the appropriate optimization level based on costs
   * @param {Object} cost - Cost estimate
   * @returns {string} Optimization level
   * @private
   */
  determineOptimizationLevel(cost) {
    if (!cost || !cost.costUsd) {
      return this.defaultLevel;
    }
    
    const costUsd = cost.costUsd;
    
    if (costUsd >= this.costThresholds.high) {
      return OPTIMIZATION_LEVELS.HIGH;
    } else if (costUsd >= this.costThresholds.medium) {
      return OPTIMIZATION_LEVELS.MEDIUM;
    } else if (costUsd >= this.costThresholds.low) {
      return OPTIMIZATION_LEVELS.LOW;
    } else {
      return OPTIMIZATION_LEVELS.NONE;
    }
  }
  
  /**
   * Apply calldata compression optimization
   * @param {Object} input - Proof input data
   * @returns {Object} Optimized input data
   * @private
   */
  applyCalldataCompression(input) {
    if (!input || !input.proof) {
      return input;
    }
    
    // Create a deep copy of the input
    const optimizedInput = JSON.parse(JSON.stringify(input));
    
    // Perform basic calldata optimization
    if (optimizedInput.proof) {
      // Convert strings to shortest hex representation
      for (const key in optimizedInput.proof) {
        if (Array.isArray(optimizedInput.proof[key])) {
          optimizedInput.proof[key] = optimizedInput.proof[key].map(item => {
            if (typeof item === 'string' && item.startsWith('0x')) {
              return item.replace(/^0x0+/, '0x');
            }
            return item;
          });
        } else if (typeof optimizedInput.proof[key] === 'string' && 
                  optimizedInput.proof[key].startsWith('0x')) {
          optimizedInput.proof[key] = optimizedInput.proof[key].replace(/^0x0+/, '0x');
        }
      }
    }
    
    // Update publicSignals to smallest representation
    if (optimizedInput.publicSignals) {
      optimizedInput.publicSignals = optimizedInput.publicSignals.map(signal => {
        if (typeof signal === 'string' && signal.startsWith('0x')) {
          return signal.replace(/^0x0+/, '0x');
        }
        return signal;
      });
    }
    
    return optimizedInput;
  }
  
  /**
   * Apply timing optimization based on gas prices
   * @param {Object} input - Input data
   * @returns {Promise<Object>} Optimization result
   * @private
   * @async
   */
  async applyTimingOptimization(input) {
    try {
      // Get current gas price recommendations
      const recommendations = await gasPriceMonitor.getGasPriceRecommendations();
      
      // Check if prices are high
      const isHighPrice = recommendations.current.standard >= 100; // Example threshold: 100 Gwei
      
      if (isHighPrice) {
        // Recommend delay if prices are high
        return {
          optimized: false,
          delayed: true,
          recommendedDelay: 3600000, // 1 hour in ms
          message: 'Gas prices are high. Consider delaying transaction.',
          currentPrice: recommendations.current.standard,
          input
        };
      }
      
      // No delay needed
      return {
        optimized: true,
        delayed: false,
        currentPrice: recommendations.current.standard,
        input
      };
    } catch (error) {
      errorLogger.warn('Error in timing optimization', {
        error: error.message
      });
      
      // Return original input if optimization fails
      return {
        optimized: false,
        delayed: false,
        error: error.message,
        input
      };
    }
  }
  
  /**
   * Apply proof batching optimization
   * @param {Array<Object>} inputs - Array of proof inputs
   * @returns {Object} Batched proof
   * @private
   */
  applyProofBatching(inputs) {
    if (!Array.isArray(inputs) || inputs.length <= 1) {
      return { optimized: false, inputs };
    }
    
    // Check if all proofs are of the same type
    const firstCircuit = inputs[0].circuit;
    const sametype = inputs.every(input => input.circuit === firstCircuit);
    
    if (!sametype) {
      return { 
        optimized: false, 
        message: 'Cannot batch proofs of different circuits',
        inputs 
      };
    }
    
    // For simplicity, we'll just combine publicSignals
    // In a real implementation, this would involve actual ZK batching
    const batchedProof = {
      circuit: firstCircuit,
      proof: inputs[0].proof, // In real implementation, would generate a batched proof
      publicSignals: inputs.flatMap(input => input.publicSignals || []),
      isBatched: true,
      batchSize: inputs.length
    };
    
    return {
      optimized: true,
      batchedProof,
      originalInputs: inputs
    };
  }
  
  /**
   * Get optimization recommendations for a proof operation
   * @param {string} operation - Operation name
   * @param {Object} input - Operation input
   * @param {Object} options - Optimization options
   * @param {string} [options.level] - Optimization level override
   * @param {boolean} [options.dynamic=true] - Whether to use dynamic optimization
   * @returns {Promise<Object>} Optimization recommendations
   * @async
   */
  async getOptimizationRecommendations(operation, input, options = {}) {
    const dynamic = options.dynamic !== undefined ? options.dynamic : this.dynamicOptimization;
    let level = options.level || this.defaultLevel;
    
    try {
      // Estimate gas cost for operation
      const costEstimate = await gasEstimator.estimateGasCost(operation, {
        includePriceData: true,
        speed: 'standard'
      });
      
      // Determine optimization level if dynamic
      if (dynamic) {
        level = this.determineOptimizationLevel(costEstimate);
      }
      
      // Get applicable strategies
      const strategies = this.getStrategiesForLevel(level);
      
      return {
        operation,
        level,
        strategies,
        costEstimate,
        recommendations: {
          applyCompression: strategies.includes(OPTIMIZATION_STRATEGIES.CALLDATA_COMPRESSION),
          timingOptimization: strategies.includes(OPTIMIZATION_STRATEGIES.TIMING_OPTIMIZATION),
          batchProofs: strategies.includes(OPTIMIZATION_STRATEGIES.PROOF_BATCHING),
          applyRecursion: strategies.includes(OPTIMIZATION_STRATEGIES.RECURSIVE_PROOFS),
          optimizeCircuit: strategies.includes(OPTIMIZATION_STRATEGIES.CIRCUIT_OPTIMIZATION)
        }
      };
    } catch (error) {
      errorLogger.error('Error getting optimization recommendations', {
        error: error.message,
        operation
      });
      
      // Return default level if estimation fails
      return {
        operation,
        level: this.defaultLevel,
        strategies: this.getStrategiesForLevel(this.defaultLevel),
        error: error.message,
        recommendations: {
          applyCompression: true, // Always apply basic compression
          timingOptimization: false,
          batchProofs: false,
          applyRecursion: false,
          optimizeCircuit: false
        }
      };
    }
  }
  
  /**
   * Optimize a proof operation
   * @param {string} operation - Operation name
   * @param {Object|Array<Object>} input - Operation input or array of inputs
   * @param {Object} options - Optimization options
   * @param {string} [options.level] - Optimization level
   * @param {boolean} [options.forceApply=false] - Whether to force apply all optimizations
   * @returns {Promise<Object>} Optimized result
   * @async
   */
  async optimize(operation, input, options = {}) {
    const startTime = Date.now();
    let optimizationResults = {};
    let originalGasEstimate = null;
    let optimizedGasEstimate = null;
    
    try {
      // Check if input is an array (for batching)
      const isInputArray = Array.isArray(input);
      
      // Get recommendations
      const recommendations = await this.getOptimizationRecommendations(
        operation,
        isInputArray ? input[0] : input,
        options
      );
      
      // Store original gas estimate
      originalGasEstimate = recommendations.costEstimate;
      
      // Apply optimizations
      let optimizedInput = isInputArray ? [...input] : { ...input };
      
      // Apply calldata compression if recommended
      if (recommendations.recommendations.applyCompression || options.forceApply) {
        if (isInputArray) {
          optimizedInput = optimizedInput.map(item => this.applyCalldataCompression(item));
          optimizationResults.calldataCompression = { applied: true, count: optimizedInput.length };
        } else {
          optimizedInput = this.applyCalldataCompression(optimizedInput);
          optimizationResults.calldataCompression = { applied: true };
        }
      }
      
      // Apply timing optimization if recommended
      if (recommendations.recommendations.timingOptimization || options.forceApply) {
        const timingResult = await this.applyTimingOptimization(optimizedInput);
        optimizationResults.timingOptimization = timingResult;
        
        // If delay recommended, include in result
        if (timingResult.delayed) {
          optimizationResults.delayed = true;
          optimizationResults.recommendedDelay = timingResult.recommendedDelay;
        }
      }
      
      // Apply batching if recommended and input is array
      if ((recommendations.recommendations.batchProofs || options.forceApply) && isInputArray) {
        const batchingResult = this.applyProofBatching(optimizedInput);
        optimizationResults.proofBatching = batchingResult;
        
        if (batchingResult.optimized) {
          optimizedInput = batchingResult.batchedProof;
        }
      }
      
      // Estimate gas savings
      try {
        optimizedGasEstimate = await gasEstimator.estimateGasCost(operation);
        const gasSaved = originalGasEstimate.gasLimit - optimizedGasEstimate.gasLimit;
        
        optimizationResults.gasSavings = {
          gasLimit: {
            original: originalGasEstimate.gasLimit,
            optimized: optimizedGasEstimate.gasLimit,
            saved: gasSaved
          },
          costUsd: {
            original: originalGasEstimate.costUsd,
            optimized: optimizedGasEstimate.costUsd,
            saved: originalGasEstimate.costUsd - optimizedGasEstimate.costUsd
          }
        };
        
        // Update stats
        this.stats.optimizationsApplied++;
        this.stats.totalGasSaved += gasSaved;
        this.stats.lastOptimizationTime = Date.now();
      } catch (error) {
        errorLogger.warn('Error estimating gas savings', {
          error: error.message,
          operation
        });
      }
      
      return {
        input: optimizedInput,
        originalInput: input,
        recommendations,
        optimizationResults,
        stats: { ...this.stats },
        optimizationTime: Date.now() - startTime
      };
    } catch (error) {
      errorLogger.error('Error optimizing operation', {
        error: error.message,
        operation
      });
      
      // Return original input if optimization fails
      return {
        input,
        error: error.message,
        optimizationFailed: true,
        optimizationTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Get optimization statistics
   * @returns {Object} Optimization statistics
   */
  getStats() {
    return { ...this.stats };
  }
  
  /**
   * Reset optimization statistics
   */
  resetStats() {
    this.stats = {
      optimizationsApplied: 0,
      totalGasSaved: 0,
      lastOptimizationTime: 0
    };
  }
}

// Create and export default instance
const gasOptimizer = new GasOptimizer();

export { 
  gasOptimizer, 
  GasOptimizer, 
  OPTIMIZATION_STRATEGIES, 
  OPTIMIZATION_LEVELS 
};

export default gasOptimizer;