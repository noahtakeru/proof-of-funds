/**
 * Gas Optimization System
 * 
 * A focused module for optimizing gas usage and transaction timing
 * for zero-knowledge proof operations.
 * 
 * This module provides:
 * 1. Batch processing optimization
 * 2. Gas timing strategies
 * 3. Gas saving calculations
 * 4. Optimal gas parameter recommendations
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module helps minimize the "fuel cost" of privacy operations.
 * Think of it like optimizing fleet fuel efficiency:
 * 
 * 1. BATCH OPTIMIZATION: Combine multiple operations into efficient batches
 * 2. TIMING OPTIMIZATION: Recommend when to perform operations for lower costs
 * 3. PARAMETER OPTIMIZATION: Suggest optimal transaction settings
 * 4. SAVINGS CALCULATIONS: Quantify cost savings from different optimizations
 * 
 * Business value: Reduces operational costs, enables more competitive pricing,
 * and maximizes efficiency of blockchain interactions.
 */

// Import dependencies
import { ethers } from 'ethers';
import {
  InputError,
  SystemError,
  ErrorCode,
  ErrorSeverity,
  isZKError
} from '../zkErrorHandler.js';
import zkErrorLogger from '../zkErrorLogger.js';
import { GasPriceMonitor } from './GasPriceMonitor.js';
import { GasEstimator, GAS_OPERATIONS, PROOF_TYPES, GAS_TARGETS } from './GasEstimator.js';

/**
 * Specialized error class for gas optimization operations
 */
