/**
 * @fileoverview Gas Module Index
 * 
 * This module coordinates gas management for ZK proof operations.
 * It exports the gas management components and provides a unified interface.
 * 
 * @module gas
 */

import { gasEstimator, GasEstimator, GAS_LIMITS } from './GasEstimator.js';
import { gasPriceMonitor, GasPriceMonitor } from './GasPriceMonitor.js';
import { gasOptimizer, GasOptimizer, OPTIMIZATION_LEVELS, OPTIMIZATION_STRATEGIES } from './GasOptimizer.js';

/**
 * Gas management unified interface
 */
const gasManager = {
  /**
   * Estimate gas cost for an operation
   * @param {string} operation - Operation name
   * @param {Object} options - Options for estimation
   * @returns {Promise<Object>} Gas estimate
   */
  estimateGas: async (operation, options = {}) => {
    return gasEstimator.estimateGasCost(operation, options);
  },
  
  /**
   * Get current gas prices
   * @param {string} [network='ethereum'] - Network to get prices for
   * @returns {Promise<Object>} Current gas prices
   */
  getCurrentPrices: async (network = 'ethereum') => {
    const networkEstimator = { ...gasEstimator };
    networkEstimator.network = network;
    return networkEstimator.fetchGasPrices();
  },
  
  /**
   * Get gas price recommendations
   * @param {string} [network='ethereum'] - Network to get recommendations for
   * @returns {Promise<Object>} Gas price recommendations
   */
  getPriceRecommendations: async (network = 'ethereum') => {
    return gasPriceMonitor.getGasPriceRecommendations(network);
  },
  
  /**
   * Compare gas costs for different operations
   * @param {Array<string>} operations - Operations to compare
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Gas cost comparison
   */
  compareGasCosts: async (operations, options = {}) => {
    return gasEstimator.compareGasCosts(operations, options);
  },
  
  /**
   * Optimize a proof operation for gas efficiency
   * @param {string} operation - Operation name
   * @param {Object|Array<Object>} input - Operation input or array of inputs
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimized result
   */
  optimizeGas: async (operation, input, options = {}) => {
    return gasOptimizer.optimize(operation, input, options);
  },
  
  /**
   * Get gas savings recommendations
   * @param {string} operation - Operation name
   * @param {Object} input - Operation input
   * @returns {Promise<Object>} Optimization recommendations
   */
  getGasSavingsRecommendations: async (operation, input) => {
    return gasOptimizer.getOptimizationRecommendations(operation, input);
  },
  
  /**
   * Start monitoring gas prices
   * @param {Array<string>} [networks=['ethereum']] - Networks to monitor
   * @param {Object} options - Monitoring options
   * @returns {boolean} Whether monitoring was started
   */
  startMonitoring: (networks = ['ethereum'], options = {}) => {
    const monitor = networks.length > 1 
      ? new GasPriceMonitor({ networks, ...options })
      : gasPriceMonitor;
    
    if (networks.length > 1) {
      monitor.networks = networks;
    }
    
    return monitor.startMonitoring();
  },
  
  /**
   * Stop monitoring gas prices
   * @returns {boolean} Whether monitoring was stopped
   */
  stopMonitoring: () => {
    return gasPriceMonitor.stopMonitoring();
  },
  
  /**
   * Set gas price alert thresholds
   * @param {Object} thresholds - Alert thresholds
   */
  setAlertThresholds: (thresholds) => {
    gasPriceMonitor.setThresholds(thresholds);
  },
  
  /**
   * Set optimization level
   * @param {string} level - Optimization level
   */
  setOptimizationLevel: (level) => {
    if (OPTIMIZATION_LEVELS[level.toUpperCase()]) {
      gasOptimizer.defaultLevel = OPTIMIZATION_LEVELS[level.toUpperCase()];
    }
  },
  
  /**
   * Get gas management metrics
   * @returns {Object} Combined metrics
   */
  getMetrics: () => {
    return {
      optimization: gasOptimizer.getStats(),
      limits: { ...GAS_LIMITS },
      thresholds: gasPriceMonitor.getThresholds()
    };
  },
  
  // Export components for direct access
  estimator: gasEstimator,
  monitor: gasPriceMonitor,
  optimizer: gasOptimizer,
  
  // Constants
  OPTIMIZATION_LEVELS,
  OPTIMIZATION_STRATEGIES,
  GAS_LIMITS
};

// Export gas manager and components
export { 
  gasManager,
  gasEstimator,
  gasPriceMonitor,
  gasOptimizer,
  GasEstimator,
  GasPriceMonitor,
  GasOptimizer,
  OPTIMIZATION_LEVELS,
  OPTIMIZATION_STRATEGIES,
  GAS_LIMITS
};

// Default export
export default gasManager;