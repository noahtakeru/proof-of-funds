/**
 * Gas Management System for Zero-Knowledge Proof Verification
 * 
 * This module exports a comprehensive system for estimating, tracking,
 * and optimizing gas costs for on-chain verification of zero-knowledge proofs.
 * 
 * The functionality is organized into three focused components:
 * 1. GasEstimator - Estimates gas usage for different proof operations
 * 2. GasPriceMonitor - Tracks and predicts gas prices
 * 3. GasOptimizer - Optimizes gas usage and transaction timing
 * 
 * This file provides backward compatibility with the original GasManager API
 * while using the new modularized implementation.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module helps manage the "fuel" needed to run our privacy system on the blockchain.
 * It's organized into three specialized components that work together:
 * 
 * 1. ESTIMATOR: Predicts how much "fuel" different operations will use
 * 2. PRICE MONITOR: Tracks the current "fuel price" to optimize timing
 * 3. OPTIMIZER: Finds ways to minimize fuel consumption and costs
 * 
 * This structural change improves maintainability while preserving all functionality.
 */

// Import components
import { GasPriceMonitor } from './GasPriceMonitor.js';
import { 
  GasEstimator, 
  GAS_OPERATIONS, 
  PROOF_TYPES, 
  GAS_TARGETS 
} from './GasEstimator.js';
import { 
  GasOptimizer, 
  TIMING_STRATEGIES, 
  OPTIMIZATION_STRATEGIES,
  calculateGasSavings
} from './GasOptimizer.js';

/**
 * Unified GasManager class that combines functionality from all components
 * while maintaining backward compatibility
 * 
 * @class GasManager
 */
export class GasManager {
  /**
   * Create a new GasManager instance
   * @param {Object} provider - Ethereum provider 
   * @param {Object} options - Configuration options
   */
  constructor(provider, options = {}) {
    // Create component instances
    this.priceMonitor = new GasPriceMonitor(provider, options);
    this.estimator = new GasEstimator(provider, { priceMonitor: this.priceMonitor, ...options });
    this.optimizer = new GasOptimizer(provider, { 
      priceMonitor: this.priceMonitor, 
      estimator: this.estimator,
      ...options 
    });
    
    // Store provider and options
    this.provider = provider;
    this.options = options;
    
    // Map component data to legacy properties for backward compatibility
    this.gasPriceHistory = this.priceMonitor.gasPriceHistory;
    this.lastPriceUpdate = this.priceMonitor.lastPriceUpdate;
    this.gasUsageData = this.estimator.gasUsageData;
    this.priceCache = this.priceMonitor.priceCache;
  }
  
  // ------------------------------------------------------------------------
  // Methods from GasPriceMonitor
  // ------------------------------------------------------------------------
  
  /**
   * Get current gas price with caching
   * @returns {Promise<Object>} Gas price data including base fee and priority fee
   */
  async getCurrentGasPrice() {
    const result = await this.priceMonitor.getCurrentGasPrice();
    
    // Update local references to maintain backward compatibility
    this.gasPriceHistory = this.priceMonitor.gasPriceHistory;
    this.lastPriceUpdate = this.priceMonitor.lastPriceUpdate;
    
    return result;
  }
  
  /**
   * Get gas price history
   * @returns {Array<Object>} Historical gas price data
   */
  getGasPriceHistory() {
    return this.priceMonitor.getGasPriceHistory();
  }
  
  /**
   * Fetch cryptocurrency prices from CoinGecko API
   * @param {Array<string>} symbols - Array of cryptocurrency symbols to fetch prices for
   * @returns {Promise<Object>} Dictionary of symbol to USD price
   */
  async fetchPricesForSymbols(symbols = ['ethereum']) {
    const result = await this.priceMonitor.fetchPricesForSymbols(symbols);
    
    // Update local reference to maintain backward compatibility
    this.priceCache = this.priceMonitor.priceCache;
    
    return result;
  }
  
  /**
   * Get ETH price in USD using CoinGecko API
   * @returns {Promise<number>} ETH price in USD
   */
  async getEthUsdPrice() {
    return this.priceMonitor.getEthUsdPrice();
  }
  
  // ------------------------------------------------------------------------
  // Methods from GasEstimator
  // ------------------------------------------------------------------------
  
  /**
   * Estimate gas cost for a specific proof operation
   * @param {string} operationType - Type of operation (verify, generate, store, batch)
   * @param {string} proofType - Type of proof (standard, threshold, maximum)
   * @param {number} [proofCount=1] - Number of proofs for batch operations
   * @returns {Promise<Object>} Estimated gas cost data
   */
  async estimateGasCost(operationType, proofType, proofCount = 1) {
    return this.estimator.estimateGasCost(operationType, proofType, proofCount);
  }
  
  /**
   * Record actual gas usage for a transaction
   * @param {string} proofType - Type of proof (standard, threshold, maximum, batch)
   * @param {number} gasUsed - Actual gas used
   * @returns {Object} Updated gas usage statistics
   */
  recordGasUsage(proofType, gasUsed) {
    const result = this.estimator.recordGasUsage(proofType, gasUsed);
    
    // Update local reference to maintain backward compatibility
    this.gasUsageData = this.estimator.gasUsageData;
    
    return result;
  }
  
  /**
   * Get gas usage statistics for a proof type
   * @param {string} proofType - Type of proof
   * @returns {Object} Gas usage statistics
   */
  getGasUsageStats(proofType) {
    return this.estimator.getGasUsageStats(proofType);
  }
  
  /**
   * Estimate gas parameters for a transaction
   * @param {string} proofType - Type of proof
   * @param {boolean} [useDynamicFee=true] - Whether to use EIP-1559 dynamic fee
   * @returns {Promise<Object>} Gas parameters for transaction
   */
  async estimateTransactionGasParams(proofType, useDynamicFee = true) {
    return this.estimator.estimateTransactionGasParams(proofType, useDynamicFee);
  }
  
  // ------------------------------------------------------------------------
  // Methods from GasOptimizer
  // ------------------------------------------------------------------------
  
  /**
   * Calculate optimal gas parameters for transaction
   * @param {string} txType - Transaction type (standard, threshold, maximum)
   * @returns {Promise<Object>} Optimal gas parameters
   */
  async getOptimalGasParams(txType = 'standard') {
    return this.optimizer.getOptimalGasParams(txType);
  }
  
  /**
   * Calculate optimal batch size for multiple operations
   * @param {string} proofType - Type of proof
   * @param {number} operationCount - Number of operations to process
   * @returns {Promise<Object>} Optimal batch size and expected savings
   */
  async calculateOptimalBatchSize(proofType, operationCount) {
    return this.optimizer.calculateOptimalBatchSize(proofType, operationCount);
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
    return this.optimizer.recommendTransactionTiming(options);
  }
}

// Export everything
export {
  GasPriceMonitor,
  GasEstimator,
  GasOptimizer,
  GAS_OPERATIONS,
  PROOF_TYPES,
  GAS_TARGETS,
  TIMING_STRATEGIES,
  OPTIMIZATION_STRATEGIES,
  calculateGasSavings
};

// Export default instance
export default GasManager;