/**
 * @fileoverview Gas Estimator
 * 
 * Estimates gas costs for blockchain transactions including ZK proof verification.
 * Integrates with CoinGecko API for real-time gas price data.
 * 
 * @module GasEstimator
 */

// Import dependencies
import fetch from 'node-fetch';
import { ethers } from 'ethers';
import { errorLogger } from '../error/ErrorSystem.js';

// Constants for gas estimation
const GAS_LIMITS = {
  STANDARD_PROOF_VERIFICATION: 250000,
  MAXIMUM_PROOF_VERIFICATION: 350000,
  THRESHOLD_PROOF_VERIFICATION: 300000,
  PROOF_OF_FUNDS_DEPOSIT: 120000,
  PROOF_OF_FUNDS_WITHDRAW: 150000,
  CONTRACT_DEPLOYMENT: 3500000
};

// Gas price API URL (CoinGecko)
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

/**
 * Gas Estimator class for calculating gas costs of ZK proof operations
 */
class GasEstimator {
  /**
   * Create a new GasEstimator
   * @param {Object} options - Configuration options
   * @param {string} [options.network='ethereum'] - Blockchain network
   * @param {string} [options.etherscanApiKey] - Etherscan API key
   * @param {boolean} [options.useCoinGecko=true] - Whether to use CoinGecko for prices
   * @param {number} [options.cacheTimeMs=60000] - How long to cache gas prices (ms)
   * @param {boolean} [options.fallbackToEstimate=true] - Whether to fallback to estimates
   */
  constructor(options = {}) {
    this.network = options.network || 'ethereum';
    this.etherscanApiKey = options.etherscanApiKey || null;
    this.useCoinGecko = options.useCoinGecko !== false;
    this.cacheTimeMs = options.cacheTimeMs || 60000; // 1 minute
    this.fallbackToEstimate = options.fallbackToEstimate !== false;
    
    // Cache for gas prices
    this.priceCache = {
      timestamp: 0,
      prices: null
    };
    
    // Cache for gas estimates
    this.estimateCache = {
      timestamp: 0,
      estimates: {}
    };
    
    // Provider for gas estimates
    this.provider = null;
  }
  
  /**
   * Set the Ethereum provider
   * @param {ethers.providers.Provider} provider - Ethers provider
   */
  setProvider(provider) {
    this.provider = provider;
  }
  
  /**
   * Get the current provider
   * @returns {ethers.providers.Provider|null} Current provider
   */
  getProvider() {
    if (this.provider) {
      return this.provider;
    }
    
    // Create default provider if none exists
    try {
      this.provider = ethers.getDefaultProvider(this.network);
      return this.provider;
    } catch (error) {
      errorLogger.warn('Could not create default provider', { 
        error: error.message,
        network: this.network
      });
      return null;
    }
  }
  
  /**
   * Check if the price cache is valid
   * @returns {boolean} True if the cache is valid
   * @private
   */
  isPriceCacheValid() {
    return (
      this.priceCache.prices !== null &&
      Date.now() - this.priceCache.timestamp < this.cacheTimeMs
    );
  }
  
  /**
   * Check if the estimate cache is valid for a specific operation
   * @param {string} operation - Operation name
   * @returns {boolean} True if the cache is valid
   * @private
   */
  isEstimateCacheValid(operation) {
    return (
      this.estimateCache.estimates[operation] !== undefined &&
      Date.now() - this.estimateCache.timestamp < this.cacheTimeMs
    );
  }
  
