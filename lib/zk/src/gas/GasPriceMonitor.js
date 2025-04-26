/**
 * @fileoverview Gas Price Monitor
 * 
 * Monitors gas prices across different networks and provides alerts for significant changes.
 * Uses CoinGecko API for real-time gas price data.
 * 
 * @module GasPriceMonitor
 */

// Import dependencies
import fetch from 'node-fetch';
import { EventEmitter } from 'events';
import { errorLogger } from '../error/ErrorSystem.js';
import { gasEstimator } from './GasEstimator.js';

// Gas price threshold defaults
const DEFAULT_THRESHOLDS = {
  PRICE_INCREASE_PERCENT: 20, // 20% increase to trigger alert
  PRICE_DECREASE_PERCENT: 30, // 30% decrease to trigger alert
  ABSOLUTE_HIGH_GWEI: 150,    // Absolute high threshold in Gwei
  RECOMMENDED_BASE_ADJUSTMENT: 1.2, // Multiplier for base fee
};

/**
 * Gas price monitor for tracking gas prices and triggering alerts
 */
class GasPriceMonitor extends EventEmitter {
  /**
   * Create a new gas price monitor
   * @param {Object} options - Configuration options
   * @param {Array<string>} [options.networks=['ethereum']] - Networks to monitor
   * @param {boolean} [options.autostart=false] - Whether to start monitoring automatically
   * @param {number} [options.interval=120000] - Monitoring interval in ms (default 2min)
   * @param {Object} [options.thresholds] - Alert thresholds
   */
  constructor(options = {}) {
    super();
    
    this.networks = options.networks || ['ethereum'];
    this.interval = options.interval || 120000; // 2 minutes
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.autostart = options.autostart || false;
    
    // Store previous prices for comparison
    this.previousPrices = {};
    
    // Monitoring interval ID
    this.monitoringInterval = null;
    
    // Track monitoring status
    this.isMonitoring = false;
    
    // Initialize network data
    this.initializeNetworks();
    
    // Start monitoring if autostart is enabled
    if (this.autostart) {
      this.startMonitoring();
    }
  }
  
  /**
   * Initialize network tracking data
   * @private
   */
  initializeNetworks() {
    this.networks.forEach(network => {
      this.previousPrices[network] = {
        timestamp: 0,
        slow: 0,
        standard: 0,
        fast: 0,
        rapid: 0
      };
    });
  }
  
