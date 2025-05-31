/**
 * Transaction History Processor Tests
 */
import { BigNumber } from 'ethers';
import TransactionHistoryProcessor, { 
  NormalizedTransaction,
  TransactionFilterOptions
} from '../TransactionHistoryProcessor';
import { ChainAdapterRegistry, ChainType } from '../../utils/chains/ChainAdapterRegistry';
import { Transaction } from '../../utils/chains';

// Mock dependencies
jest.mock('../../utils/chains/ChainAdapterRegistry');

// Mock transaction data
const mockTransactions: Transaction[] = [
  {
    hash: 'tx1',
    from: 'wallet1',
    to: 'wallet2',
    value: '1000000',
    timestamp: 1620000000,
    blockNumber: 12345,
    confirmations: 100,
    status: 'success'
  },
  {
    hash: 'tx2',
    from: 'wallet2',
    to: 'wallet1',
    value: '2000000',
    timestamp: 1620010000,
    blockNumber: 12346,
    confirmations: 99,
    status: 'success'
  },
  {
    hash: 'tx3',
    from: 'wallet1',
    to: 'wallet3',
    value: '500000',
    timestamp: 1620020000,
    blockNumber: 12347,
    confirmations: 98,
    status: 'failed'
  }
];

// Mock chain adapter
const mockAdapter = {
  getTransactions: jest.fn().mockResolvedValue(mockTransactions)
};

// Mock ChainAdapterRegistry
const mockRegistry = {
  getAdapterById: jest.fn().mockReturnValue(mockAdapter),
  getChainTypeById: jest.fn().mockReturnValue(ChainType.EVM),
  getAllChainIds: jest.fn().mockReturnValue([1, 56]),
  getInstance: jest.fn()
};

(ChainAdapterRegistry as jest.Mock).mockImplementation(() => mockRegistry);
(ChainAdapterRegistry.getInstance as jest.Mock).mockReturnValue(mockRegistry);