  /**
   * Fetch current gas prices from CoinGecko API
   * @returns {Promise<Object>} Gas price data
   * @async
   */
  async fetchGasPrices() {
    if (this.isPriceCacheValid()) {
      return this.priceCache.prices;
    }
    
    try {
      // Attempt to get gas prices from CoinGecko if enabled
      if (this.useCoinGecko) {
        const response = await fetch(`${COINGECKO_API_URL}/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true`);
        
        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }
        
        const data = await response.json();
        const ethUsdPrice = data?.ethereum?.usd || 0;
        
        // Fetch gas prices from Etherscan if API key provided
        let gasPrices = { slow: 50, standard: 70, fast: 90, rapid: 110 }; // Defaults
        
        if (this.etherscanApiKey) {
          const gasResponse = await fetch(
            `${ETHERSCAN_API_URL}?module=gastracker&action=gasoracle&apikey=${this.etherscanApiKey}`
          );
          
          if (gasResponse.ok) {
            const gasData = await gasResponse.json();
            
            if (gasData.status === '1') {
              gasPrices = {
                slow: parseInt(gasData.result.SafeGasPrice),
                standard: parseInt(gasData.result.ProposeGasPrice),
                fast: parseInt(gasData.result.FastGasPrice),
                rapid: parseInt(gasData.result.FastGasPrice) * 1.2
              };
            }
          }
        }
        
        // Create formatted price data
        const priceData = {
          eth: {
            usd: ethUsdPrice,
            usdChange24h: data?.ethereum?.usd_24h_change || 0
          },
          gas: {
            slow: gasPrices.slow,
            standard: gasPrices.standard,
            fast: gasPrices.fast,
            rapid: gasPrices.rapid
          },
          costUsd: {
            slow: this.calculateGasCostUsd(GAS_LIMITS.STANDARD_PROOF_VERIFICATION, gasPrices.slow, ethUsdPrice),
            standard: this.calculateGasCostUsd(GAS_LIMITS.STANDARD_PROOF_VERIFICATION, gasPrices.standard, ethUsdPrice),
            fast: this.calculateGasCostUsd(GAS_LIMITS.STANDARD_PROOF_VERIFICATION, gasPrices.fast, ethUsdPrice),
            rapid: this.calculateGasCostUsd(GAS_LIMITS.STANDARD_PROOF_VERIFICATION, gasPrices.rapid, ethUsdPrice)
          }
        };
        
        // Update cache
        this.priceCache = {
          timestamp: Date.now(),
          prices: priceData
        };
        
        return priceData;
      }
    } catch (error) {
      errorLogger.error('Error fetching gas prices', { 
        error: error.message,
        source: 'CoinGecko'
      });
      
      // Fallback to provider if available
      if (this.fallbackToEstimate) {
        return this.getGasPricesFromProvider();
      }
    }
    
