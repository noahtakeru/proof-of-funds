/**
 * Mock wallet data for testing token-agnostic wallet scanning
 * 
 * This file provides standardized mock wallet data for all test cases
 * related to wallet scanning functionality.
 */

// Mock wallet with common tokens on Ethereum
const mockWalletWithTokens = {
  ethereum: {
    address: '0x123456789abcdef0123456789abcdef01234567',
    chain: 'ethereum',
    name: 'Test Ethereum Wallet',
    provider: 'metamask'
  },
  assetSummary: {
    totalAssets: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        token_address: '0xNative',
        balance: 1.5,
        balance_formatted: '1.5',
        decimals: 18,
        type: 'native',
        chain: 'ethereum',
        price: 2000,
        usdValue: 3000,
        priceSource: 'coingecko'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        balance: 500,
        balance_formatted: '500',
        decimals: 6,
        type: 'erc20',
        chain: 'ethereum',
        price: 1,
        usdValue: 500,
        priceSource: 'moralis'
      },
      {
        symbol: 'LINK',
        name: 'Chainlink',
        token_address: '0x514910771af9ca656af840dff83e8264ecf986ca',
        balance: 10,
        balance_formatted: '10',
        decimals: 18,
        type: 'erc20',
        chain: 'ethereum',
        price: 15,
        usdValue: 150,
        priceSource: 'coingecko'
      }
    ],
    chains: {
      ethereum: {
        nativeBalance: 1.5,
        tokens: { 
          USDC: 500,
          LINK: 10
        },
        nativeUSDValue: 3000,
        tokensUSDValue: { 
          USDC: 500,
          LINK: 150
        }
      }
    },
    totalValue: 3650,
    totalUSDValue: 3650,
    walletAddresses: ['0x123456789abcdef0123456789abcdef01234567'],
    meta: {
      scanDuration: 1240,
      chainsScanned: ['ethereum'],
      totalTokenCount: 3
    },
    crossChain: {
      crossChainSummary: [
        {
          symbol: 'ETH',
          name: 'Ethereum',
          instances: [
            { chain: 'ethereum', balance: 1.5, usdValue: 3000 }
          ],
          totalUsdValue: 3000,
          chainCount: 1,
          chains: ['ethereum']
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          instances: [
            { chain: 'ethereum', balance: 500, usdValue: 500 }
          ],
          totalUsdValue: 500,
          chainCount: 1,
          chains: ['ethereum']
        },
        {
          symbol: 'LINK',
          name: 'Chainlink',
          instances: [
            { chain: 'ethereum', balance: 10, usdValue: 150 }
          ],
          totalUsdValue: 150,
          chainCount: 1,
          chains: ['ethereum']
        }
      ]
    }
  }
};

// Mock wallet with tokens across multiple chains
const mockMultiChainWallet = {
  wallet: {
    address: '0x234567890abcdef1234567890abcdef12345678',
    chain: 'ethereum',
    name: 'Multi-Chain Test Wallet',
    provider: 'metamask'
  },
  assetSummary: {
    totalAssets: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        token_address: '0xNative',
        balance: 1.5,
        balance_formatted: '1.5',
        decimals: 18,
        type: 'native',
        chain: 'ethereum',
        price: 2000,
        usdValue: 3000,
        priceSource: 'coingecko'
      },
      {
        symbol: 'MATIC',
        name: 'Polygon',
        token_address: '0xNative',
        balance: 100,
        balance_formatted: '100',
        decimals: 18,
        type: 'native',
        chain: 'polygon',
        price: 0.7,
        usdValue: 70,
        priceSource: 'moralis'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        balance: 500,
        balance_formatted: '500',
        decimals: 6,
        type: 'erc20',
        chain: 'ethereum',
        price: 1,
        usdValue: 500,
        priceSource: 'moralis'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        token_address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        balance: 300,
        balance_formatted: '300',
        decimals: 6,
        type: 'erc20',
        chain: 'polygon',
        price: 1,
        usdValue: 300,
        priceSource: 'moralis'
      }
    ],
    chains: {
      ethereum: {
        nativeBalance: 1.5,
        tokens: { 
          USDC: 500
        },
        nativeUSDValue: 3000,
        tokensUSDValue: { 
          USDC: 500
        }
      },
      polygon: {
        nativeBalance: 100,
        tokens: { 
          USDC: 300
        },
        nativeUSDValue: 70,
        tokensUSDValue: { 
          USDC: 300
        }
      }
    },
    totalValue: 3870,
    totalUSDValue: 3870,
    walletAddresses: ['0x234567890abcdef1234567890abcdef12345678'],
    meta: {
      scanDuration: 1500,
      chainsScanned: ['ethereum', 'polygon'],
      totalTokenCount: 4
    },
    crossChain: {
      crossChainSummary: [
        {
          symbol: 'ETH',
          name: 'Ethereum',
          instances: [
            { chain: 'ethereum', balance: 1.5, usdValue: 3000 }
          ],
          totalUsdValue: 3000,
          chainCount: 1,
          chains: ['ethereum']
        },
        {
          symbol: 'MATIC',
          name: 'Polygon',
          instances: [
            { chain: 'polygon', balance: 100, usdValue: 70 }
          ],
          totalUsdValue: 70,
          chainCount: 1,
          chains: ['polygon']
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          instances: [
            { chain: 'ethereum', balance: 500, usdValue: 500 },
            { chain: 'polygon', balance: 300, usdValue: 300 }
          ],
          totalUsdValue: 800,
          chainCount: 2,
          chains: ['ethereum', 'polygon']
        }
      ]
    }
  }
};

// Mock empty wallet
const mockEmptyWallet = {
  wallet: {
    address: '0x345678901abcdef2345678901abcdef23456789',
    chain: 'ethereum',
    name: 'Empty Test Wallet',
    provider: 'metamask'
  },
  assetSummary: {
    totalAssets: [],
    chains: {},
    totalValue: 0,
    totalUSDValue: 0,
    walletAddresses: ['0x345678901abcdef2345678901abcdef23456789'],
    meta: {
      scanDuration: 980,
      chainsScanned: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'avalanche', 'fantom'],
      totalTokenCount: 0
    },
    crossChain: {
      crossChainSummary: []
    }
  }
};

module.exports = {
  mockWalletWithTokens,
  mockMultiChainWallet,
  mockEmptyWallet
};
