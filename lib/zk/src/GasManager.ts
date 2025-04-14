/**
 * @file GasManager.ts
 * @description Manages gas price estimation and optimization for transactions
 */

import { ethers } from 'ethers';
import { GasStrategy, GasPriceEstimation } from './types/contractTypes';

// Define gas price strategies
const GAS_STRATEGIES: Record<string, GasStrategy> = {
  FASTEST: {
    name: 'fastest',
    multiplier: 2.0,
    description: 'Very high priority, expected to be mined immediately',
    estimatedTimeSeconds: 15
  },
  FAST: {
    name: 'fast',
    multiplier: 1.5,
    description: 'High priority, expected to be mined within 1-2 blocks',
    estimatedTimeSeconds: 30
  },
  STANDARD: {
    name: 'standard',
    multiplier: 1.0,
    description: 'Standard priority, expected to be mined within 3-6 blocks',
    estimatedTimeSeconds: 60
  },
  ECONOMY: {
    name: 'economy',
    multiplier: 0.8,
    description: 'Low priority, may take longer to be mined',
    estimatedTimeSeconds: 180
  },
  SLOW: {
    name: 'slow',
    multiplier: 0.6,
    description: 'Very low priority, may take much longer to be mined',
    estimatedTimeSeconds: 600
  }
};

// Price feed interface
interface PriceFeed {
  getEthUsdPrice(): Promise<number>;
}

/**
 * Default price feed implementation that uses CoinGecko API
 */