    // If we get here, we couldn't get prices
    throw new Error('Could not fetch gas prices');
  }
  
  /**
   * Get gas prices from provider as fallback
   * @returns {Promise<Object>} Gas price data
   * @async
   * @private
   */
  async getGasPricesFromProvider() {
    const provider = this.getProvider();
    
    if (!provider) {
      throw new Error('No provider available for gas price estimation');
    }
    
    try {
      // Get current gas price and ETH/USD price (estimated)
      const gasPrice = await provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
      
      // Estimate ETH/USD price (placeholder - would use an oracle in production)
      const ethUsdPrice = 2500; // Placeholder
      
      // Create formatted price data with estimates
      const priceData = {
        eth: {
          usd: ethUsdPrice,
          usdChange24h: 0
        },
        gas: {
          slow: gasPriceGwei * 0.8,
          standard: gasPriceGwei,
          fast: gasPriceGwei * 1.2,
          rapid: gasPriceGwei * 1.5
        },
        costUsd: {
          slow: this.calculateGasCostUsd(GAS_LIMITS.STANDARD_PROOF_VERIFICATION, gasPriceGwei * 0.8, ethUsdPrice),
          standard: this.calculateGasCostUsd(GAS_LIMITS.STANDARD_PROOF_VERIFICATION, gasPriceGwei, ethUsdPrice),
          fast: this.calculateGasCostUsd(GAS_LIMITS.STANDARD_PROOF_VERIFICATION, gasPriceGwei * 1.2, ethUsdPrice),
          rapid: this.calculateGasCostUsd(GAS_LIMITS.STANDARD_PROOF_VERIFICATION, gasPriceGwei * 1.5, ethUsdPrice)
        }
      };
      
      // Update cache
      this.priceCache = {
        timestamp: Date.now(),
        prices: priceData
      };
      
      return priceData;
    } catch (error) {
      errorLogger.error('Error getting gas prices from provider', { 
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Calculate gas cost in USD
   * @param {number} gasLimit - Gas limit for operation
   * @param {number} gasPriceGwei - Gas price in Gwei
   * @param {number} ethUsdPrice - ETH/USD price
   * @returns {number} Cost in USD
   * @private
   */
  calculateGasCostUsd(gasLimit, gasPriceGwei, ethUsdPrice) {
    const gasPriceEth = gasPriceGwei * 1e-9; // Convert Gwei to ETH
    const costEth = gasLimit * gasPriceEth;
    return costEth * ethUsdPrice;
  }
  
  /**
   * Estimate gas cost for an operation
   * @param {string} operation - Operation name (e.g., 'standardProofVerification')
   * @param {Object} options - Options for gas estimation
   * @param {string} [options.speed='standard'] - Gas price speed (slow, standard, fast, rapid)
   * @param {boolean} [options.includePriceData=false] - Whether to include price data
   * @returns {Promise<Object>} Gas cost estimate
   * @async
   */
  async estimateGasCost(operation, options = {}) {
    const speed = options.speed || 'standard';
    const includePriceData = options.includePriceData || false;
    
    // Check cache if valid
    if (this.isEstimateCacheValid(operation)) {
      const cachedEstimate = this.estimateCache.estimates[operation];
      
      // Include price data if requested
      if (includePriceData) {
        const priceData = await this.fetchGasPrices();
        return { ...cachedEstimate, prices: priceData };
      }
      
      return cachedEstimate;
    }
    
    try {
      // Get gas limit for operation
      const gasLimit = this.getGasLimitForOperation(operation);
      
      // Get current gas prices
      const priceData = await this.fetchGasPrices();
      
      // Calculate cost
      const gasPriceGwei = priceData.gas[speed];
      const costUsd = this.calculateGasCostUsd(
        gasLimit,
        gasPriceGwei,
        priceData.eth.usd
      );
      
      // Create estimate
      const estimate = {
        operation,
        gasLimit,
        gasPriceGwei,
        costEth: gasLimit * gasPriceGwei * 1e-9,
        costUsd,
        speed
      };
      
      // Update cache
      this.estimateCache.timestamp = Date.now();
      this.estimateCache.estimates[operation] = estimate;
      
      // Include price data if requested
      if (includePriceData) {
        return { ...estimate, prices: priceData };
      }
      
      return estimate;
    } catch (error) {
      errorLogger.error('Error estimating gas cost', { 
        error: error.message,
        operation
      });
      throw error;
    }
  }
  
  /**
   * Get gas limit for an operation
   * @param {string} operation - Operation name
   * @returns {number} Gas limit
   * @private
   */
  getGasLimitForOperation(operation) {
    switch (operation) {
      case 'standardProofVerification':
        return GAS_LIMITS.STANDARD_PROOF_VERIFICATION;
      case 'maximumProofVerification':
        return GAS_LIMITS.MAXIMUM_PROOF_VERIFICATION;
      case 'thresholdProofVerification':
        return GAS_LIMITS.THRESHOLD_PROOF_VERIFICATION;
      case 'proofOfFundsDeposit':
        return GAS_LIMITS.PROOF_OF_FUNDS_DEPOSIT;
      case 'proofOfFundsWithdraw':
        return GAS_LIMITS.PROOF_OF_FUNDS_WITHDRAW;
      case 'contractDeployment':
        return GAS_LIMITS.CONTRACT_DEPLOYMENT;
      default:
        return GAS_LIMITS.STANDARD_PROOF_VERIFICATION;
    }
  }
  
  /**
   * Compare gas costs across different operations
   * @param {Array<string>} operations - Operation names to compare
   * @param {Object} options - Options for comparison
   * @param {string} [options.speed='standard'] - Gas price speed
   * @returns {Promise<Object>} Comparison of gas costs
   * @async
   */
  async compareGasCosts(operations, options = {}) {
    const speed = options.speed || 'standard';
    const comparison = {
      speed,
      operations: {},
      timestamp: Date.now()
    };
    
    try {
      // Get price data (only fetch once)
      const priceData = await this.fetchGasPrices();
      const gasPriceGwei = priceData.gas[speed];
      
      // Calculate costs for each operation
      for (const operation of operations) {
        const gasLimit = this.getGasLimitForOperation(operation);
        const costEth = gasLimit * gasPriceGwei * 1e-9;
        const costUsd = this.calculateGasCostUsd(
          gasLimit,
          gasPriceGwei,
          priceData.eth.usd
        );
        
        comparison.operations[operation] = {
          gasLimit,
          costEth,
          costUsd
        };
      }
      
      return comparison;
    } catch (error) {
      errorLogger.error('Error comparing gas costs', { 
        error: error.message,
        operations
      });
      throw error;
    }
  }
}

// Create and export default instance
const gasEstimator = new GasEstimator();

export { 
  gasEstimator, 
  GasEstimator, 
  GAS_LIMITS 
};

export default gasEstimator;