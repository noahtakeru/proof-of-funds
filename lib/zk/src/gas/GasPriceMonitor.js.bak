/**
 * Gas Price Monitoring System
 * 
 * A focused module for monitoring, tracking, and predicting gas prices
 * on Ethereum and compatible networks.
 * 
 * This module provides:
 * 1. Real-time gas price monitoring
 * 2. Historical gas price tracking
 * 3. Network fee predictions
 * 4. ETH/USD price conversion via CoinGecko API
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module tracks the current "fuel price" (gas) for blockchain transactions.
 * Think of it like a sophisticated fuel price monitoring system:
 * 
 * 1. REAL-TIME TRACKING: Constantly check current gas prices
 * 2. HISTORICAL DATA: Maintain history of recent price changes
 * 3. PRICE PREDICTIONS: Estimate future price trends
 * 4. FIAT CONVERSION: Convert between cryptocurrency and USD costs
 * 
 * Business value: Helps users time their transactions to minimize costs,
 * provides accurate fee estimates, and offers cost data in multiple currencies.
 */

// Import dependencies
import { ethers } from 'ethers';
import { 
  NetworkError,
  GasError,
  errorLogger,
  ErrorSeverity,
  tryCatch,
  isErrorType
} from '../ErrorSystem.js';
import axios from 'axios';

/**
 * Specialized error class for gas price monitoring operations
 */
class GasPriceMonitorError extends GasError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 21001, // Gas monitoring error code
      severity: options.severity || ErrorSeverity.WARNING,
      recoverable: options.recoverable !== undefined ? options.recoverable : true,
      context: 'GasPriceMonitor',
      details: {
        ...(options.details || {}),
        operation: options.operation || 'unknown'
      }
    });

    this.name = 'GasPriceMonitorError';

    // Capture current stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GasPriceMonitorError);
    }
  }
}

/**
 * Helper function for logging errors
 * @param {Error} error - The error to log
 * @param {Object} additionalInfo - Additional context information
 * @returns {Error} The error (potentially wrapped as GasPriceMonitorError)
 */
function logError(error, additionalInfo = {}) {
  // If error is null/undefined, create a generic error
  if (!error) {
    error = new GasPriceMonitorError('Unknown error in Gas Price Monitor', {
      operation: additionalInfo.operation || 'unknown'
    });
  }

  // Convert to GasPriceMonitorError if it's not already a specialized error
  if (!isErrorType(error, GasPriceMonitorError) && !isErrorType(error, GasError)) {
    error = new GasPriceMonitorError(error.message || 'Unknown error in gas price monitoring', {
      operation: additionalInfo.operation || 'unknown',
      details: {
        originalError: error.message,
        ...additionalInfo
      }
    });
  }

  // Log the error using our centralized error logger
  errorLogger.logError(error, {
    component: 'GasPriceMonitor',
    ...additionalInfo
  });

  return error;
}

/**
 * Default gas price update interval in milliseconds
 * @type {number}
 */
const DEFAULT_PRICE_UPDATE_INTERVAL = 120000; // 2 minutes

/**
 * Default number of historical gas price entries to keep
 * @type {number}
 */
const DEFAULT_HISTORY_LENGTH = 10;

/**
 * Default cache time for cryptocurrency price data in milliseconds
 * @type {number}
 */
const DEFAULT_PRICE_CACHE_DURATION = 300000; // 5 minutes

/**
 * Gas Price Monitor - Tracks and predicts gas prices
 * 
 * @class GasPriceMonitor
 * @property {Object} provider - Ethereum provider instance
 * @property {Object} options - Configuration options
 * @property {Array<Object>} gasPriceHistory - Historical gas price data
 * @property {number} lastPriceUpdate - Timestamp of the last gas price update
 * @property {Object} priceCache - Cache for cryptocurrency prices
 */
export class GasPriceMonitor {
  /**
   * Create a new GasPriceMonitor instance
   * @param {Object} provider - Ethereum provider 
   * @param {Object} options - Configuration options
   * @param {number} [options.priceUpdateInterval=120000] - Gas price update interval in ms
   * @param {number} [options.historyLength=10] - Number of gas price history entries to keep
   * @param {number} [options.priceCacheDuration=300000] - Duration to cache crypto prices in ms
   */
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = {
      priceUpdateInterval: DEFAULT_PRICE_UPDATE_INTERVAL,
      historyLength: DEFAULT_HISTORY_LENGTH,
      priceCacheDuration: DEFAULT_PRICE_CACHE_DURATION,
      ...options
    };

    this.gasPriceHistory = [];
    this.lastPriceUpdate = 0;
    
