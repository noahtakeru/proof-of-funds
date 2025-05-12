/**
 * Tests for cross-chain asset organization functionality
 * 
 * This test suite verifies the cross-chain asset organization feature
 * implemented in Phase 5 of the token-agnostic wallet scanning plan.
 */

// Import the cross-chain organization utilities
const { 
  organizeAssetsByCrossChain,
  enhanceTokenWithChainData
} = require('../packages/common/src/utils/apiHelpers');

/**
 * Tests for cross-chain asset organization
 */
describe('Cross-Chain Asset Organization', () => {
  
  // Test data with tokens across multiple chains
  const testAssets = [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      token_address: '0xNative',
      balance: 1.5,
      balance_formatted: '1.5',
      usdValue: 3000,
      chain: 'ethereum',
      type: 'native'
    },
    {
      symbol: 'ETH',
      name: 'Arbitrum ETH',
      token_address: '0xNative',
      balance: 0.5,
      balance_formatted: '0.5',
      usdValue: 1000,
      chain: 'arbitrum',
      type: 'native'
    },
    {
      symbol: 'MATIC',
      name: 'Polygon',
      token_address: '0xNative',
      balance: 100,
      balance_formatted: '100',
      usdValue: 50,
      chain: 'polygon',
      type: 'native'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      balance: 500,
      balance_formatted: '500',
      usdValue: 500,
      chain: 'ethereum',
      type: 'erc20'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      token_address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
      balance: 250,
      balance_formatted: '250',
      usdValue: 250,
      chain: 'polygon',
      type: 'erc20'
    },
    {
      symbol: 'usdc',  // lowercase to test case-insensitive grouping
      name: 'USD Coin',
      token_address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      balance: 100,
      balance_formatted: '100',
      usdValue: 100,
      chain: 'bsc',
      type: 'erc20'
    }
  ];
  
  // Test basic organization functionality
  describe('Basic Organization', () => {
    test('groups tokens by symbol across chains', () => {
      // Enhance tokens with chain data
      const assetsWithChainData = testAssets.map(asset => 
        enhanceTokenWithChainData(asset, asset.chain)
      );
      
      // Organize assets
      const organized = organizeAssetsByCrossChain(assetsWithChainData);
      
      // Should have 3 groups: ETH, MATIC, USDC
      expect(organized.crossChainSummary.length).toBe(3);
      
      // Verify USDC group (should include all 3 instances)
      const usdcGroup = organized.crossChainSummary.find(g => g.symbol === 'USDC');
      expect(usdcGroup).toBeDefined();
      expect(usdcGroup.instances.length).toBe(3);
      expect(usdcGroup.chains).toContain('ethereum');
      expect(usdcGroup.chains).toContain('polygon');
      expect(usdcGroup.chains).toContain('bsc');
      expect(usdcGroup.totalUsdValue).toBe(850); // 500 + 250 + 100
      
      // Verify ETH group (should include both Ethereum and Arbitrum)
      const ethGroup = organized.crossChainSummary.find(g => g.symbol === 'ETH');
      expect(ethGroup).toBeDefined();
      expect(ethGroup.instances.length).toBe(2);
      expect(ethGroup.chains).toContain('ethereum');
      expect(ethGroup.chains).toContain('arbitrum');
      expect(ethGroup.totalUsdValue).toBe(4000); // 3000 + 1000
    });
    
    test('sorts groups by total USD value', () => {
      // Enhance tokens with chain data
      const assetsWithChainData = testAssets.map(asset => 
        enhanceTokenWithChainData(asset, asset.chain)
      );
      
      // Organize assets
      const organized = organizeAssetsByCrossChain(assetsWithChainData);
      
      // First token should be ETH (highest value)
      expect(organized.crossChainSummary[0].symbol).toBe('ETH');
      expect(organized.crossChainSummary[0].totalUsdValue).toBe(4000);
      
      // Second token should be USDC
      expect(organized.crossChainSummary[1].symbol).toBe('USDC');
      expect(organized.crossChainSummary[1].totalUsdValue).toBe(850);
      
      // Last token should be MATIC (lowest value)
      expect(organized.crossChainSummary[2].symbol).toBe('MATIC');
      expect(organized.crossChainSummary[2].totalUsdValue).toBe(50);
    });
  });
  
  // Test token chain data enhancement
  describe('Token Chain Data Enhancement', () => {
    test('adds chain metadata to tokens', () => {
      // Test various chains
      const testChains = [
        { chain: 'ethereum', expectedId: 1 },
        { chain: 'polygon', expectedId: 137 },
        { chain: 'bsc', expectedId: 56 },
        { chain: 'arbitrum', expectedId: 42161 },
        { chain: 'avalanche', expectedId: 43114 },
        { chain: 'fantom', expectedId: 250 }
      ];
      
      testChains.forEach(({ chain, expectedId }) => {
        const token = { symbol: 'TEST', chain };
        const enhanced = enhanceTokenWithChainData(token, chain);
        
        // Check chain data
        expect(enhanced.chainId).toBe(expectedId);
        expect(enhanced.chainData.name).toBe(chain);
        expect(enhanced.chainData.id).toBe(expectedId);
        expect(enhanced.chainData.explorer).toBeDefined();
      });
    });
    
    test('identifies mainnet vs testnet chains', () => {
      // Test mainnet chain
      const mainnetToken = { symbol: 'TEST', chain: 'ethereum' };
      const enhancedMainnet = enhanceTokenWithChainData(mainnetToken, 'ethereum');
      expect(enhancedMainnet.chainData.isMainnet).toBe(true);
      
      // Test testnet chain
      const testnetTokens = [
        { symbol: 'TEST', chain: 'polygon-amoy' },
        { symbol: 'TEST', chain: 'goerli' },
        { symbol: 'TEST', chain: 'sepolia' },
        { symbol: 'TEST', chain: 'mumbai' }
      ];
      
      testnetTokens.forEach(token => {
        const enhancedTestnet = enhanceTokenWithChainData(token, token.chain);
        expect(enhancedTestnet.chainData.isMainnet).toBe(false);
      });
    });
  });
  
  // Test edge cases
  describe('Edge Cases', () => {
    test('handles tokens with identical symbols but different addresses', () => {
      // Create test data with two different USDT tokens
      const multiUsdt = [
        {
          symbol: 'USDT',
          name: 'Tether USD',
          token_address: '0xdac17f958d2ee523a2206206994597c13d831ec7', // Ethereum USDT
          balance: 1000,
          balance_formatted: '1000',
          usdValue: 1000,
          chain: 'ethereum',
          type: 'erc20'
        },
        {
          symbol: 'USDT',
          name: 'Tether USD', 
          token_address: '0x55d398326f99059ff775485246999027b3197955', // BSC USDT
          balance: 500,
          balance_formatted: '500',
          usdValue: 500,
          chain: 'bsc',
          type: 'erc20'
        }
      ].map(asset => enhanceTokenWithChainData(asset, asset.chain));
      
      // Organize assets
      const organized = organizeAssetsByCrossChain(multiUsdt);
      
      // Should have 1 group for USDT with 2 instances
      expect(organized.crossChainSummary.length).toBe(1);
      expect(organized.crossChainSummary[0].symbol).toBe('USDT');
      expect(organized.crossChainSummary[0].instances.length).toBe(2);
      expect(organized.crossChainSummary[0].totalUsdValue).toBe(1500);
    });
    
    test('handles error tokens by skipping them', () => {
      // Create test data with error tokens mixed in
      const mixedAssets = [
        {
          symbol: 'ETH',
          name: 'Ethereum',
          balance: 1,
          usdValue: 2000,
          chain: 'ethereum',
          type: 'native'
        },
        {
          type: 'error',
          errorMessage: 'Failed to load token'
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          balance: 100,
          usdValue: 100,
          chain: 'ethereum',
          type: 'erc20'
        }
      ].map(asset => asset.type === 'error' ? asset : enhanceTokenWithChainData(asset, asset.chain));
      
      // Organize assets
      const organized = organizeAssetsByCrossChain(mixedAssets);
      
      // Should only include valid tokens (ETH and USDC)
      expect(organized.crossChainSummary.length).toBe(2);
      expect(organized.crossChainSummary.map(g => g.symbol)).toContain('ETH');
      expect(organized.crossChainSummary.map(g => g.symbol)).toContain('USDC');
    });
    
    test('handles tokens with different name formats', () => {
      // Create test data with different name formats for same token
      const multiFormat = [
        {
          symbol: 'LINK',
          name: 'Chainlink',
          balance: 10,
          usdValue: 100,
          chain: 'ethereum',
          type: 'erc20'
        },
        {
          symbol: 'LINK',
          name: 'ChainLink Token', // Different name format
          balance: 5,
          usdValue: 50,
          chain: 'polygon',
          type: 'erc20'
        }
      ].map(asset => enhanceTokenWithChainData(asset, asset.chain));
      
      // Organize assets
      const organized = organizeAssetsByCrossChain(multiFormat);
      
      // Should have 1 group for LINK with 2 instances
      expect(organized.crossChainSummary.length).toBe(1);
      expect(organized.crossChainSummary[0].symbol).toBe('LINK');
      expect(organized.crossChainSummary[0].instances.length).toBe(2);
      // Should use the name from the first token
      expect(organized.crossChainSummary[0].name).toBe('Chainlink');
    });
  });
});