describe('TransactionHistoryProcessor', () => {
  let processor: TransactionHistoryProcessor;
  
  beforeEach(() => {
    jest.clearAllMocks();
    processor = new TransactionHistoryProcessor();
  });

  describe('getChainTransactions', () => {
    it('should get and normalize transactions from a chain', async () => {
      const address = 'wallet1';
      const chainId = 1;
      
      const result = await processor.getChainTransactions(address, chainId);
      
      expect(mockRegistry.getAdapterById).toHaveBeenCalledWith(chainId);
      expect(mockRegistry.getChainTypeById).toHaveBeenCalledWith(chainId);
      expect(mockAdapter.getTransactions).toHaveBeenCalledWith(address, expect.any(Object));
      
      expect(result.length).toBe(3);
      expect(result[0].id).toBe('1-tx1');
      expect(result[0].hash).toBe('tx1');
      expect(result[0].from).toBe('wallet1');
      expect(result[0].to).toBe('wallet2');
      expect(result[0].value.toString()).toBe('1000000');
    });

    it('should throw error if chain adapter not found', async () => {
      mockRegistry.getAdapterById.mockReturnValueOnce(null);
      
      await expect(
        processor.getChainTransactions('wallet1', 999)
      ).rejects.toThrow('Chain adapter not found');
    });

    it('should throw error if chain type not found', async () => {
      mockRegistry.getChainTypeById.mockReturnValueOnce(null);
      
      await expect(
        processor.getChainTransactions('wallet1', 1)
      ).rejects.toThrow('Chain type not found');
    });

    it('should pass options to the adapter', async () => {
      const options: TransactionFilterOptions = {
        limit: 10,
        startDate: 1610000000,
        endDate: 1630000000,
        minValueUSD: 100
      };
      
      await processor.getChainTransactions('wallet1', 1, options);
      
      expect(mockAdapter.getTransactions).toHaveBeenCalledWith('wallet1', {
        limit: 10,
        offset: undefined,
        startBlock: undefined,
        endBlock: undefined,
        minValue: undefined
      });
    });
  });

  describe('getAllChainTransactions', () => {
    it('should get transactions from all chains', async () => {
      mockAdapter.getTransactions
        .mockResolvedValueOnce([mockTransactions[0]])
        .mockResolvedValueOnce([mockTransactions[1]]);
      
      const result = await processor.getAllChainTransactions('wallet1');
      
      expect(mockRegistry.getAllChainIds).toHaveBeenCalled();
      expect(mockAdapter.getTransactions).toHaveBeenCalledTimes(2);
      
      // Should combine results from both chains
      expect(result.length).toBe(2);
      // Should sort by timestamp (newest first)
      expect(result[0].hash).toBe('tx2');
      expect(result[1].hash).toBe('tx1');
    });

    it('should get transactions from specific chains', async () => {
      mockAdapter.getTransactions
        .mockResolvedValueOnce([mockTransactions[0]]);
      
      const result = await processor.getAllChainTransactions('wallet1', {}, [1]);
      
      expect(mockRegistry.getAllChainIds).not.toHaveBeenCalled();
      expect(mockAdapter.getTransactions).toHaveBeenCalledTimes(1);
      
      expect(result.length).toBe(1);
      expect(result[0].hash).toBe('tx1');
    });

    it('should handle errors from individual chains', async () => {
      // Mock first chain with error, second with success
      mockAdapter.getTransactions
        .mockRejectedValueOnce(new Error('Chain error'))
        .mockResolvedValueOnce([mockTransactions[1]]);
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await processor.getAllChainTransactions('wallet1');
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.length).toBe(1);
      expect(result[0].hash).toBe('tx2');
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('normalizeTransactions', () => {
    it('should filter transactions by date range', async () => {
      const options: TransactionFilterOptions = {
        startDate: 1620005000,
        endDate: 1620015000
      };
      
      // @ts-ignore - accessing private method for testing
      const result = processor['normalizeTransactions'](
        mockTransactions,
        'wallet1',
        1,
        ChainType.EVM,
        options
      );
      
      expect(result.length).toBe(1);
      expect(result[0].hash).toBe('tx2');
    });

    it('should filter transactions by status', async () => {
      const options: TransactionFilterOptions = {
        status: ['failed']
      };
      
      // @ts-ignore - accessing private method for testing
      const result = processor['normalizeTransactions'](
        mockTransactions,
        'wallet1',
        1,
        ChainType.EVM,
        options
      );
      
      expect(result.length).toBe(1);
      expect(result[0].hash).toBe('tx3');
    });

    it('should filter by direction (incoming/outgoing)', async () => {
      const options: TransactionFilterOptions = {
        includeIncoming: true,
        includeOutgoing: false
      };
      
      // @ts-ignore - accessing private method for testing
      const result = processor['normalizeTransactions'](
        mockTransactions,
        'wallet1',
        1,
        ChainType.EVM,
        options
      );
      
      expect(result.length).toBe(1);
      expect(result[0].hash).toBe('tx2'); // Incoming transaction (to wallet1)
    });

    it('should filter by counterparties', async () => {
      const options: TransactionFilterOptions = {
        counterparties: ['wallet3']
      };
      
      // @ts-ignore - accessing private method for testing
      const result = processor['normalizeTransactions'](
        mockTransactions,
        'wallet1',
        1,
        ChainType.EVM,
        options
      );
      
      expect(result.length).toBe(1);
      expect(result[0].hash).toBe('tx3');
    });

    it('should exclude counterparties', async () => {
      const options: TransactionFilterOptions = {
        excludeCounterparties: ['wallet3']
      };
      
      // @ts-ignore - accessing private method for testing
      const result = processor['normalizeTransactions'](
        mockTransactions,
        'wallet1',
        1,
        ChainType.EVM,
        options
      );
      
      expect(result.length).toBe(2);
      expect(result[0].hash).toBe('tx1');
      expect(result[1].hash).toBe('tx2');
    });
  });

  describe('filterTransactions', () => {
    it('should filter transactions using custom function', () => {
      const normalizedTxs: NormalizedTransaction[] = [
        {
          id: '1-tx1',
          hash: 'tx1',
          from: 'wallet1',
          to: 'wallet2',
          value: BigNumber.from(1000000),
          timestamp: 1620000000,
          blockNumber: 12345,
          confirmations: 100,
          status: 'success',
          chainId: 1,
          chainType: ChainType.EVM
        },
        {
          id: '1-tx2',
          hash: 'tx2',
          from: 'wallet2',
          to: 'wallet1',
          value: BigNumber.from(2000000),
          timestamp: 1620010000,
          blockNumber: 12346,
          confirmations: 99,
          status: 'success',
          chainId: 1,
          chainType: ChainType.EVM
        }
      ];
      
      const result = processor.filterTransactions(
        normalizedTxs,
        tx => tx.value.gt(BigNumber.from(1500000))
      );
      
      expect(result.length).toBe(1);
      expect(result[0].hash).toBe('tx2');
    });
  });

  describe('aggregateTransactions', () => {
    it('should aggregate transaction data correctly', () => {
      const normalizedTxs: NormalizedTransaction[] = [
        {
          id: '1-tx1',
          hash: 'tx1',
          from: 'wallet1',
          to: 'wallet2',
          value: BigNumber.from(1000000),
          timestamp: 1620000000,
          blockNumber: 12345,
          confirmations: 100,
          status: 'success',
          chainId: 1,
          chainType: ChainType.EVM,
          valueUSD: 100
        },
        {
          id: '56-tx2',
          hash: 'tx2',
          from: 'wallet2',
          to: 'wallet1',
          value: BigNumber.from(2000000),
          timestamp: 1620010000,
          blockNumber: 12346,
          confirmations: 99,
          status: 'success',
          chainId: 56,
          chainType: ChainType.EVM,
          valueUSD: 200
        }
      ];
      
      const result = processor.aggregateTransactions(normalizedTxs);
      
      expect(result.totalValue.toString()).toBe('3000000');
      expect(result.totalValueUSD).toBe(300);
      expect(result.count).toBe(2);
      expect(result.timeRange.start).toBe(1620000000);
      expect(result.timeRange.end).toBe(1620010000);
      
      // Chain-specific totals
      expect(result.byChain[1].totalValue.toString()).toBe('1000000');
      expect(result.byChain[1].totalValueUSD).toBe(100);
      expect(result.byChain[1].count).toBe(1);
      
      expect(result.byChain[56].totalValue.toString()).toBe('2000000');
      expect(result.byChain[56].totalValueUSD).toBe(200);
      expect(result.byChain[56].count).toBe(1);
    });

    it('should handle empty transaction list', () => {
      const result = processor.aggregateTransactions([]);
      
      expect(result.totalValue.toString()).toBe('0');
      expect(result.totalValueUSD).toBe(0);
      expect(result.count).toBe(0);
      expect(result.timeRange.start).toBe(0);
      expect(result.timeRange.end).toBe(0);
      expect(Object.keys(result.byChain).length).toBe(0);
    });

    it('should handle transactions without USD values', () => {
      const normalizedTxs: NormalizedTransaction[] = [
        {
          id: '1-tx1',
          hash: 'tx1',
          from: 'wallet1',
          to: 'wallet2',
          value: BigNumber.from(1000000),
          timestamp: 1620000000,
          blockNumber: 12345,
          confirmations: 100,
          status: 'success',
          chainId: 1,
          chainType: ChainType.EVM
          // No valueUSD
        }
      ];
      
      const result = processor.aggregateTransactions(normalizedTxs);
      
      expect(result.totalValue.toString()).toBe('1000000');
      expect(result.totalValueUSD).toBeUndefined();
      expect(result.byChain[1].totalValueUSD).toBeUndefined();
    });
  });

  describe('prepareTransactionsForProof', () => {
    it('should prepare transactions and aggregation for proof generation', async () => {
      // Spy on the methods we expect to be called
      const getAllChainTransactionsSpy = jest.spyOn(processor, 'getAllChainTransactions');
      const aggregateTransactionsSpy = jest.spyOn(processor, 'aggregateTransactions');
      
      // Mock transactions to be returned
      const normalizedTxs: NormalizedTransaction[] = [
        {
          id: '1-tx1',
          hash: 'tx1',
          from: 'wallet1',
          to: 'wallet2',
          value: BigNumber.from(1000000),
          timestamp: 1620000000,
          blockNumber: 12345,
          confirmations: 100,
          status: 'success',
          chainId: 1,
          chainType: ChainType.EVM
        }
      ];
      
      getAllChainTransactionsSpy.mockResolvedValue(normalizedTxs);
      
      const options: TransactionFilterOptions = {
        startDate: 1610000000,
        endDate: 1630000000
      };
      
      const result = await processor.prepareTransactionsForProof('wallet1', options);
      
      expect(getAllChainTransactionsSpy).toHaveBeenCalledWith('wallet1', options);
      expect(aggregateTransactionsSpy).toHaveBeenCalledWith(normalizedTxs);
      
      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('aggregation');
      expect(result.transactions).toBe(normalizedTxs);
    });
  });
});