  /**
   * Start gas price monitoring
   * @returns {boolean} Whether monitoring was started
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return false;
    }
    
    this.isMonitoring = true;
    
    // Perform initial check
    this.checkGasPrices();
    
    // Set up interval for checks
    this.monitoringInterval = setInterval(() => {
      this.checkGasPrices();
    }, this.interval);
    
    // Log and emit event
    const message = `Gas price monitoring started for networks: ${this.networks.join(', ')}`;
    errorLogger.info(message);
    this.emit('monitoringStarted', { networks: this.networks });
    
    return true;
  }
  
  /**
   * Stop gas price monitoring
   * @returns {boolean} Whether monitoring was stopped
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return false;
    }
    
    // Clear interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    
    // Log and emit event
    errorLogger.info('Gas price monitoring stopped');
    this.emit('monitoringStopped');
    
    return true;
  }
  
  /**
   * Check gas prices across monitored networks
   * @async
   */
  async checkGasPrices() {
    for (const network of this.networks) {
      try {
        // Set network on the estimator
        const networkEstimator = { ...gasEstimator };
        networkEstimator.network = network;
        
        // Fetch current prices
        const priceData = await networkEstimator.fetchGasPrices();
        
        // Get previous prices for this network
        const previousPrices = this.previousPrices[network];
        
        // Skip if this is the first check
        if (previousPrices.timestamp === 0) {
          this.updatePreviousPrices(network, priceData);
          continue;
        }
        
        // Check for significant changes
        this.checkForSignificantChanges(network, priceData, previousPrices);
        
        // Update previous prices
        this.updatePreviousPrices(network, priceData);
      } catch (error) {
        errorLogger.error(`Error checking gas prices for ${network}`, {
          network,
          error: error.message
        });
        
        // Emit error event
        this.emit('error', {
          network,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Update previous prices for a network
   * @param {string} network - Network name
   * @param {Object} priceData - Current price data
   * @private
   */
  updatePreviousPrices(network, priceData) {
    this.previousPrices[network] = {
      timestamp: Date.now(),
      slow: priceData.gas.slow,
      standard: priceData.gas.standard,
      fast: priceData.gas.fast,
      rapid: priceData.gas.rapid,
      ethUsd: priceData.eth.usd
    };
  }
  
  /**
   * Check for significant gas price changes
   * @param {string} network - Network name
   * @param {Object} currentPrices - Current price data
   * @param {Object} previousPrices - Previous price data
   * @private
   */
  checkForSignificantChanges(network, currentPrices, previousPrices) {
    // Check standard price increase
    const standardPrice = currentPrices.gas.standard;
    const prevStandardPrice = previousPrices.standard;
    const percentChange = ((standardPrice - prevStandardPrice) / prevStandardPrice) * 100;
    
    // Alert on significant increase
    if (percentChange >= this.thresholds.PRICE_INCREASE_PERCENT) {
      this.emitPriceAlert(network, 'increase', {
        current: standardPrice,
        previous: prevStandardPrice,
        percentChange,
        level: this.getAlertLevel(percentChange)
      });
    }
    // Alert on significant decrease
    else if (percentChange <= -this.thresholds.PRICE_DECREASE_PERCENT) {
      this.emitPriceAlert(network, 'decrease', {
        current: standardPrice,
        previous: prevStandardPrice,
        percentChange,
        level: 'info'
      });
    }
    
    // Alert on absolute high threshold
    if (standardPrice >= this.thresholds.ABSOLUTE_HIGH_GWEI) {
      this.emitPriceAlert(network, 'high', {
        current: standardPrice,
        threshold: this.thresholds.ABSOLUTE_HIGH_GWEI,
        level: 'warning'
      });
    }
  }
  
  /**
   * Get alert level based on price change magnitude
   * @param {number} percentChange - Percent change in price
   * @returns {string} Alert level (info, warning, critical)
   * @private
   */
  getAlertLevel(percentChange) {
    if (percentChange >= 100) { // 100% or more increase
      return 'critical';
    } else if (percentChange >= 50) { // 50% or more increase
      return 'warning';
    } else {
      return 'info';
    }
  }
  
  /**
   * Emit price alert event
   * @param {string} network - Network name
   * @param {string} type - Alert type (increase, decrease, high)
   * @param {Object} data - Alert data
   * @private
   */
  emitPriceAlert(network, type, data) {
    const alert = {
      network,
      type,
      timestamp: Date.now(),
      ...data
    };
    
    // Emit event
    this.emit('gasPriceAlert', alert);
    
    // Log alert
    const logLevel = data.level || 'info';
    const message = this.formatAlertMessage(network, type, data);
    
    errorLogger[logLevel](message, {
      component: 'GasPriceMonitor',
      alert
    });
  }
  
  /**
   * Format alert message for logging
   * @param {string} network - Network name
   * @param {string} type - Alert type
   * @param {Object} data - Alert data
   * @returns {string} Formatted message
   * @private
   */
  formatAlertMessage(network, type, data) {
    switch (type) {
      case 'increase':
        return `[${network}] Gas price increased by ${data.percentChange.toFixed(2)}% (${data.previous} → ${data.current} Gwei)`;
      case 'decrease':
        return `[${network}] Gas price decreased by ${Math.abs(data.percentChange).toFixed(2)}% (${data.previous} → ${data.current} Gwei)`;
      case 'high':
        return `[${network}] Gas price is high: ${data.current} Gwei (threshold: ${data.threshold} Gwei)`;
      default:
        return `[${network}] Gas price alert: ${JSON.stringify(data)}`;
    }
  }
  
  /**
   * Get current gas price recommendations
   * @param {string} [network='ethereum'] - Network to get recommendations for
   * @returns {Promise<Object>} Gas price recommendations
   * @async
   */
  async getGasPriceRecommendations(network = 'ethereum') {
    try {
      // Set network on the estimator
      const networkEstimator = { ...gasEstimator };
      networkEstimator.network = network;
      
      // Fetch current prices
      const priceData = await networkEstimator.fetchGasPrices();
      
      // Add recommendations
      return {
        timestamp: Date.now(),
        network,
        current: {
          slow: priceData.gas.slow,
          standard: priceData.gas.standard,
          fast: priceData.gas.fast,
          rapid: priceData.gas.rapid,
        },
        recommended: {
          slow: Math.ceil(priceData.gas.slow * 1.05), // +5% buffer
          standard: Math.ceil(priceData.gas.standard * 1.1), // +10% buffer
          fast: Math.ceil(priceData.gas.fast * 1.05), // +5% buffer
          rapid: Math.ceil(priceData.gas.rapid)
        },
        ethUsd: priceData.eth.usd,
        costUsd: priceData.costUsd
      };
    } catch (error) {
      errorLogger.error(`Error getting gas price recommendations for ${network}`, {
        network,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Set alert thresholds
   * @param {Object} thresholds - New thresholds
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
  
  /**
   * Get current alert thresholds
   * @returns {Object} Current thresholds
   */
  getThresholds() {
    return { ...this.thresholds };
  }
}

// Create and export default instance
const gasPriceMonitor = new GasPriceMonitor();

export { 
  gasPriceMonitor, 
  GasPriceMonitor, 
  DEFAULT_THRESHOLDS 
};

export default gasPriceMonitor;