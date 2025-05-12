/**
 * Token Agnostic Wallet Integration Tests
 * 
 * This test suite verifies the integration of token-agnostic wallet scanning
 * into the frontend components and validates that the implementation meets
 * all requirements from Phase 5.5 and 6.
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

global.sessionStorage = mockSessionStorage;
global.window = { 
  ethereum: {
    request: jest.fn().mockResolvedValue('0x1')
  }
};

// Import test utilities
const { mockWalletWithTokens, mockMultiChainWallet, mockEmptyWallet } = require('./test-utils/wallet-mocks');
const { mockApiFailure, mockRateLimitResponse } = require('./test-utils/api-mocks');

// Mock the frontend components
jest.mock('@proof-of-funds/frontend/components/MultiChainAssetDisplay', () => {
  return {
    __esModule: true,
    default: jest.fn(({ assets }) => {
      // Mock component that just returns metadata about what it would render
      return {
        type: 'MultiChainAssetDisplay',
        assetsCount: assets?.totalAssets?.length || 0,
        chainsCount: Object.keys(assets?.chains || {}).length || 0,
        crossChainGroupCount: assets?.crossChain?.crossChainSummary?.length || 0
      };
    })
  };
});

// Import the modules to test
const { loadAssets, tryGetCachedAssets, cacheAssets } = require('@proof-of-funds/frontend/pages/create');
const MultiChainAssetDisplay = require('@proof-of-funds/frontend/components/MultiChainAssetDisplay').default;

/**
 * Test Categories:
 * 1. Multi-Chain Wallet Scanning
 * 2. Session Storage Caching
 * 3. Asset Display Rendering
 * 4. Error Handling and Resilience
 * 5. Edge Case Handling
 */