class DefaultPriceFeed implements PriceFeed {
  private cachedPrice: number | null = null;
  private lastUpdated: number = 0;
  private readonly cacheTimeMs: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Gets the current ETH/USD price
   * @returns Promise that resolves to the ETH/USD price
   */
  async getEthUsdPrice(): Promise<number> {
    const now = Date.now();
    
    // Return cached price if it's still valid
    if (this.cachedPrice !== null && (now - this.lastUpdated) < this.cacheTimeMs) {
      return this.cachedPrice;
    }
    
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { method: 'GET' }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ETH price: ${response.statusText}`);
      }
      
      const data = await response.json();
      const price = data.ethereum.usd;
      
      if (typeof price !== 'number' || isNaN(price)) {
        throw new Error('Invalid price data received');
      }
      
      // Update cache
      this.cachedPrice = price;
      this.lastUpdated = now;
      
      return price;
    } catch (error) {
      // If we have a cached price, return it as fallback
      if (this.cachedPrice !== null) {
        return this.cachedPrice;
      }
      
      // Default fallback price if we can't get a real one
      return 3000; // Default fallback ETH price
    }
  }
}

/**
 * Configuration options for Gas Manager
 */
interface GasManagerConfig {
  priceFeed?: PriceFeed;
  defaultStrategy?: string;
  maxGasPrice?: ethers.BigNumber;
  minGasPrice?: ethers.BigNumber;
  defaultGasLimit?: ethers.BigNumber;
  safetyMultiplier?: number;
  preferEIP1559?: boolean;
  refreshIntervalMs?: number;
  historicalBlocks?: number;
  enableGasTokens?: boolean;
}

/**
 * Gas price history record
 */
interface GasPriceHistoryRecord {
  timestamp: number;
  baseFeePerGas?: ethers.BigNumber;
  priorityFeePerGas?: ethers.BigNumber;
  gasPrice?: ethers.BigNumber;
  blockNumber: number;
}

/**
 * Manages gas price estimation and optimization for transactions
 */
export class GasManager {
  private provider: ethers.providers.Provider;
  private priceFeed: PriceFeed;
  private defaultStrategy: string;
  private maxGasPrice: ethers.BigNumber;
  private minGasPrice: ethers.BigNumber;
  private defaultGasLimit: ethers.BigNumber;
  private safetyMultiplier: number;
  private preferEIP1559: boolean;
  private refreshIntervalMs: number;
  private historicalBlocks: number;
  private enableGasTokens: boolean;
  
  // Cache for gas price history
  private gasPriceHistory: GasPriceHistoryRecord[] = [];
  private lastRefreshed: number = 0;
  private isEIP1559Compatible: boolean | null = null;
  
  /**
   * Creates a new gas manager
   * @param provider The ethers provider
   * @param config Optional configuration options
   */
  constructor(provider: ethers.providers.Provider, config: GasManagerConfig = {}) {
    this.provider = provider;
    this.priceFeed = config.priceFeed || new DefaultPriceFeed();
    this.defaultStrategy = config.defaultStrategy || 'STANDARD';
    this.maxGasPrice = config.maxGasPrice || ethers.utils.parseUnits('500', 'gwei');
    this.minGasPrice = config.minGasPrice || ethers.utils.parseUnits('1', 'gwei');
    this.defaultGasLimit = config.defaultGasLimit || ethers.BigNumber.from(250000);
    this.safetyMultiplier = config.safetyMultiplier || 1.2;
    this.preferEIP1559 = config.preferEIP1559 !== undefined ? config.preferEIP1559 : true;
    this.refreshIntervalMs = config.refreshIntervalMs || 60000; // 1 minute
    this.historicalBlocks = config.historicalBlocks || 20;
    this.enableGasTokens = config.enableGasTokens || false;
    
    // Initialize by checking EIP-1559 compatibility
    this.checkEIP1559Support();
  }
  
  /**
   * Checks if the current network supports EIP-1559
   */
  private async checkEIP1559Support(): Promise<void> {
    try {
      const block = await this.provider.getBlock('latest');
      this.isEIP1559Compatible = block.baseFeePerGas !== undefined;
    } catch (error) {
      this.isEIP1559Compatible = false;
    }
  }
  
  /**
   * Gets the list of available gas strategies
   * @returns Array of available gas strategies
   */
  getAvailableGasStrategies(): GasStrategy[] {
    return Object.values(GAS_STRATEGIES);
  }
  
  /**
   * Sets the default gas strategy
   * @param strategy The strategy to set as default
   * @throws Error if the strategy is not valid
   */
  setDefaultGasStrategy(strategy: string): void {
    if (!GAS_STRATEGIES[strategy]) {
      throw new Error(`Invalid gas strategy: ${strategy}`);
    }
    
    this.defaultStrategy = strategy;
  }
  
  /**
   * Gets the current gas price from the provider
   * @returns Promise that resolves to the current gas price
   */
  async getCurrentGasPrice(): Promise<ethers.BigNumber> {
    return this.provider.getGasPrice();
  }
  
  /**
   * Gets EIP-1559 fee data from the provider
   * @returns Promise that resolves to the EIP-1559 fee data
   */
  async getEIP1559FeeData(): Promise<ethers.providers.FeeData> {
    if (typeof this.provider.getFeeData === 'function') {
      return this.provider.getFeeData();
    }
    
    // Fall back to manual implementation if provider doesn't support getFeeData
    const gasPrice = await this.provider.getGasPrice();
    const block = await this.provider.getBlock('latest');
    
    let baseFeePerGas: ethers.BigNumber | null = null;
    let maxPriorityFeePerGas: ethers.BigNumber | null = null;
    
    if (block.baseFeePerGas) {
      baseFeePerGas = block.baseFeePerGas;
      // Estimate priority fee as 10% of base fee, with a minimum of 1 gwei
      const minPriorityFee = ethers.utils.parseUnits('1', 'gwei');
      const calculatedPriorityFee = baseFeePerGas.div(10);
      maxPriorityFeePerGas = calculatedPriorityFee.gt(minPriorityFee) 
        ? calculatedPriorityFee 
        : minPriorityFee;
    }
    
    return {
      gasPrice,
      maxFeePerGas: baseFeePerGas 
        ? baseFeePerGas.mul(2).add(maxPriorityFeePerGas || 0) 
        : null,
      maxPriorityFeePerGas,
      lastBaseFeePerGas: baseFeePerGas
    };
  }
  
  /**
   * Refreshes the gas price history
   */
  private async refreshGasPriceHistory(): Promise<void> {
    const now = Date.now();
    
    // Skip if we've refreshed recently
    if (now - this.lastRefreshed < this.refreshIntervalMs) {
      return;
    }
    
    try {
      // Get the latest block number
      const latestBlock = await this.provider.getBlockNumber();
      
      // Collect gas price history from recent blocks
      const historyPromises: Promise<GasPriceHistoryRecord | null>[] = [];
      
      for (let i = 0; i < this.historicalBlocks; i++) {
        const blockNumber = latestBlock - i;
        if (blockNumber < 0) continue;
        
        historyPromises.push(this.getGasPriceForBlock(blockNumber));
      }
      
      const historyResults = await Promise.all(historyPromises);
      
      // Filter out null results and add to history
      const validResults = historyResults.filter((record): record is GasPriceHistoryRecord => record !== null);
      
      // Update history, keeping only recent records
      this.gasPriceHistory = [...validResults, ...this.gasPriceHistory]
        .slice(0, 100); // Keep up to 100 records
      
      this.lastRefreshed = now;
    } catch (error) {
      console.error('Failed to refresh gas price history:', error);
    }
  }
  
  /**
   * Gets gas price information for a specific block
   * @param blockNumber Block number to get gas price for
   * @returns Promise that resolves to a gas price history record or null if not available
   */
  private async getGasPriceForBlock(blockNumber: number): Promise<GasPriceHistoryRecord | null> {
    try {
      const block = await this.provider.getBlock(blockNumber);
      
      if (!block) {
        return null;
      }
      
      const record: GasPriceHistoryRecord = {
        timestamp: block.timestamp * 1000, // Convert to ms
        blockNumber
      };
      
      // Add EIP-1559 fields if available
      if (block.baseFeePerGas) {
        record.baseFeePerGas = block.baseFeePerGas;
        
        // Try to estimate priority fee from transactions
        if (block.transactions.length > 0) {
          try {
            // Get a sample of transactions from the block
            const txHashes = block.transactions.slice(0, 10);
            const txDetailsPromises = txHashes.map(hash => this.provider.getTransaction(hash));
            const transactions = await Promise.all(txDetailsPromises);
            
            // Calculate the average max priority fee
            let validTxCount = 0;
            let totalPriorityFee = ethers.BigNumber.from(0);
            
            for (const tx of transactions) {
              if (tx && tx.maxPriorityFeePerGas) {
                totalPriorityFee = totalPriorityFee.add(tx.maxPriorityFeePerGas);
                validTxCount++;
              }
            }
            
            if (validTxCount > 0) {
              record.priorityFeePerGas = totalPriorityFee.div(validTxCount);
            }
          } catch (error) {
            // Ignore error and continue without priority fee
          }
        }
      } else {
        // For non-EIP-1559 blocks, get the gas price
        const feeData = await this.getEIP1559FeeData();
        record.gasPrice = feeData.gasPrice || undefined;
      }
      
      return record;
    } catch (error) {
      console.error(`Failed to get gas price for block ${blockNumber}:`, error);
      return null;
    }
  }
  
  /**
   * Estimates the gas price based on a given strategy
   * @param strategy Gas strategy to use
   * @returns Promise that resolves to the gas price estimation
   */
  async estimateGasPrice(strategy: string = this.defaultStrategy): Promise<GasPriceEstimation> {
    // Get the strategy configuration
    const strategyConfig = GAS_STRATEGIES[strategy];
    if (!strategyConfig) {
      throw new Error(`Invalid gas strategy: ${strategy}`);
    }
    
    // Check if provider supports EIP-1559 if we haven't checked yet
    if (this.isEIP1559Compatible === null) {
      await this.checkEIP1559Support();
    }
    
    // Refresh gas price history
    await this.refreshGasPriceHistory();
    
    // Determine whether to use EIP-1559 or legacy gas pricing
    const useEIP1559 = this.isEIP1559Compatible && this.preferEIP1559;
    
    let gasPriceEstimation: GasPriceEstimation;
    
    if (useEIP1559) {
      gasPriceEstimation = await this.estimateEIP1559Gas(strategyConfig);
    } else {
      gasPriceEstimation = await this.estimateLegacyGas(strategyConfig);
    }
    
    // Add USD cost estimation
    try {
      const ethUsdPrice = await this.priceFeed.getEthUsdPrice();
      const ethCost = ethers.utils.formatEther(gasPriceEstimation.estimatedCostWei);
      gasPriceEstimation.estimatedCostUsd = parseFloat(ethCost) * ethUsdPrice;
    } catch (error) {
      // If USD conversion fails, continue without it
      console.warn('Failed to get ETH/USD price:', error);
    }
    
    return gasPriceEstimation;
  }
  
  /**
   * Estimates gas using EIP-1559 fee structure
   * @param strategyConfig The gas strategy configuration
   * @returns Promise that resolves to the gas price estimation
   */
  private async estimateEIP1559Gas(strategyConfig: GasStrategy): Promise<GasPriceEstimation> {
    // Get current fee data
    const feeData = await this.getEIP1559FeeData();
    
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas || !feeData.lastBaseFeePerGas) {
      // Fall back to legacy if EIP-1559 data is not available
      return this.estimateLegacyGas(strategyConfig);
    }
    
    // Apply strategy multiplier to priority fee
    let adjustedPriorityFee = feeData.maxPriorityFeePerGas.mul(
      Math.floor(strategyConfig.multiplier * 100)
    ).div(100);
    
    // Ensure priority fee is within limits
    const minPriorityFee = ethers.utils.parseUnits('1', 'gwei');
    if (adjustedPriorityFee.lt(minPriorityFee)) {
      adjustedPriorityFee = minPriorityFee;
    }
    
    // Calculate max fee = (2 * base fee) + priority fee
    const baseFeeBump = feeData.lastBaseFeePerGas.mul(
      Math.floor(this.safetyMultiplier * 100)
    ).div(100);
    
    let maxFeePerGas = baseFeeBump.add(adjustedPriorityFee);
    
    // Ensure max fee is within limits
    if (maxFeePerGas.gt(this.maxGasPrice)) {
      maxFeePerGas = this.maxGasPrice;
    }
    
    // Calculate estimated cost (assuming default gas limit)
    const estimatedCostWei = maxFeePerGas.mul(this.defaultGasLimit);
    
    return {
      maxFeePerGas,
      maxPriorityFeePerGas: adjustedPriorityFee,
      baseFeePerGas: feeData.lastBaseFeePerGas,
      estimatedCostWei,
      estimatedTimeSeconds: strategyConfig.estimatedTimeSeconds,
      strategy: strategyConfig.name
    };
  }
  
  /**
   * Estimates gas using legacy (pre-EIP-1559) fee structure
   * @param strategyConfig The gas strategy configuration
   * @returns Promise that resolves to the gas price estimation
   */
  private async estimateLegacyGas(strategyConfig: GasStrategy): Promise<GasPriceEstimation> {
    // Get current gas price
    const currentGasPrice = await this.getCurrentGasPrice();
    
    // Apply strategy multiplier
    let adjustedGasPrice = currentGasPrice.mul(
      Math.floor(strategyConfig.multiplier * 100)
    ).div(100);
    
    // Ensure gas price is within limits
    if (adjustedGasPrice.gt(this.maxGasPrice)) {
      adjustedGasPrice = this.maxGasPrice;
    }
    
    if (adjustedGasPrice.lt(this.minGasPrice)) {
      adjustedGasPrice = this.minGasPrice;
    }
    
    // Calculate estimated cost (assuming default gas limit)
    const estimatedCostWei = adjustedGasPrice.mul(this.defaultGasLimit);
    
    return {
      gasPrice: adjustedGasPrice,
      estimatedCostWei,
      estimatedTimeSeconds: strategyConfig.estimatedTimeSeconds,
      strategy: strategyConfig.name
    };
  }
  
  /**
   * Estimates gas limit for a contract method
   * @param contract The ethers contract
   * @param method The method name
   * @param args The method arguments
   * @returns Promise that resolves to the estimated gas limit
   */
  async estimateGasLimit(
    contract: ethers.Contract, 
    method: string, 
    ...args: any[]
  ): Promise<ethers.BigNumber> {
    try {
      // Get raw gas estimate from contract
      const gasEstimate = await contract.estimateGas[method](...args);
      
      // Apply safety multiplier
      const safeGasLimit = gasEstimate.mul(
        Math.floor(this.safetyMultiplier * 100)
      ).div(100);
      
      return safeGasLimit;
    } catch (error: any) {
      // Handle specific error cases
      if (error.message && error.message.includes('always failing transaction')) {
        throw new Error(`Transaction to ${method} would fail: ${error.reason || error.message}`);
      }
      
      // Return default gas limit if estimation fails
      console.warn(`Failed to estimate gas for ${method}:`, error);
      return this.defaultGasLimit;
    }
  }
  
  /**
   * Gets the transaction override options based on a gas strategy
   * @param gasLimit Estimated gas limit
   * @param strategy Gas strategy to use
   * @returns Promise that resolves to the transaction overrides
   */
  async getTransactionOverrides(
    gasLimit: ethers.BigNumber,
    strategy: string = this.defaultStrategy
  ): Promise<ethers.PayableOverrides> {
    const gasEstimation = await this.estimateGasPrice(strategy);
    const overrides: ethers.PayableOverrides = {
      gasLimit
    };
    
    // Set appropriate gas parameters based on EIP-1559 support
    if (gasEstimation.maxFeePerGas && gasEstimation.maxPriorityFeePerGas) {
      overrides.maxFeePerGas = gasEstimation.maxFeePerGas;
      overrides.maxPriorityFeePerGas = gasEstimation.maxPriorityFeePerGas;
    } else if (gasEstimation.gasPrice) {
      overrides.gasPrice = gasEstimation.gasPrice;
    }
    
    return overrides;
  }
  
  /**
   * Calculates the total cost of a transaction in ETH
   * @param gasUsed Amount of gas used
   * @param effectiveGasPrice Effective gas price paid
   * @returns The total cost in ETH as a string
   */
  calculateTransactionCost(
    gasUsed: ethers.BigNumber,
    effectiveGasPrice: ethers.BigNumber
  ): string {
    const totalWei = gasUsed.mul(effectiveGasPrice);
    return ethers.utils.formatEther(totalWei);
  }
  
  /**
   * Estimates the cost of a transaction in USD
   * @param gasLimit Estimated gas limit
   * @param strategy Gas strategy to use
   * @returns Promise that resolves to the estimated cost in USD
   */
  async estimateTransactionCostUsd(
    gasLimit: ethers.BigNumber,
    strategy: string = this.defaultStrategy
  ): Promise<number> {
    const gasEstimation = await this.estimateGasPrice(strategy);
    
    if (gasEstimation.estimatedCostUsd !== undefined) {
      // Adjust USD cost for the specific gas limit
      return gasEstimation.estimatedCostUsd * 
        (gasLimit.toNumber() / this.defaultGasLimit.toNumber());
    }
    
    // If USD estimation is not available in gasEstimation, calculate it
    try {
      const ethUsdPrice = await this.priceFeed.getEthUsdPrice();
      let totalWei: ethers.BigNumber;
      
      if (gasEstimation.maxFeePerGas) {
        totalWei = gasEstimation.maxFeePerGas.mul(gasLimit);
      } else if (gasEstimation.gasPrice) {
        totalWei = gasEstimation.gasPrice.mul(gasLimit);
      } else {
        throw new Error('No gas price or fee available for estimation');
      }
      
      const ethCost = parseFloat(ethers.utils.formatEther(totalWei));
      return ethCost * ethUsdPrice;
    } catch (error) {
      console.warn('Failed to estimate transaction cost in USD:', error);
      return 0;
    }
  }
  
  /**
   * Suggests a better gas price for a stuck transaction
   * @param originalGasPrice Original gas price that resulted in a stuck transaction
   * @returns Suggested new gas price
   */
  suggestReplacementGasPrice(originalGasPrice: ethers.BigNumber): ethers.BigNumber {
    // Increase gas price by at least 10% to replace a transaction
    const minIncrease = originalGasPrice.div(10);
    let newGasPrice = originalGasPrice.add(minIncrease);
    
    // Cap at max gas price
    if (newGasPrice.gt(this.maxGasPrice)) {
      newGasPrice = this.maxGasPrice;
    }
    
    return newGasPrice;
  }
  
  /**
   * Suggests better fee data for a stuck EIP-1559 transaction
   * @param originalMaxFeePerGas Original max fee per gas
   * @param originalPriorityFee Original priority fee per gas
   * @returns Suggested new fee data
   */
  suggestReplacementFeeData(
    originalMaxFeePerGas: ethers.BigNumber,
    originalPriorityFee: ethers.BigNumber
  ): {
    maxFeePerGas: ethers.BigNumber;
    maxPriorityFeePerGas: ethers.BigNumber;
  } {
    // Increase priority fee by at least 30% to improve chances of being mined
    const newPriorityFee = originalPriorityFee.mul(130).div(100);
    
    // Increase max fee by at least 10%
    const newMaxFee = originalMaxFeePerGas.mul(110).div(100);
    
    // Ensure max fee is at least as high as priority fee
    const finalMaxFee = newMaxFee.gt(newPriorityFee) 
      ? newMaxFee 
      : newPriorityFee.add(ethers.utils.parseUnits('1', 'gwei'));
    
    // Cap at max gas price
    const cappedMaxFee = finalMaxFee.gt(this.maxGasPrice) 
      ? this.maxGasPrice 
      : finalMaxFee;
    
    // Ensure priority fee is not more than max fee
    const cappedPriorityFee = newPriorityFee.gt(cappedMaxFee) 
      ? cappedMaxFee 
      : newPriorityFee;
    
    return {
      maxFeePerGas: cappedMaxFee,
      maxPriorityFeePerGas: cappedPriorityFee
    };
  }
  
  /**
   * Cancels a pending transaction
   * @param nonce Nonce of the transaction to cancel
   * @param signer Signer to use for the cancellation
   * @returns Promise that resolves to the cancellation transaction
   */
  async cancelTransaction(
    nonce: number,
    signer: ethers.Signer
  ): Promise<ethers.providers.TransactionResponse> {
    // Get current gas price or fee data
    const feeEstimation = await this.estimateGasPrice('FASTEST');
    
    // Create a zero-value transaction to the sender's own address
    const sender = await signer.getAddress();
    const tx: ethers.providers.TransactionRequest = {
      to: sender,
      value: 0,
      nonce: nonce,
      gasLimit: 21000 // Minimum gas for a basic ETH transfer
    };
    
    // Set appropriate gas price parameters
    if (feeEstimation.maxFeePerGas && feeEstimation.maxPriorityFeePerGas) {
      tx.maxFeePerGas = feeEstimation.maxFeePerGas;
      tx.maxPriorityFeePerGas = feeEstimation.maxPriorityFeePerGas;
      // Clear any legacy gas price
      tx.gasPrice = undefined;
    } else if (feeEstimation.gasPrice) {
      tx.gasPrice = feeEstimation.gasPrice;
    }
    
    // Send the cancellation transaction
    return signer.sendTransaction(tx);
  }
  
  /**
   * Speed up a pending transaction
   * @param nonce Nonce of the transaction to speed up
   * @param transaction Original transaction
   * @param signer Signer to use for the speed-up
   * @returns Promise that resolves to the speed-up transaction
   */
  async speedUpTransaction(
    nonce: number,
    transaction: ethers.providers.TransactionRequest,
    signer: ethers.Signer
  ): Promise<ethers.providers.TransactionResponse> {
    // Create a copy of the original transaction
    const tx: ethers.providers.TransactionRequest = {
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      nonce: nonce,
      gasLimit: transaction.gasLimit
    };
    
    // Update gas price or fee data
    if (transaction.maxFeePerGas && transaction.maxPriorityFeePerGas) {
      // EIP-1559 transaction
      const replacementFees = this.suggestReplacementFeeData(
        transaction.maxFeePerGas as ethers.BigNumber,
        transaction.maxPriorityFeePerGas as ethers.BigNumber
      );
      
      tx.maxFeePerGas = replacementFees.maxFeePerGas;
      tx.maxPriorityFeePerGas = replacementFees.maxPriorityFeePerGas;
      // Clear any legacy gas price
      tx.gasPrice = undefined;
    } else if (transaction.gasPrice) {
      // Legacy transaction
      tx.gasPrice = this.suggestReplacementGasPrice(
        transaction.gasPrice as ethers.BigNumber
      );
    }
    
    // Send the speed-up transaction
    return signer.sendTransaction(tx);
  }
  
  /**
   * Gets historical gas price statistics
   * @returns Gas price statistics based on historical data
   */
  getGasPriceStatistics(): {
    average: ethers.BigNumber;
    median: ethers.BigNumber;
    min: ethers.BigNumber;
    max: ethers.BigNumber;
    percentiles: Record<string, ethers.BigNumber>;
    history: GasPriceHistoryRecord[];
  } {
    // If history is empty, return default values
    if (this.gasPriceHistory.length === 0) {
      const defaultGasPrice = ethers.utils.parseUnits('50', 'gwei');
      return {
        average: defaultGasPrice,
        median: defaultGasPrice,
        min: defaultGasPrice,
        max: defaultGasPrice,
        percentiles: {
          '25': defaultGasPrice,
          '50': defaultGasPrice,
          '75': defaultGasPrice,
          '90': defaultGasPrice,
          '95': defaultGasPrice
        },
        history: []
      };
    }
    
    // Extract gas prices based on EIP-1559 support
    const gasPrices: ethers.BigNumber[] = [];
    
    for (const record of this.gasPriceHistory) {
      if (record.gasPrice) {
        gasPrices.push(record.gasPrice);
      } else if (record.baseFeePerGas && record.priorityFeePerGas) {
        // For EIP-1559, sum base fee and priority fee
        gasPrices.push(record.baseFeePerGas.add(record.priorityFeePerGas));
      }
    }
    
    if (gasPrices.length === 0) {
      const defaultGasPrice = ethers.utils.parseUnits('50', 'gwei');
      return {
        average: defaultGasPrice,
        median: defaultGasPrice,
        min: defaultGasPrice,
        max: defaultGasPrice,
        percentiles: {
          '25': defaultGasPrice,
          '50': defaultGasPrice,
          '75': defaultGasPrice,
          '90': defaultGasPrice,
          '95': defaultGasPrice
        },
        history: this.gasPriceHistory
      };
    }
    
    // Sort gas prices for percentile calculations
    gasPrices.sort((a, b) => a.lt(b) ? -1 : a.gt(b) ? 1 : 0);
    
    // Calculate statistics
    const min = gasPrices[0];
    const max = gasPrices[gasPrices.length - 1];
    
    // Calculate average
    let sum = ethers.BigNumber.from(0);
    for (const price of gasPrices) {
      sum = sum.add(price);
    }
    const average = sum.div(gasPrices.length);
    
    // Calculate median and percentiles
    const median = gasPrices[Math.floor(gasPrices.length / 2)];
    
    const percentiles: Record<string, ethers.BigNumber> = {
      '25': gasPrices[Math.floor(gasPrices.length * 0.25)],
      '50': median,
      '75': gasPrices[Math.floor(gasPrices.length * 0.75)],
      '90': gasPrices[Math.floor(gasPrices.length * 0.9)],
      '95': gasPrices[Math.floor(gasPrices.length * 0.95)]
    };
    
    return {
      average,
      median,
      min,
      max,
      percentiles,
      history: this.gasPriceHistory
    };
  }
}