/**
 * Transaction History Processor Tests
 */

import { BigNumber } from 'ethers';
import { TransactionHistoryProcessor } from './TransactionHistoryProcessor';
import { ChainAdapterRegistry, ChainType } from '../utils/chains/ChainAdapterRegistry';

describe('TransactionHistoryProcessor', () => {
  let processor;
  let mockRegistry;
  
  // Mock transaction data
  const mockEthTransactions = [
    {
      hash: '0x123',
      from: '0xsender1',
      to: '0xrecipient1',
      value: '1000000000000000000', // 1 ETH
      timestamp: 1622548800, // June 1, 2021
      blockNumber: 12345678,
      confirmations: 100,
      status: 'success'
    },
    {
      hash: '0x456',
      from: '0xrecipient1',
      to: '0xsender1',
      value: '500000000000000000', // 0.5 ETH
      timestamp: 1625140800, // July 1, 2021
      blockNumber: 12345700,
      confirmations: 50,
      status: 'success'
    }
  ];
  
  const mockSolTransactions = [
    {
      hash: 'sol123',
      from: 'solSender1',
      to: 'solRecipient1',
      value: '1000000000', // 1 SOL
      timestamp: 1627819200, // August 1, 2021
      blockNumber: 87654321,
      confirmations: 1000,
      status: 'success'
    }
  ];

  // Setup mock adapters and registry
  beforeEach(() => {
    // Create mock adapters
    const mockEthAdapter = {
      getTransactions: jest.fn().mockResolvedValue(mockEthTransactions),
      getChainId: jest.fn().mockReturnValue(1) // Ethereum
    };
    
    const mockSolAdapter = {
      getTransactions: jest.fn().mockResolvedValue(mockSolTransactions),
      getChainId: jest.fn().mockReturnValue(111) // Solana (example ID)
    };
    
    // Create mock registry
    mockRegistry = {
      getAdapterById: jest.fn(chainId => {
        if (chainId === 1) return mockEthAdapter;
        if (chainId === 111) return mockSolAdapter;
        return null;
      }),
      getChainTypeById: jest.fn(chainId => {
        if (chainId === 1) return ChainType.EVM;
        if (chainId === 111) return ChainType.SOLANA;
        return null;
      }),
      getAllChainIds: jest.fn().mockReturnValue([1, 111])
    };
    
    processor = new TransactionHistoryProcessor(mockRegistry);
  });
  
  test('should normalize transactions from a specific chain', async () => {
    const address = '0xrecipient1';
    const chainId = 1; // Ethereum
    
    const result = await processor.getChainTransactions(address, chainId);
    
    expect(result.length).toBe(2);
    expect(result[0].hash).toBe('0x123');
    expect(result[0].chainId).toBe(1);
    expect(result[0].chainType).toBe(ChainType.EVM);
    expect(result[0].value.toString()).toBe('1000000000000000000');
  });
  
  test('should aggregate transactions correctly', async () => {
    const normalizedTransactions = [
      {
        id: '1-0x123',
        hash: '0x123',
        from: '0xsender1',
        to: '0xrecipient1',
        value: BigNumber.from('1000000000000000000'),
        timestamp: 1622548800,
        blockNumber: 12345678,
        confirmations: 100,
        status: 'success',
        chainId: 1,
        chainType: ChainType.EVM
      },
      {
        id: '1-0x456',
        hash: '0x456',
        from: '0xrecipient1',
        to: '0xsender1',
        value: BigNumber.from('500000000000000000'),
        timestamp: 1625140800,
        blockNumber: 12345700,
        confirmations: 50,
        status: 'success',
        chainId: 1,
        chainType: ChainType.EVM
      },
      {
        id: '111-sol123',
        hash: 'sol123',
        from: 'solSender1',
        to: 'solRecipient1',
        value: BigNumber.from('1000000000'),
        timestamp: 1627819200,
        blockNumber: 87654321,
        confirmations: 1000,
        status: 'success',
        chainId: 111,
        chainType: ChainType.SOLANA
      }
    ];
    
    const aggregation = processor.aggregateTransactions(normalizedTransactions);
    
    expect(aggregation.count).toBe(3);
    expect(aggregation.totalValue.toString()).toBe('1500000000001000000000');
    expect(aggregation.byChain[1].count).toBe(2);
    expect(aggregation.byChain[111].count).toBe(1);
    expect(aggregation.timeRange.start).toBe(1622548800);
    expect(aggregation.timeRange.end).toBe(1627819200);
  });
  
  test('should filter transactions by date range', async () => {
    const address = '0xrecipient1';
    const options = {
      startDate: 1625000000, // After June 1, 2021
      endDate: 1628000000    // Before August 5, 2021
    };
    
    const result = await processor.getAllChainTransactions(address, options);
    
    // Should include July 1 ETH tx and August 1 SOL tx
    expect(result.length).toBe(2);
    expect(result.some(tx => tx.hash === '0x456')).toBe(true);
    expect(result.some(tx => tx.hash === 'sol123')).toBe(true);
    expect(result.some(tx => tx.hash === '0x123')).toBe(false);
  });
  
  test('should prepare transactions for proof generation', async () => {
    const address = '0xrecipient1';
    
    const result = await processor.prepareTransactionsForProof(address);
    
    expect(result.transactions.length).toBe(3);
    expect(result.aggregation).toBeDefined();
    expect(result.aggregation.count).toBe(3);
  });
});