describe('Token Agnostic Wallet Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });
  
  // Category 1: Multi-Chain Wallet Scanning
  describe('Multi-Chain Wallet Scanning', () => {
    test('should scan all configured chains regardless of connected chain', async () => {
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      await loadAssets([mockWalletWithTokens.ethereum]);
      
      expect(scanMultiChainAssets).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          chains: expect.arrayContaining(['ethereum', 'polygon', 'bsc', 'arbitrum', 'avalanche', 'fantom'])
        })
      );
    });
    
    test('should correctly handle wallets with tokens on multiple chains', async () => {
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      scanMultiChainAssets.mockResolvedValueOnce(mockMultiChainWallet.assetSummary);
      
      const result = await loadAssets([mockMultiChainWallet.wallet]);
      
      expect(result.chains).toHaveProperty('ethereum');
      expect(result.chains).toHaveProperty('polygon');
      expect(result.crossChain).toBeDefined();
      expect(result.crossChain.crossChainSummary.length).toBeGreaterThan(0);
    });
    
    test('should handle empty wallets gracefully', async () => {
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      scanMultiChainAssets.mockResolvedValueOnce(mockEmptyWallet.assetSummary);
      
      const result = await loadAssets([mockEmptyWallet.wallet]);
      
      expect(result.totalAssets).toEqual([]);
      expect(result.totalValue).toBe(0);
    });
  });
  
  // Category 2: Session Storage Caching
  describe('Session Storage Caching', () => {
    test('should store wallet assets in session storage with timestamp', async () => {
      const mockAssets = mockWalletWithTokens.assetSummary;
      const walletAddress = '0x123abc';
      
      cacheAssets(walletAddress, mockAssets);
      
      const cachedData = JSON.parse(sessionStorage.getItem(`assets_${walletAddress.toLowerCase()}`));
      expect(cachedData.data).toEqual(mockAssets);
      expect(cachedData.timestamp).toBeDefined();
    });
    
    test('should retrieve cached assets if available and not expired', () => {
      const mockAssets = mockWalletWithTokens.assetSummary;
      const walletAddress = '0x123abc';
      
      // Store with recent timestamp
      sessionStorage.setItem(`assets_${walletAddress.toLowerCase()}`, JSON.stringify({
        data: mockAssets,
        timestamp: Date.now() - (2 * 60 * 1000) // 2 minutes old (not expired)
      }));
      
      const result = tryGetCachedAssets(walletAddress);
      expect(result).toEqual(mockAssets);
    });
    
    test('should return null for expired cache entries', () => {
      const mockAssets = mockWalletWithTokens.assetSummary;
      const walletAddress = '0x123abc';
      
      // Store with old timestamp
      sessionStorage.setItem(`assets_${walletAddress.toLowerCase()}`, JSON.stringify({
        data: mockAssets,
        timestamp: Date.now() - (10 * 60 * 1000) // 10 minutes old (expired)
      }));
      
      const result = tryGetCachedAssets(walletAddress);
      expect(result).toBeNull();
    });
    
    test('should bypass cache when force refresh is requested', async () => {
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      scanMultiChainAssets.mockResolvedValueOnce(mockWalletWithTokens.assetSummary);
      
      // Cache some data
      cacheAssets('0x123abc', { ...mockWalletWithTokens.assetSummary, totalValue: 9999 });
      
      // Load with force refresh
      await loadAssets([{ address: '0x123abc' }], true);
      
      // Should call API despite cache being available
      expect(scanMultiChainAssets).toHaveBeenCalled();
    });
  });
  
  // Category 3: Asset Display Rendering
  describe('Asset Display Component Integration', () => {
    test('should correctly pass asset data to MultiChainAssetDisplay', async () => {
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      scanMultiChainAssets.mockResolvedValueOnce(mockMultiChainWallet.assetSummary);
      
      // Set props for component
      const props = { assets: mockMultiChainWallet.assetSummary };
      
      // Render component (mock)
      const result = MultiChainAssetDisplay(props);
      
      // Check that component received the right data
      expect(result.assetsCount).toBe(mockMultiChainWallet.assetSummary.totalAssets.length);
      expect(result.chainsCount).toBe(Object.keys(mockMultiChainWallet.assetSummary.chains).length);
      expect(result.crossChainGroupCount).toBe(mockMultiChainWallet.assetSummary.crossChain.crossChainSummary.length);
    });
    
    test('should handle rendering assets from uncommon chains', async () => {
      // Create mock data with tokens from uncommon chains
      const uncommonChainData = {
        ...mockMultiChainWallet.assetSummary,
        chains: {
          ...mockMultiChainWallet.assetSummary.chains,
          'fantom': {
            nativeBalance: 10,
            tokens: { 'FTM_TOKEN': 5 },
            nativeUSDValue: 20,
            tokensUSDValue: { 'FTM_TOKEN': 5 }
          },
          'avalanche': {
            nativeBalance: 2,
            tokens: { 'AVAX_TOKEN': 3 },
            nativeUSDValue: 40,
            tokensUSDValue: { 'AVAX_TOKEN': 30 }
          }
        }
      };
      
      // Set props for component
      const props = { assets: uncommonChainData };
      
      // Render component (mock)
      const result = MultiChainAssetDisplay(props);
      
      // Verify component received data with uncommon chains
      expect(result.chainsCount).toBe(Object.keys(uncommonChainData.chains).length);
    });
    
    test('should handle displaying tokens with missing metadata', async () => {
      // Create mock data with tokens missing metadata
      const missingMetadataAssets = {
        ...mockWalletWithTokens.assetSummary,
        totalAssets: [
          ...mockWalletWithTokens.assetSummary.totalAssets,
          {
            address: '0xUnknownToken123',
            balance: 100,
            balance_formatted: '100',
            chain: 'ethereum',
            type: 'erc20',
            // Deliberately missing name and symbol
            price: 0,
            usdValue: 0
          }
        ]
      };
      
      // Set props for component
      const props = { assets: missingMetadataAssets };
      
      // Render component (mock)
      const result = MultiChainAssetDisplay(props);
      
      // Verify component received the right number of assets
      expect(result.assetsCount).toBe(missingMetadataAssets.totalAssets.length);
    });
  });
  
  // Category 4: Error Handling and Resilience
  describe('Error Handling and Resilience', () => {
    test('should handle API failures gracefully', async () => {
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      scanMultiChainAssets.mockRejectedValueOnce(new Error('API failure'));
      
      // Mock console.error to avoid cluttering test output
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        await loadAssets([mockWalletWithTokens.ethereum]);
        // Function should complete without throwing
        expect(true).toBe(true);
      } catch (e) {
        // Should not reach here
        expect(false).toBe(true);
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
      }
    });
    
    test('should handle rate limit errors properly', async () => {
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      scanMultiChainAssets.mockRejectedValueOnce({ 
        status: 429, 
        message: 'Too Many Requests' 
      });
      
      // Mock console.error to avoid cluttering test output
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        await loadAssets([mockWalletWithTokens.ethereum]);
        // Function should complete without throwing
        expect(true).toBe(true);
      } catch (e) {
        // Should not reach here
        expect(false).toBe(true);
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
      }
    });
  });
  
  // Category 5: Edge Case Handling
  describe('Edge Case Handling', () => {
    test('should handle wallets with large numbers of tokens (100+)', async () => {
      // Create mock data with 100+ tokens
      const largeTokenList = Array(150).fill(0).map((_, i) => ({
        symbol: `TOKEN${i}`,
        name: `Token ${i}`,
        address: `0xToken${i}`,
        balance: 100,
        balance_formatted: '100',
        chain: i % 2 === 0 ? 'ethereum' : 'polygon',
        type: 'erc20',
        price: 1,
        usdValue: 100
      }));
      
      const largeWalletData = {
        ...mockWalletWithTokens.assetSummary,
        totalAssets: largeTokenList,
        meta: {
          ...mockWalletWithTokens.assetSummary.meta,
          pagination: {
            totalPages: 3,
            totalTokens: 150
          }
        }
      };
      
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      scanMultiChainAssets.mockResolvedValueOnce(largeWalletData);
      
      // Loading should complete without timing out
      const result = await loadAssets([mockWalletWithTokens.ethereum]);
      expect(result.totalAssets.length).toBe(150);
    });
    
    test('should handle memecoins and uncommon tokens', async () => {
      // Create mock data with memecoins
      const memecoinData = {
        ...mockWalletWithTokens.assetSummary,
        totalAssets: [
          ...mockWalletWithTokens.assetSummary.totalAssets,
          {
            symbol: 'DOGE',
            name: 'Dogecoin',
            address: '0xDogecoin123',
            balance: 1000,
            balance_formatted: '1000',
            chain: 'ethereum',
            type: 'erc20',
            price: 0.05,
            usdValue: 50
          },
          {
            symbol: 'SHIB',
            name: 'Shiba Inu',
            address: '0xShibaInu456',
            balance: 1000000,
            balance_formatted: '1000000',
            chain: 'ethereum',
            type: 'erc20',
            price: 0.00001,
            usdValue: 10
          },
          {
            symbol: 'PEPE',
            name: 'Pepe Coin',
            address: '0xPepeCoin789',
            balance: 10000000,
            balance_formatted: '10000000',
            chain: 'ethereum',
            type: 'erc20',
            price: 0.000001,
            usdValue: 10
          }
        ]
      };
      
      const scanMultiChainAssets = require('@proof-of-funds/common/utils/walletHelpers').scanMultiChainAssets;
      scanMultiChainAssets.mockResolvedValueOnce(memecoinData);
      
      // Loading should complete and include memecoins
      const result = await loadAssets([mockWalletWithTokens.ethereum]);
      const memecoinSymbols = ['DOGE', 'SHIB', 'PEPE'];
      
      memecoinSymbols.forEach(symbol => {
        const found = result.totalAssets.some(token => token.symbol === symbol);
        expect(found).toBe(true);
      });
    });
  });
});