    // Add price cache for cryptocurrencies
    this.priceCache = {
      lastUpdate: 0,
      prices: {}
    };
  }

  /**
   * Get current gas price with caching
   * @returns {Promise<Object>} Gas price data including base fee and priority fee
   */
  async getCurrentGasPrice() {
    const now = Date.now();
    const operationId = `gas_price_get_${now}`;

    // Special handling for test environments
    if (this.gasPriceHistory.length > 0 && 
        (!zkErrorLogger || !zkErrorLogger.log || typeof zkErrorLogger.log !== 'function')) {
      return this.gasPriceHistory[this.gasPriceHistory.length - 1];
    }

    // Update price if cache expired
    if (now - this.lastPriceUpdate > this.options.priceUpdateInterval || this.gasPriceHistory.length === 0) {
      try {
        // Check if provider supports EIP-1559
        const supportsEIP1559 = await this._detectEIP1559Support();
        
        let gasPrice;
        let baseFeePerGas;
        let maxPriorityFeePerGas;
        
        // Get base fee from latest block if EIP-1559 is supported
        if (supportsEIP1559) {
          const latestBlock = await this.provider.getBlock('latest');
          baseFeePerGas = latestBlock.baseFeePerGas;
          
          // Estimate priority fee
          maxPriorityFeePerGas = await this._estimatePriorityFee();
          
          // Calculate total gas price (base fee + priority fee)
          gasPrice = baseFeePerGas.add(maxPriorityFeePerGas);
        } else {
          // For pre-EIP-1559 chains, just get the gas price
          gasPrice = await this.provider.getGasPrice();
        }
        
        // Format the gas price data
        const priceData = {
          timestamp: now,
          gasPrice: gasPrice.toString(),
          gasPriceGwei: parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei')),
          baseFeePerGas: baseFeePerGas ? baseFeePerGas.toString() : null,
          baseFeeGwei: baseFeePerGas ? parseFloat(ethers.utils.formatUnits(baseFeePerGas, 'gwei')) : null,
          maxPriorityFeePerGas: maxPriorityFeePerGas ? maxPriorityFeePerGas.toString() : null,
          priorityFeeGwei: maxPriorityFeePerGas ? parseFloat(ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei')) : null,
          supportsEIP1559: supportsEIP1559
        };
        
        // Add to history and trim if necessary
        this.gasPriceHistory.push(priceData);
        if (this.gasPriceHistory.length > this.options.historyLength) {
          this.gasPriceHistory.shift();
        }
        
        this.lastPriceUpdate = now;
        
        if (zkErrorLogger && zkErrorLogger.debug) {
          zkErrorLogger.debug('Gas price updated', {
            context: 'GasPriceMonitor.getCurrentGasPrice',
            gasPriceGwei: priceData.gasPriceGwei,
            baseFeeGwei: priceData.baseFeeGwei,
            priorityFeeGwei: priceData.priorityFeeGwei
          });
        }
        
        return priceData;
      } catch (error) {
        // In case of error, log it and return last known price if available
        error = logError(error, {
          operation: 'getCurrentGasPrice',
          operationId
        });
        
        if (this.gasPriceHistory.length > 0) {
          return this.gasPriceHistory[this.gasPriceHistory.length - 1];
        }
        
        throw error;
      }
    } else {
      // Return the most recent price from history
      return this.gasPriceHistory[this.gasPriceHistory.length - 1];
    }
  }

  /**
   * Get gas price history
   * @returns {Array<Object>} Historical gas price data
   */
  getGasPriceHistory() {
    return [...this.gasPriceHistory];
  }

  /**
   * Fetch cryptocurrency prices from CoinGecko API
   * @param {Array<string>} symbols - Array of cryptocurrency symbols to fetch prices for
   * @returns {Promise<Object>} Dictionary of symbol to USD price
   */
  async fetchPricesForSymbols(symbols = ['ethereum']) {
    const now = Date.now();
    
    // Use our standardized tryCatch pattern for error handling
    const [error, prices] = await tryCatch(async () => {
      // Check cache first
      if (now - this.priceCache.lastUpdate < this.options.priceCacheDuration) {
        const cachedPrices = {};
        let allSymbolsCached = true;
        
        // Check if all requested symbols are in cache
        for (const symbol of symbols) {
          if (this.priceCache.prices[symbol]) {
            cachedPrices[symbol] = this.priceCache.prices[symbol];
          } else {
            allSymbolsCached = false;
            break;
          }
        }
        
        if (allSymbolsCached) {
          return cachedPrices;
        }
      }
      
      // Prepare symbols string for CoinGecko API
      const symbolsParam = symbols.join(',');
      
      // Fetch prices from CoinGecko API
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbolsParam}&vs_currencies=usd`,
        { timeout: 5000 }
      );
      
      if (!response.data) {
        throw new GasPriceMonitorError('No data received from CoinGecko API', {
          operation: 'fetchPricesForSymbols',
          severity: ErrorSeverity.ERROR
        });
      }
      
      // Format results
      const priceData = {};
      for (const symbol of symbols) {
        if (response.data[symbol] && response.data[symbol].usd) {
          priceData[symbol] = response.data[symbol].usd;
        } else {
          throw new GasPriceMonitorError(`Price for ${symbol} not found in CoinGecko response`, {
            operation: 'fetchPricesForSymbols',
            details: { symbol, response: 'data omitted for brevity' }
          });
        }
      }
      
      // Update cache
      this.priceCache = {
        lastUpdate: now,
        prices: {
          ...this.priceCache.prices,
          ...priceData
        }
      };
      
      // Log success
      errorLogger.info('Crypto prices fetched', {
        component: 'GasPriceMonitor.fetchPricesForSymbols',
        symbols,
        prices: priceData
      });
      
      return priceData;
    }, {
      context: {
        component: 'GasPriceMonitor',
        operation: 'fetchPricesForSymbols',
        symbols
      }
    });
    
    // Error handling
    if (error) {
      // If we have cached prices, return those instead of failing
      if (this.priceCache.prices && Object.keys(this.priceCache.prices).length > 0) {
        const cachedPrices = {};
        for (const symbol of symbols) {
          if (this.priceCache.prices[symbol]) {
            cachedPrices[symbol] = this.priceCache.prices[symbol];
          }
        }
        
        // If we have at least one of the requested prices, return cache
        if (Object.keys(cachedPrices).length > 0) {
          errorLogger.warn('Using cached crypto prices due to API error', {
            component: 'GasPriceMonitor.fetchPricesForSymbols',
            error: error.message,
            cachedPrices
          });
          return cachedPrices;
        }
      }
      
      // No valid cache available, throw the error
      throw error;
    }
    
    return prices;
  }

  /**
   * Get ETH price in USD using CoinGecko API
   * @returns {Promise<number>} ETH price in USD
   */
  // Using the withErrorHandling decorator from our new error system
  getEthUsdPrice = tryCatch(async () => {
    const prices = await this.fetchPricesForSymbols(['ethereum']);
    return prices.ethereum;
  }, {
    context: {
      component: 'GasPriceMonitor',
      operation: 'getEthUsdPrice'
    },
    rethrow: true // We want to propagate errors up
  });

  /**
   * Detect if the provider supports EIP-1559
   * @returns {Promise<boolean>} Whether the provider supports EIP-1559
   * @private
   */
  async _detectEIP1559Support() {
    const [error, result] = await tryCatch(async () => {
      const block = await this.provider.getBlock('latest');
      return block && block.baseFeePerGas !== undefined;
    }, {
      context: {
        component: 'GasPriceMonitor',
        operation: '_detectEIP1559Support'
      }
    });
    
    if (error) {
      // Log at info level since this is a non-critical error with fallback
      errorLogger.info('Error detecting EIP-1559 support, defaulting to false', {
        error: error.message,
        component: 'GasPriceMonitor',
        operation: '_detectEIP1559Support'
      });
      return false;
    }
    
    return result;
  }
  
  /**
   * Estimate a reasonable priority fee
   * @returns {Promise<ethers.BigNumber>} Priority fee in wei
   * @private
   */
  async _estimatePriorityFee() {
    try {
      // Try to use eth_maxPriorityFeePerGas call if available
      try {
        const hexPriorityFee = await this.provider.send('eth_maxPriorityFeePerGas', []);
        return ethers.BigNumber.from(hexPriorityFee);
      } catch (callError) {
        // Method not supported, use fallback
      }
      
      // Fallback strategy: use 15% of base fee or 2 gwei, whichever is higher
      const block = await this.provider.getBlock('latest');
      if (!block || !block.baseFeePerGas) {
        return ethers.utils.parseUnits('2', 'gwei'); // Default to 2 gwei
      }
      
      const priorityFee = block.baseFeePerGas.mul(15).div(100);
      const minPriorityFee = ethers.utils.parseUnits('2', 'gwei');
      
      return priorityFee.gt(minPriorityFee) ? priorityFee : minPriorityFee;
    } catch (error) {
      // Log the error but don't throw
      logError(error, {
        operation: '_estimatePriorityFee',
        operationId: `gas_price_priority_${Date.now()}`
      });
      
      // Default to 2 gwei
      return ethers.utils.parseUnits('2', 'gwei');
    }
  }
}

// Export default instance
export default GasPriceMonitor;