/**
 * Transaction History Processor Service
 * 
 * This service normalizes transaction data from different blockchain networks
 * to provide a consistent format for proof generation. It handles filtering,
 * formatting, and aggregating transaction data from various chain adapters.
 */

import { BigNumber } from 'ethers';
import { 
  Transaction, 
  TransactionOptions, 
  ChainAdapter 
} from '../utils/chains';
import { ChainAdapterRegistry, ChainType } from '../utils/chains/ChainAdapterRegistry';

/**
 * Normalized transaction format for proof generation
 */
export interface NormalizedTransaction {
  id: string;                   // Unique identifier (chain + tx hash)
  hash: string;                 // Original transaction hash
  from: string;                 // Sender address
  to: string;                   // Recipient address
  value: BigNumber;             // Transaction amount (in smallest unit)
  valueUSD?: number;            // USD value at transaction time (if available)
  timestamp: number;            // Unix timestamp
  blockNumber: number;          // Block number
  confirmations: number;        // Number of confirmations
  status: 'success' | 'failed' | 'pending';
  chainId: number;              // Chain ID
  chainType: ChainType;         // Chain type (EVM, SOLANA, BITCOIN)
  metadata?: Record<string, any>; // Chain-specific additional data
}

/**
 * Transaction filtering options
 */
export interface TransactionFilterOptions extends TransactionOptions {
  startDate?: number;           // Unix timestamp for start date
  endDate?: number;             // Unix timestamp for end date
  minValueUSD?: number;         // Minimum USD value
  status?: ('success' | 'failed' | 'pending')[];
  includeIncoming?: boolean;    // Include transactions where address is recipient
  includeOutgoing?: boolean;    // Include transactions where address is sender
  counterparties?: string[];    // Filter by specific addresses
  excludeCounterparties?: string[]; // Exclude specific addresses
}

/**
 * Transaction aggregation result
 */
export interface TransactionAggregation {
  totalValue: BigNumber;
  totalValueUSD?: number;
  count: number;
  timeRange: {
    start: number;
    end: number;
  };
  byChain: Record<number, {
    totalValue: BigNumber;
    totalValueUSD?: number;
    count: number;
  }>;
}

/**
 * Transaction History Processor Service
 */
export class TransactionHistoryProcessor {
  private registry: ChainAdapterRegistry;
  
  /**
   * Initialize with the chain adapter registry or use the singleton instance
   */
  constructor(registry?: ChainAdapterRegistry) {
    this.registry = registry || ChainAdapterRegistry.getInstance();
  }

  /**
   * Get normalized transactions from a specific chain adapter
   * 
   * @param address Wallet address
   * @param chainId Chain ID
   * @param options Filter options
   * @returns Normalized transactions
   */
  async getChainTransactions(
    address: string,
    chainId: number,
    options?: TransactionFilterOptions
  ): Promise<NormalizedTransaction[]> {
    const adapter = this.registry.getAdapterById(chainId);
    if (!adapter) {
      throw new Error(`Chain adapter not found for chain ID: ${chainId}`);
    }

    const chainType = this.registry.getChainTypeById(chainId);
    if (!chainType) {
      throw new Error(`Chain type not found for chain ID: ${chainId}`);
    }

    // Prepare transaction options
    const txOptions: TransactionOptions = {
      limit: options?.limit,
      offset: options?.offset,
      startBlock: options?.startBlock,
      endBlock: options?.endBlock,
      minValue: options?.minValue,
    };

    // Fetch transactions from the chain
    const transactions = await adapter.getTransactions(address, txOptions);

    // Convert to normalized format
    return this.normalizeTransactions(transactions, address, chainId, chainType, options);
  }

  /**
   * Get normalized transactions from all supported chains
   * 
   * @param address Wallet address
   * @param options Filter options
   * @param chainIds Optional specific chain IDs to include
   * @returns Normalized transactions from all chains
   */
  async getAllChainTransactions(
    address: string,
    options?: TransactionFilterOptions,
    chainIds?: number[]
  ): Promise<NormalizedTransaction[]> {
    // Determine which chains to query
    const targetChainIds = chainIds || this.registry.getAllChainIds();
    
    // Fetch transactions from all specified chains in parallel
    const transactionPromises = targetChainIds.map(chainId => 
      this.getChainTransactions(address, chainId, options)
        .catch(error => {
          console.error(`Error fetching transactions for chain ${chainId}:`, error);
          return [] as NormalizedTransaction[];
        })
    );

    const results = await Promise.all(transactionPromises);
    
    // Flatten and sort by timestamp (newest first)
    const allTransactions = results.flat().sort((a, b) => b.timestamp - a.timestamp);
    
    return allTransactions;
  }
  
