/**
 * Token Agnostic Wallet Scanning Phase 5.5 Tests
 * 
 * This test suite verifies the functionality implemented in Phase 5.5:
 * - Multi-chain asset scanning regardless of connected network
 * - Session storage caching for fast initial loads
 * - Cross-chain asset organization in the display
 * - Manual refresh button functionality
 */

// Mock browser environment
const mockSessionStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    getAllItems: () => store
  };
})();

// Mock window.ethereum
const mockEthereum = {
  request: jest.fn().mockResolvedValue('0x1')
};

// Setup mocks
global.sessionStorage = mockSessionStorage;
global.window = { ethereum: mockEthereum };

// Mock the API response for wallet assets
jest.mock('@proof-of-funds/common/utils/walletHelpers', () => ({
  scanMultiChainAssets: jest.fn().mockResolvedValue({
    totalAssets: [
      {
        symbol: 'ETH',
        balance: 1.5,
        price: 2000,
        usdValue: 3000,
        chain: 'ethereum',
        type: 'native'
      },
      {
        symbol: 'MATIC',
        balance: 100,
        price: 0.7,
        usdValue: 70,
        chain: 'polygon',
        type: 'native'
      },
      {
        symbol: 'USDC',
        balance: 500,
        price: 1,
        usdValue: 500,
        chain: 'ethereum',
        type: 'erc20'
      },
      {
        symbol: 'USDC',
        balance: 300,
        price: 1,
        usdValue: 300,
        chain: 'polygon',
        type: 'erc20'
      }
    ],
    totalValue: 3870,
    totalUSDValue: 3870,
    convertedAssets: [
      { symbol: 'ETH', balance: 1.5, price: 2000, usdValue: 3000, chain: 'ethereum', type: 'native' },
      { symbol: 'MATIC', balance: 100, price: 0.7, usdValue: 70, chain: 'polygon', type: 'native' },
      { symbol: 'USDC', balance: 500, price: 1, usdValue: 500, chain: 'ethereum', type: 'erc20' },
      { symbol: 'USDC', balance: 300, price: 1, usdValue: 300, chain: 'polygon', type: 'erc20' }
    ],
    chains: {
      ethereum: {
        nativeBalance: 1.5,
        tokens: { USDC: 500 },
        nativeUSDValue: 3000,
        tokensUSDValue: { USDC: 500 },
        totalUSDValue: 3500
      },
      polygon: {
        nativeBalance: 100,
        tokens: { USDC: 300 },
        nativeUSDValue: 70,
        tokensUSDValue: { USDC: 300 },
        totalUSDValue: 370
      }
    },
    crossChain: {
      crossChainSummary: [
        {
          symbol: 'USDC',
          totalBalance: 800,
          totalUsdValue: 800,
          instances: [
            { chain: 'ethereum', balance: 500, usdValue: 500 },
            { chain: 'polygon', balance: 300, usdValue: 300 }
          ]
        }
      ]
    }
  }),
  convertAssetsToUSD: jest.fn().mockImplementation(summary => Promise.resolve(summary)),
  getConnectedWallets: jest.fn().mockResolvedValue([
    { id: 'wallet1', address: '0x123', chain: 'ethereum', name: 'Ethereum Wallet' }
  ])
}));

// Import the module to test
const { loadAssets, tryGetCachedAssets, cacheAssets } = require('@proof-of-funds/frontend/pages/create');

// Test suite
describe('Token Agnostic Wallet Scanning Phase 5.5', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('loadAssets should scan multiple chains regardless of connected network', async () => {
    // Setup
    const walletObjects = [{ id: 'wallet1', address: '0x123', chain: 'ethereum' }];
    const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
    
    // Call loadAssets (simulating component)
    await loadAssets();
    
    // Verify multi-chain scanning options were used
    expect(scanMultiChainAssets).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        chains: expect.arrayContaining(['ethereum', 'polygon', 'bsc', 'arbitrum', 'avalanche', 'fantom'])
      })
    );
  });
  
  test('Session storage caching should work correctly', async () => {
    // Setup mock data
    const mockAssets = {
      totalAssets: [{ symbol: 'ETH', balance: 1.5 }],
      totalUSDValue: 3000
    };
    const address = '0x123abc';
    
    // Test caching
    cacheAssets(address, mockAssets);
    
    // Verify data was cached with timestamp
    const cachedData = JSON.parse(sessionStorage.getItem(`assets_${address.toLowerCase()}`));
    expect(cachedData.data).toEqual(mockAssets);
    expect(cachedData.timestamp).toBeDefined();
    
    // Test cache retrieval
    const retrievedAssets = tryGetCachedAssets(address);
    expect(retrievedAssets).toEqual(mockAssets);
    
    // Test cache expiration (simulate old cache)
    const oldCache = {
      data: mockAssets,
      timestamp: Date.now() - (10 * 60 * 1000) // 10 minutes old (should be expired)
    };
    sessionStorage.setItem(`assets_${address.toLowerCase()}`, JSON.stringify(oldCache));
    
    const expiredCacheAssets = tryGetCachedAssets(address);
    expect(expiredCacheAssets).toBeNull();
  });
  
  test('Manual refresh should bypass cache', async () => {
    // Setup
    const walletObjects = [{ id: 'wallet1', address: '0x123', chain: 'ethereum' }];
    const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
    
    // Mock cached data
    const mockAssets = {
      totalAssets: [{ symbol: 'OLD_DATA', balance: 1.0 }],
      totalUSDValue: 1000
    };
    cacheAssets('0x123', mockAssets);
    
    // Call loadAssets with force refresh
    await loadAssets(true);
    
    // Verify that multi-chain scanning was called despite cache being available
    expect(scanMultiChainAssets).toHaveBeenCalled();
  });
});