class GasOptimizerError extends SystemError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      severity: options.severity || ErrorSeverity.WARNING,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'GasOptimizer',
        operation: options.operation || 'unknown',
        operationId: options.operationId || `gas_optimizer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      }
    });

    this.name = 'GasOptimizerError';

    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GasOptimizerError);
    }
  }
}

/**
 * Helper function for logging errors
 * @param {Error} error - The error to log
 * @param {Object} additionalInfo - Additional context information
 * @returns {Error} The error (potentially wrapped as GasOptimizerError)
 */
function logError(error, additionalInfo = {}) {
  // If error is null/undefined, create a generic error
  if (!error) {
    error = new Error('Unknown error in Gas Optimizer');
  }

  // Convert to GasOptimizerError if it's not already a specialized error
  if (!isZKError(error)) {
    const operationId = additionalInfo.operationId || `gas_opt_error_${Date.now()}`;
    error = new GasOptimizerError(error.message || 'Unknown error in gas optimization', {
      operationId,
      operation: additionalInfo.operation || 'unknown',
      details: {
        originalError: error,
        ...additionalInfo
      }
    });
  }

  // Log the error
  if (zkErrorLogger && zkErrorLogger.logError) {
    zkErrorLogger.logError(error, additionalInfo);
  } else {
    console.error('[GasOptimizer]', error.message, additionalInfo);
  }

  return error;
}

/**
 * Gas timing strategy types
 * @type {Object}
 */
export const TIMING_STRATEGIES = {
  FASTEST: 'fastest',      // Execute immediately, regardless of gas price
  BALANCED: 'balanced',    // Wait for reasonable gas price, but not too long
  ECONOMICAL: 'economical' // Wait for lower gas price, prioritizing cost over speed
};

/**
 * Gas optimization strategy types
 * @type {Object}
 */
export const OPTIMIZATION_STRATEGIES = {
  INDIVIDUAL: 'individual', // Process proofs individually
  SMALL_BATCH: 'small_batch', // Process in small batches (2-5)
  LARGE_BATCH: 'large_batch', // Process in large batches (6+)
  ADAPTIVE: 'adaptive'     // Dynamically choose batch size based on current conditions
};

/**
 * Calculate gas savings from batching
 * @param {number} individualCost - Gas cost of individual processing
 * @param {number} batchCost - Gas cost of batch processing
 * @param {number} count - Number of operations
 * @returns {Object} Gas savings data
 */
export function calculateGasSavings(individualCost, batchCost, count) {
  if (count <= 0) {
    return { savings: 0, percentage: 0 };
  }
  
  const totalIndividualCost = individualCost * count;
  const savings = totalIndividualCost - batchCost;
  const percentage = (savings / totalIndividualCost) * 100;
  
  return {
    savings,
    percentage,
    totalIndividualCost,
    batchCost
  };
}

/**
 * Gas Optimizer - Optimizes gas usage and transaction timing
 * 
 * @class GasOptimizer
 * @property {Object} provider - Ethereum provider instance
 * @property {GasPriceMonitor} priceMonitor - Gas price monitor instance
 * @property {GasEstimator} estimator - Gas estimator instance
 * @property {Object} options - Configuration options
 * @property {Array<Object>} priceThresholds - Gas price thresholds for timing strategies
 */
export class GasOptimizer {
  /**
   * Create a new GasOptimizer instance
   * @param {Object} provider - Ethereum provider
   * @param {Object} options - Configuration options
   * @param {GasPriceMonitor} [options.priceMonitor] - Existing GasPriceMonitor instance
   * @param {GasEstimator} [options.estimator] - Existing GasEstimator instance
   * @param {number} [options.lowPriceThreshold=30] - Low gas price threshold in gwei
   * @param {number} [options.highPriceThreshold=100] - High gas price threshold in gwei
   * @param {number} [options.maxWaitTime=3600000] - Maximum wait time for lower gas in ms (1 hour)
   */
  constructor(provider, options = {}) {
    this.provider = provider;
    this.priceMonitor = options.priceMonitor || new GasPriceMonitor(provider, options);
    this.estimator = options.estimator || new GasEstimator(provider, { priceMonitor: this.priceMonitor, ...options });
    
    this.options = {
      lowPriceThreshold: 30,  // gwei
      highPriceThreshold: 100, // gwei
      maxWaitTime: 3600000,   // 1 hour in ms
      ...options
    };
    
    // Define price thresholds for different strategies
    this.priceThresholds = {
      [TIMING_STRATEGIES.FASTEST]: Infinity,  // Any price is acceptable
      [TIMING_STRATEGIES.BALANCED]: this.options.highPriceThreshold,
      [TIMING_STRATEGIES.ECONOMICAL]: this.options.lowPriceThreshold
    };
  }

  /**
   * Calculate optimal gas parameters for transaction
   * @param {string} txType - Transaction type (standard, threshold, maximum)
   * @returns {Promise<Object>} Optimal gas parameters
   */
  async getOptimalGasParams(txType = 'standard') {
    const operationId = `gas_optimizer_params_${Date.now()}`;
    
    try {
      // Default to standard if invalid type provided
      const proofType = Object.values(PROOF_TYPES).includes(txType) 
        ? txType 
        : PROOF_TYPES.STANDARD;
      
      // Get gas price data
      const gasPriceData = await this.priceMonitor.getCurrentGasPrice();
      
      // Check if network supports EIP-1559
      const supportsEIP1559 = gasPriceData.supportsEIP1559;
      
      if (supportsEIP1559) {
        // Optimize for EIP-1559
        return this._getOptimalEIP1559Params(proofType, gasPriceData);
      } else {
        // Optimize for legacy transactions
        return this._getOptimalLegacyParams(proofType, gasPriceData);
      }
    } catch (error) {
      throw logError(error, {
        operation: 'getOptimalGasParams',
        operationId,
        parameters: { txType }
      });
    }
  }
  
  /**
   * Get optimal EIP-1559 transaction parameters
   * @param {string} proofType - Proof type
   * @param {Object} gasPriceData - Current gas price data
   * @returns {Object} Optimal transaction parameters
   * @private
   */
  async _getOptimalEIP1559Params(proofType, gasPriceData) {
    try {
      const baseFee = ethers.BigNumber.from(gasPriceData.baseFeePerGas);
      const priorityFee = ethers.BigNumber.from(gasPriceData.maxPriorityFeePerGas);
      
      // Get gas limit from estimator
      const gasEstimation = await this.estimator.estimateTransactionGasParams(proofType, true);
      const gasLimit = gasEstimation.gasLimit;
      
      // Calculate max fee based on base fee volatility
      // Add a buffer based on recent price changes
      let maxFeeMultiplier = 2; // Default to 2x current base fee
      
      // If we have price history, analyze recent volatility
      if (this.priceMonitor.gasPriceHistory.length >= 2) {
        const recentPrices = this.priceMonitor.gasPriceHistory.slice(-5);
        const priceChanges = [];
        
        // Calculate recent price changes
        for (let i = 1; i < recentPrices.length; i++) {
          const previous = recentPrices[i-1].gasPriceGwei || 0;
          const current = recentPrices[i].gasPriceGwei || 0;
          if (previous > 0) {
            priceChanges.push((current - previous) / previous);
          }
        }
        
        // If we have price changes, adjust the multiplier based on volatility
        if (priceChanges.length > 0) {
          const absoluteChanges = priceChanges.map(change => Math.abs(change));
          const maxChange = Math.max(...absoluteChanges);
          
          // Adjust multiplier based on observed volatility (between 1.5x and 5x)
          maxFeeMultiplier = Math.max(1.5, Math.min(5, 2 + (maxChange * 5)));
        }
      }
      
      // Calculate max fee per gas based on multiplier
      const maxFeePerGas = baseFee.mul(Math.floor(maxFeeMultiplier * 10)).div(10).add(priorityFee);
      
      if (zkErrorLogger && zkErrorLogger.debug) {
        zkErrorLogger.debug('Optimal EIP-1559 params calculated', {
          context: 'GasOptimizer._getOptimalEIP1559Params',
          proofType,
          gasLimit,
          baseFeeGwei: parseFloat(ethers.utils.formatUnits(baseFee, 'gwei')),
          maxFeeGwei: parseFloat(ethers.utils.formatUnits(maxFeePerGas, 'gwei')),
          priorityFeeGwei: parseFloat(ethers.utils.formatUnits(priorityFee, 'gwei')),
          maxFeeMultiplier
        });
      }
      
      return {
        type: 2, // EIP-1559 transaction type
        gasLimit,
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: priorityFee.toString(),
        baseFeePerGas: baseFee.toString(),
        maxFeeMultiplier
      };
    } catch (error) {
      throw logError(error, {
        operation: '_getOptimalEIP1559Params',
        parameters: { proofType }
      });
    }
  }
  
  /**
   * Get optimal legacy transaction parameters
   * @param {string} proofType - Proof type
   * @param {Object} gasPriceData - Current gas price data
   * @returns {Object} Optimal transaction parameters
   * @private
   */
  async _getOptimalLegacyParams(proofType, gasPriceData) {
    try {
      const gasPrice = ethers.BigNumber.from(gasPriceData.gasPrice);
      
      // Get gas limit from estimator
      const gasEstimation = await this.estimator.estimateTransactionGasParams(proofType, false);
      const gasLimit = gasEstimation.gasLimit;
      
      // For legacy transactions, we might add a small buffer to ensure faster inclusion
      const gasPriceWithBuffer = gasPrice.mul(110).div(100); // 10% buffer
      
      if (zkErrorLogger && zkErrorLogger.debug) {
        zkErrorLogger.debug('Optimal legacy params calculated', {
          context: 'GasOptimizer._getOptimalLegacyParams',
          proofType,
          gasLimit,
          gasPriceGwei: parseFloat(ethers.utils.formatUnits(gasPriceWithBuffer, 'gwei'))
        });
      }
      
      return {
        gasLimit,
        gasPrice: gasPriceWithBuffer.toString()
      };
    } catch (error) {
      throw logError(error, {
        operation: '_getOptimalLegacyParams',
        parameters: { proofType }
      });
    }
  }

  /**
   * Calculate optimal batch size for multiple operations
   * @param {string} proofType - Type of proof
   * @param {number} operationCount - Number of operations to process
   * @returns {Promise<Object>} Optimal batch size and expected savings
   */
  async calculateOptimalBatchSize(proofType, operationCount) {
    const operationId = `gas_optimizer_batch_${Date.now()}`;
    
    try {
      // Validate inputs
      if (!Object.values(PROOF_TYPES).includes(proofType)) {
        throw new InputError(`Invalid proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { validProofTypes: Object.values(PROOF_TYPES) }
        });
      }
      
      if (operationCount <= 0 || !Number.isInteger(operationCount)) {
        throw new InputError('Operation count must be a positive integer', {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { providedCount: operationCount }
        });
      }
      
      // If only one operation, no batching possible
      if (operationCount === 1) {
        return {
          optimalBatchSize: 1,
          batchCount: 1,
          strategy: OPTIMIZATION_STRATEGIES.INDIVIDUAL,
          savings: { savings: 0, percentage: 0 }
        };
      }
      
      // Calculate costs for different batch sizes
      const individualCost = await this._estimateBatchCost(proofType, 1);
      const totalIndividualCost = individualCost * operationCount;
      
      const batchSizeCosts = [];
      const maxBatchSize = Math.min(operationCount, 10); // Cap at reasonable batch size
      
      // Calculate costs for different batch sizes
      for (let batchSize = 2; batchSize <= maxBatchSize; batchSize++) {
        const batchCost = await this._estimateBatchCost(proofType, batchSize);
        const batchCount = Math.ceil(operationCount / batchSize);
        const totalBatchCost = batchCost * batchCount;
        
        const savings = calculateGasSavings(individualCost, totalBatchCost / operationCount, operationCount);
        
        batchSizeCosts.push({
          batchSize,
          batchCost,
          batchCount,
          totalCost: totalBatchCost,
          savings
        });
      }
      
      // Find batch size with highest savings
      batchSizeCosts.sort((a, b) => b.savings.percentage - a.savings.percentage);
      const optimal = batchSizeCosts[0];
      
      // Determine strategy based on optimal batch size
      let strategy;
      if (optimal.batchSize === 1) {
        strategy = OPTIMIZATION_STRATEGIES.INDIVIDUAL;
      } else if (optimal.batchSize <= 5) {
        strategy = OPTIMIZATION_STRATEGIES.SMALL_BATCH;
      } else {
        strategy = OPTIMIZATION_STRATEGIES.LARGE_BATCH;
      }
      
      if (zkErrorLogger && zkErrorLogger.debug) {
        zkErrorLogger.debug('Optimal batch size calculated', {
          context: 'GasOptimizer.calculateOptimalBatchSize',
          proofType,
          operationCount,
          optimalBatchSize: optimal.batchSize,
          batchCount: optimal.batchCount,
          savingsPercentage: optimal.savings.percentage.toFixed(2) + '%',
          strategy
        });
      }
      
      return {
        optimalBatchSize: optimal.batchSize,
        batchCount: optimal.batchCount,
        strategy,
        savings: optimal.savings,
        allOptions: batchSizeCosts
      };
    } catch (error) {
      throw logError(error, {
        operation: 'calculateOptimalBatchSize',
        operationId,
        parameters: { proofType, operationCount }
      });
    }
  }
  
  /**
   * Estimate gas cost for a batch of operations
   * @param {string} proofType - Type of proof
   * @param {number} batchSize - Size of the batch
   * @returns {Promise<number>} Estimated gas cost
   * @private
   */
  async _estimateBatchCost(proofType, batchSize) {
    try {
      if (batchSize === 1) {
        // Individual operation
        return GAS_TARGETS[proofType][GAS_OPERATIONS.VERIFY];
      } else {
        // Batch operation with diminishing cost per operation
        // Each additional operation costs less due to shared overhead
        const baseGasCost = GAS_TARGETS[proofType][GAS_OPERATIONS.BATCH];
        const additionalOpCost = GAS_TARGETS[proofType][GAS_OPERATIONS.VERIFY] * 0.6; // 60% of individual cost
        const diminishingFactor = 0.9; // 10% reduction for each additional operation
        
        let totalCost = baseGasCost;
        
        for (let i = 1; i < batchSize; i++) {
          totalCost += additionalOpCost * Math.pow(diminishingFactor, i - 1);
        }
        
        return Math.round(totalCost);
      }
    } catch (error) {
      throw logError(error, {
        operation: '_estimateBatchCost',
        parameters: { proofType, batchSize }
      });
    }
  }

  /**
   * Recommend a transaction timing strategy based on current gas prices
   * @param {Object} options - Strategy options
   * @param {string} [options.strategy=TIMING_STRATEGIES.BALANCED] - Preferred timing strategy
   * @param {number} [options.maxWaitTime] - Maximum time to wait in milliseconds
   * @param {number} [options.targetPrice] - Target gas price in gwei
   * @returns {Promise<Object>} Timing recommendation
   */
  async recommendTransactionTiming(options = {}) {
    const operationId = `gas_optimizer_timing_${Date.now()}`;
    
    try {
      const strategy = options.strategy || TIMING_STRATEGIES.BALANCED;
      const maxWaitTime = options.maxWaitTime || this.options.maxWaitTime;
      const targetPrice = options.targetPrice || this.priceThresholds[strategy];
      
      // Get current gas price
      const gasPriceData = await this.priceMonitor.getCurrentGasPrice();
      const currentPrice = gasPriceData.gasPriceGwei;
      
      // If current price is already below target, recommend immediate execution
      if (currentPrice <= targetPrice) {
        return {
          recommendation: 'execute_now',
          currentPrice,
          targetPrice,
          reason: `Current gas price (${currentPrice.toFixed(2)} gwei) is already below target (${targetPrice.toFixed(2)} gwei)`
        };
      }
      
      // If strategy is FASTEST, recommend immediate execution regardless of price
      if (strategy === TIMING_STRATEGIES.FASTEST) {
        return {
          recommendation: 'execute_now',
          currentPrice,
          targetPrice,
          reason: 'FASTEST strategy selected, executing regardless of current gas price'
        };
      }
      
      // Analyze price history to estimate waiting time
      let estimatedWaitTime = null;
      
      if (this.priceMonitor.gasPriceHistory.length >= 3) {
        estimatedWaitTime = this._estimateTimeToTargetPrice(targetPrice);
      }
      
      // If we have a wait time estimate and it's within max wait time, recommend waiting
      if (estimatedWaitTime !== null && estimatedWaitTime <= maxWaitTime) {
        return {
          recommendation: 'wait',
          currentPrice,
          targetPrice,
          estimatedWaitTime,
          reason: `Gas price expected to reach target within ${Math.ceil(estimatedWaitTime / 60000)} minutes`
        };
      }
      
      // Otherwise, make recommendation based on price difference
      const priceDifference = (currentPrice - targetPrice) / targetPrice;
      
      if (priceDifference <= 0.3) { // Within 30% of target
        return {
          recommendation: 'execute_now',
          currentPrice,
          targetPrice,
          reason: 'Gas price is reasonably close to target, waiting may not provide significant savings'
        };
      } else {
        return {
          recommendation: 'wait_with_limit',
          currentPrice,
          targetPrice,
          maxWaitTime,
          reason: 'Gas price is significantly above target, but wait time is uncertain'
        };
      }
    } catch (error) {
      throw logError(error, {
        operation: 'recommendTransactionTiming',
        operationId,
        parameters: options
      });
    }
  }
  
  /**
   * Estimate time to reach target gas price
   * @param {number} targetPrice - Target gas price in gwei
   * @returns {number|null} Estimated wait time in milliseconds, or null if unable to estimate
   * @private
   */
  _estimateTimeToTargetPrice(targetPrice) {
    try {
      const history = this.priceMonitor.gasPriceHistory;
      
      // Need at least 3 data points for meaningful trend analysis
      if (history.length < 3) {
        return null;
      }
      
      // Check if any historical price is below target
      const belowTargetPrices = history.filter(entry => entry.gasPriceGwei <= targetPrice);
      
      if (belowTargetPrices.length === 0) {
        // No historical data below target, hard to estimate
        return null;
      }
      
      // Calculate average rate of change
      const priceChanges = [];
      const timeChanges = [];
      
      for (let i = 1; i < history.length; i++) {
        const priceDiff = history[i].gasPriceGwei - history[i-1].gasPriceGwei;
        const timeDiff = history[i].timestamp - history[i-1].timestamp;
        
        if (timeDiff > 0) {
          priceChanges.push(priceDiff);
          timeChanges.push(timeDiff);
        }
      }
      
      if (priceChanges.length === 0) {
        return null;
      }
      
      // Calculate average price change per millisecond
      const totalPriceChange = priceChanges.reduce((sum, val) => sum + val, 0);
      const totalTimeChange = timeChanges.reduce((sum, val) => sum + val, 0);
      const avgPriceChangePerMs = totalPriceChange / totalTimeChange;
      
      // If price is stable or rising, use historical patterns
      if (avgPriceChangePerMs >= 0) {
        // Find most recent price below target
        const recentBelowTarget = belowTargetPrices
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        // Estimate based on time since that price occurred
        const currentTime = Date.now();
        const timeSinceTargetPrice = currentTime - recentBelowTarget.timestamp;
        
        // Price cycles often follow patterns (e.g., daily cycles)
        // Estimate based on typical cycle length
        // For simplicity, assume a 6-hour cycle if we have enough data
        if (history[history.length - 1].timestamp - history[0].timestamp > 12 * 60 * 60 * 1000) {
          return Math.min(6 * 60 * 60 * 1000 - (timeSinceTargetPrice % (6 * 60 * 60 * 1000)), 
            this.options.maxWaitTime);
        } else {
          // Not enough data for cycle analysis
          return null;
        }
      } else {
        // Price is declining, extrapolate time to target
        const currentPrice = history[history.length - 1].gasPriceGwei;
        const priceDifference = currentPrice - targetPrice;
        
        // Avoid division by zero or positive change
        if (avgPriceChangePerMs >= 0) {
          return null;
        }
        
        // Estimate time to reach target based on average rate of decline
        const estimatedTimeMs = priceDifference / (-avgPriceChangePerMs);
        
        return Math.min(estimatedTimeMs, this.options.maxWaitTime);
      }
    } catch (error) {
      logError(error, {
        operation: '_estimateTimeToTargetPrice',
        parameters: { targetPrice }
      });
      return null;
    }
  }
}

// Export default instance
export default GasOptimizer;