/**
 * Gas Estimation System
 * 
 * A focused module for estimating gas usage and costs for various
 * zero-knowledge proof operations.
 * 
 * This module provides:
 * 1. Gas usage estimation for different proof types
 * 2. Cost calculation in native token and USD
 * 3. Transaction parameter estimation
 * 4. Gas usage tracking and analysis
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module predicts how much "fuel" (gas) different privacy operations will use.
 * Think of it like estimating fuel consumption for different vehicles and routes:
 * 
 * 1. CONSUMPTION PREDICTION: Estimate how much gas an operation will use
 * 2. COST CALCULATION: Convert gas units to token costs and USD
 * 3. PARAMETER ESTIMATION: Recommend appropriate gas limits
 * 4. USAGE TRACKING: Learn from actual gas usage to improve future estimates
 * 
 * Business value: Prevents transaction failures due to gas underestimation,
 * helps users understand costs upfront, and provides accurate budgeting information.
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

/**
 * Specialized error class for gas estimation operations
 */
class GasEstimatorError extends SystemError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || ErrorCode.SYSTEM_RESOURCE_UNAVAILABLE,
      severity: options.severity || ErrorSeverity.WARNING,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      details: {
        ...(options.details || {}),
        component: 'GasEstimator',
        operation: options.operation || 'unknown',
        operationId: options.operationId || `gas_estimator_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      }
    });

    this.name = 'GasEstimatorError';

    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GasEstimatorError);
    }
  }
}

/**
 * Helper function for logging errors
 * @param {Error} error - The error to log
 * @param {Object} additionalInfo - Additional context information
 * @returns {Error} The error (potentially wrapped as GasEstimatorError)
 */
function logError(error, additionalInfo = {}) {
  // If error is null/undefined, create a generic error
  if (!error) {
    error = new Error('Unknown error in Gas Estimator');
  }

  // Convert to GasEstimatorError if it's not already a specialized error
  if (!isZKError(error)) {
    const operationId = additionalInfo.operationId || `gas_est_error_${Date.now()}`;
    error = new GasEstimatorError(error.message || 'Unknown error in gas estimation', {
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
    console.error('[GasEstimator]', error.message, additionalInfo);
  }

  return error;
}

/**
 * Gas operation types
 * @type {Object}
 */
export const GAS_OPERATIONS = {
  VERIFY: 'verify',
  GENERATE: 'generate',
  STORE: 'store',
  BATCH: 'batch'
};

/**
 * Proof types for gas estimation
 * @type {Object}
 */
export const PROOF_TYPES = {
  STANDARD: 'standard',
  THRESHOLD: 'threshold',
  MAXIMUM: 'maximum'
};

/**
 * Baseline gas targets for different proof operations
 * @type {Object}
 */
export const GAS_TARGETS = {
  [PROOF_TYPES.STANDARD]: {
    [GAS_OPERATIONS.VERIFY]: 200000,
    [GAS_OPERATIONS.GENERATE]: 0,  // Client-side operation
    [GAS_OPERATIONS.STORE]: 120000,
    [GAS_OPERATIONS.BATCH]: 160000
  },
  [PROOF_TYPES.THRESHOLD]: {
    [GAS_OPERATIONS.VERIFY]: 300000,
    [GAS_OPERATIONS.GENERATE]: 0,  // Client-side operation
    [GAS_OPERATIONS.STORE]: 170000,
    [GAS_OPERATIONS.BATCH]: 240000
  },
  [PROOF_TYPES.MAXIMUM]: {
    [GAS_OPERATIONS.VERIFY]: 450000,
    [GAS_OPERATIONS.GENERATE]: 0,  // Client-side operation
    [GAS_OPERATIONS.STORE]: 220000,
    [GAS_OPERATIONS.BATCH]: 350000
  }
};

/**
 * Gas Estimator - Estimates gas usage for ZK operations
 * 
 * @class GasEstimator
 * @property {Object} provider - Ethereum provider instance
 * @property {GasPriceMonitor} priceMonitor - Gas price monitor instance
 * @property {Object} options - Configuration options
 * @property {Object} gasUsageData - Collected gas usage data
 */
export class GasEstimator {
  /**
   * Create a new GasEstimator instance
   * @param {Object} provider - Ethereum provider
   * @param {Object} options - Configuration options
   * @param {GasPriceMonitor} [options.priceMonitor] - Existing GasPriceMonitor instance
   */
  constructor(provider, options = {}) {
    this.provider = provider;
    this.priceMonitor = options.priceMonitor || new GasPriceMonitor(provider, options);
    this.options = {
      ...options
    };

    this.gasUsageData = {
      [PROOF_TYPES.STANDARD]: [],
      [PROOF_TYPES.THRESHOLD]: [],
      [PROOF_TYPES.MAXIMUM]: [],
      [GAS_OPERATIONS.BATCH]: []
    };
  }

  /**
   * Estimate gas cost for a specific proof operation
   * @param {string} operationType - Type of operation (verify, generate, store, batch)
   * @param {string} proofType - Type of proof (standard, threshold, maximum)
   * @param {number} [proofCount=1] - Number of proofs for batch operations
   * @returns {Promise<Object>} Estimated gas cost data
   */
  async estimateGasCost(operationType, proofType, proofCount = 1) {
    const operationId = `gas_estimator_estimate_${Date.now()}`;
    
    try {
      // Validate inputs
      if (!Object.values(GAS_OPERATIONS).includes(operationType)) {
        throw new InputError(`Invalid operation type: ${operationType}`, {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { validOperations: Object.values(GAS_OPERATIONS) }
        });
      }
      
      if (!Object.values(PROOF_TYPES).includes(proofType)) {
        throw new InputError(`Invalid proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { validProofTypes: Object.values(PROOF_TYPES) }
        });
      }
      
      if (proofCount < 1 || !Number.isInteger(proofCount)) {
        throw new InputError('Proof count must be a positive integer', {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { providedCount: proofCount }
        });
      }
      
      // Get current gas price
      const gasPriceData = await this.priceMonitor.getCurrentGasPrice();
      
      // Get baseline gas amount from targets
      let baseGasAmount = GAS_TARGETS[proofType][operationType];
      
      // For batch operations, calculate based on proof count
      if (operationType === GAS_OPERATIONS.BATCH) {
        // Batch operations have efficiencies of scale
        const batchEfficiency = 0.8; // 20% savings for each additional proof
        baseGasAmount = baseGasAmount + (GAS_TARGETS[proofType][GAS_OPERATIONS.VERIFY] * 
          proofCount * Math.pow(batchEfficiency, proofCount - 1));
      }
      
      // Add 10% safety margin
      const gasLimit = Math.ceil(baseGasAmount * 1.1);
      
      // Calculate gas cost in wei
      const gasCostWei = ethers.BigNumber.from(gasLimit).mul(ethers.BigNumber.from(gasPriceData.gasPrice));
      const gasCostEth = parseFloat(ethers.utils.formatEther(gasCostWei));
      
      // Fetch ETH price for cost estimation
      let ethUsdPrice;
      try {
        ethUsdPrice = await this.priceMonitor.getEthUsdPrice();
      } catch (priceError) {
        // Default to a reasonable value if price fetch fails
        ethUsdPrice = 3000;
        zkErrorLogger.debug('Using default ETH price due to price fetch error', {
          context: 'GasEstimator.estimateGasCost',
          error: priceError.message
        });
      }
      
      // Calculate USD cost
      const costUsd = gasCostEth * ethUsdPrice;
      
      // Format the result
      const result = {
        gasLimit,
        gasPriceWei: gasPriceData.gasPrice,
        gasPriceGwei: gasPriceData.gasPriceGwei,
        costWei: gasCostWei.toString(),
        costEth: gasCostEth,
        ethUsdPrice,
        costUsd,
        baseFeePerGas: gasPriceData.baseFeePerGas,
        maxPriorityFeePerGas: gasPriceData.maxPriorityFeePerGas,
        supportsEIP1559: gasPriceData.supportsEIP1559
      };
      
      if (zkErrorLogger && zkErrorLogger.debug) {
        zkErrorLogger.debug('Gas cost estimated', {
          context: 'GasEstimator.estimateGasCost',
          operationType,
          proofType,
          proofCount,
          gasLimit,
          costEth: gasCostEth,
          costUsd
        });
      }
      
      return result;
    } catch (error) {
      throw logError(error, {
        operation: 'estimateGasCost',
        operationId,
        parameters: { operationType, proofType, proofCount }
      });
    }
  }

  /**
   * Record actual gas usage for a transaction
   * @param {string} proofType - Type of proof (standard, threshold, maximum, batch)
   * @param {number} gasUsed - Actual gas used
   * @returns {Object} Updated gas usage statistics
   */
  recordGasUsage(proofType, gasUsed) {
    const operationId = `gas_estimator_record_${Date.now()}`;
    
    try {
      // Validate inputs
      if (!Object.values(PROOF_TYPES).includes(proofType) && proofType !== GAS_OPERATIONS.BATCH) {
        throw new InputError(`Invalid proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { 
            validTypes: [...Object.values(PROOF_TYPES), GAS_OPERATIONS.BATCH] 
          }
        });
      }
      
      if (typeof gasUsed !== 'number' || gasUsed <= 0) {
        throw new InputError('Gas used must be a positive number', {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { providedGasUsed: gasUsed }
        });
      }
      
      // Add to history
      this.gasUsageData[proofType].push({
        timestamp: Date.now(),
        gasUsed
      });
      
      // Keep history reasonably sized (last 20 entries)
      if (this.gasUsageData[proofType].length > 20) {
        this.gasUsageData[proofType].shift();
      }
      
      // Calculate statistics
      const usageStats = this._calculateGasUsageStats(proofType);
      
      if (zkErrorLogger && zkErrorLogger.debug) {
        zkErrorLogger.debug('Gas usage recorded', {
          context: 'GasEstimator.recordGasUsage',
          proofType,
          gasUsed,
          stats: usageStats
        });
      }
      
      return usageStats;
    } catch (error) {
      throw logError(error, {
        operation: 'recordGasUsage',
        operationId,
        parameters: { proofType, gasUsed }
      });
    }
  }

  /**
   * Get gas usage statistics for a proof type
   * @param {string} proofType - Type of proof
   * @returns {Object} Gas usage statistics
   */
  getGasUsageStats(proofType) {
    const operationId = `gas_estimator_stats_${Date.now()}`;
    
    try {
      // Validate inputs
      if (!Object.values(PROOF_TYPES).includes(proofType) && proofType !== GAS_OPERATIONS.BATCH) {
        throw new InputError(`Invalid proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { 
            validTypes: [...Object.values(PROOF_TYPES), GAS_OPERATIONS.BATCH] 
          }
        });
      }
      
      return this._calculateGasUsageStats(proofType);
    } catch (error) {
      throw logError(error, {
        operation: 'getGasUsageStats',
        operationId,
        parameters: { proofType }
      });
    }
  }

  /**
   * Calculate gas usage statistics for a proof type
   * @param {string} proofType - Type of proof
   * @returns {Object} Gas usage statistics
   * @private
   */
  _calculateGasUsageStats(proofType) {
    const usageData = this.gasUsageData[proofType];
    
    if (!usageData || usageData.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0
      };
    }
    
    const gasValues = usageData.map(entry => entry.gasUsed);
    const count = gasValues.length;
    const min = Math.min(...gasValues);
    const max = Math.max(...gasValues);
    const sum = gasValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    // Calculate median
    const sortedValues = [...gasValues].sort((a, b) => a - b);
    const median = count % 2 === 0
      ? (sortedValues[count / 2 - 1] + sortedValues[count / 2]) / 2
      : sortedValues[Math.floor(count / 2)];
    
    // Calculate standard deviation
    const variance = gasValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    
    return {
      count,
      min,
      max,
      mean,
      median,
      stdDev,
      latest: gasValues[gasValues.length - 1],
      timestamp: usageData[usageData.length - 1].timestamp
    };
  }

  /**
   * Estimate gas parameters for a transaction
   * @param {string} proofType - Type of proof
   * @param {boolean} [useDynamicFee=true] - Whether to use EIP-1559 dynamic fee
   * @returns {Promise<Object>} Gas parameters for transaction
   */
  async estimateTransactionGasParams(proofType, useDynamicFee = true) {
    const operationId = `gas_estimator_tx_params_${Date.now()}`;
    
    try {
      // Validate inputs
      if (!Object.values(PROOF_TYPES).includes(proofType)) {
        throw new InputError(`Invalid proof type: ${proofType}`, {
          code: ErrorCode.INPUT_VALIDATION_ERROR,
          details: { validProofTypes: Object.values(PROOF_TYPES) }
        });
      }
      
      // Get gas price data
      const gasPriceData = await this.priceMonitor.getCurrentGasPrice();
      
      // Get gas limit from targets with 20% safety margin
      const baseGasLimit = GAS_TARGETS[proofType][GAS_OPERATIONS.VERIFY];
      const gasLimit = Math.ceil(baseGasLimit * 1.2);
      
      // Check if network supports EIP-1559
      const supportsEIP1559 = gasPriceData.supportsEIP1559;
      
      // Format transaction parameters
      let txParams;
      
      if (supportsEIP1559 && useDynamicFee) {
        // Use EIP-1559 fee structure
        const baseFee = ethers.BigNumber.from(gasPriceData.baseFeePerGas);
        const priorityFee = ethers.BigNumber.from(gasPriceData.maxPriorityFeePerGas);
        
        // Set max fee per gas to 2x current base fee + priority fee for future base fee changes
        const maxFeePerGas = baseFee.mul(2).add(priorityFee);
        
        txParams = {
          gasLimit,
          maxFeePerGas: maxFeePerGas.toString(),
          maxPriorityFeePerGas: priorityFee.toString(),
          type: 2, // EIP-1559 transaction type
          eip1559: true
        };
      } else {
        // Use legacy fee structure
        txParams = {
          gasLimit,
          gasPrice: gasPriceData.gasPrice,
          eip1559: false
        };
      }
      
      if (zkErrorLogger && zkErrorLogger.debug) {
        zkErrorLogger.debug('Transaction gas parameters estimated', {
          context: 'GasEstimator.estimateTransactionGasParams',
          proofType,
          useDynamicFee,
          eip1559: txParams.eip1559,
          gasLimit
        });
      }
      
      return txParams;
    } catch (error) {
      throw logError(error, {
        operation: 'estimateTransactionGasParams',
        operationId,
        parameters: { proofType, useDynamicFee }
      });
    }
  }
}

// Export default instance
export default GasEstimator;