  /**
   * Convert chain-specific transactions to normalized format
   * 
   * @param transactions Chain-specific transactions
   * @param address Wallet address
   * @param chainId Chain ID
   * @param chainType Chain type
   * @param options Filter options
   * @returns Normalized transactions
   */
  private normalizeTransactions(
    transactions: Transaction[],
    address: string,
    chainId: number,
    chainType: ChainType,
    options?: TransactionFilterOptions
  ): NormalizedTransaction[] {
    // Filter and normalize transactions
    return transactions
      .filter(tx => {
        // Apply filtering based on options
        if (options?.startDate && tx.timestamp < options.startDate) return false;
        if (options?.endDate && tx.timestamp > options.endDate) return false;
        if (options?.status && !options.status.includes(tx.status)) return false;

        // Filter by direction (incoming/outgoing)
        const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
        const isOutgoing = tx.from.toLowerCase() === address.toLowerCase();
        
        if (options?.includeIncoming === false && isIncoming) return false;
        if (options?.includeOutgoing === false && isOutgoing) return false;
        
        // Filter by counterparties
        if (options?.counterparties?.length) {
          const counterparty = isIncoming ? tx.from : tx.to;
          if (!options.counterparties.some(cp => 
            cp.toLowerCase() === counterparty.toLowerCase()
          )) {
            return false;
          }
        }
        
        // Exclude counterparties
        if (options?.excludeCounterparties?.length) {
          const counterparty = isIncoming ? tx.from : tx.to;
          if (options.excludeCounterparties.some(cp => 
            cp.toLowerCase() === counterparty.toLowerCase()
          )) {
            return false;
          }
        }

        return true;
      })
      .map(tx => ({
        id: `${chainId}-${tx.hash}`,
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: BigNumber.from(tx.value),
        timestamp: tx.timestamp,
        blockNumber: tx.blockNumber,
        confirmations: tx.confirmations,
        status: tx.status,
        chainId,
        chainType,
        metadata: {}  // Additional chain-specific data can be added here
      }));
  }

  /**
   * Filter transactions using advanced criteria
   * 
   * @param transactions Transactions to filter
   * @param filterFn Custom filter function
   * @returns Filtered transactions
   */
  filterTransactions(
    transactions: NormalizedTransaction[],
    filterFn: (tx: NormalizedTransaction) => boolean
  ): NormalizedTransaction[] {
    return transactions.filter(filterFn);
  }

  /**
   * Aggregate transaction data for analytics and proof generation
   * 
   * @param transactions Transactions to aggregate
   * @returns Aggregated transaction data
   */
  aggregateTransactions(transactions: NormalizedTransaction[]): TransactionAggregation {
    if (!transactions.length) {
      return {
        totalValue: BigNumber.from(0),
        totalValueUSD: 0,
        count: 0,
        timeRange: {
          start: 0,
          end: 0
        },
        byChain: {}
      };
    }

    // Initialize aggregation
    const byChain: Record<number, {
      totalValue: BigNumber;
      totalValueUSD?: number;
      count: number;
    }> = {};

    // Track overall totals
    let totalValue = BigNumber.from(0);
    let totalValueUSD = 0;
    let minTimestamp = Number.MAX_SAFE_INTEGER;
    let maxTimestamp = 0;

    // Aggregate transactions
    for (const tx of transactions) {
      // Update time range
      minTimestamp = Math.min(minTimestamp, tx.timestamp);
      maxTimestamp = Math.max(maxTimestamp, tx.timestamp);
      
      // Update chain-specific totals
      if (!byChain[tx.chainId]) {
        byChain[tx.chainId] = {
          totalValue: BigNumber.from(0),
          totalValueUSD: 0,
          count: 0
        };
      }

      byChain[tx.chainId].totalValue = byChain[tx.chainId].totalValue.add(tx.value);
      if (tx.valueUSD) {
        byChain[tx.chainId].totalValueUSD = (byChain[tx.chainId].totalValueUSD || 0) + tx.valueUSD;
        totalValueUSD += tx.valueUSD;
      }
      byChain[tx.chainId].count++;
      
      // Update overall totals
      totalValue = totalValue.add(tx.value);
    }

    // Process chain-specific totals to ensure consistent undefined handling
    Object.keys(byChain).forEach(chainId => {
      const chain = byChain[Number(chainId)];
      if (chain.totalValueUSD === 0) {
        chain.totalValueUSD = undefined;
      }
    });

    return {
      totalValue,
      totalValueUSD: totalValueUSD > 0 ? totalValueUSD : undefined,
      count: transactions.length,
      timeRange: {
        start: minTimestamp === Number.MAX_SAFE_INTEGER ? 0 : minTimestamp,
        end: maxTimestamp
      },
      byChain
    };
  }

  /**
   * Prepare transaction data for proof generation
   * 
   * @param address Wallet address
   * @param options Filter options
   * @returns Formatted transaction data ready for proof generation
   */
  async prepareTransactionsForProof(
    address: string,
    options?: TransactionFilterOptions
  ): Promise<{
    transactions: NormalizedTransaction[];
    aggregation: TransactionAggregation;
  }> {
    // Get transactions from all chains
    const transactions = await this.getAllChainTransactions(address, options);
    
    // Generate aggregation data
    const aggregation = this.aggregateTransactions(transactions);
    
    return {
      transactions,
      aggregation
    };
  }
}

export default TransactionHistoryProcessor;