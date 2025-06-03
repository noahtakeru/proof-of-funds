/**
 * Chain Mappings Utility
 * 
 * This module provides a centralized source for chain ID and name mappings 
 * to ensure consistency across the application.
 */

/**
 * EVM Chain IDs to chain name mapping
 */
export const CHAIN_IDS = {
  // Mainnets
  1: 'ethereum',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  56: 'binance',
  43114: 'avalanche',
  250: 'fantom',
  
  // Testnets
  5: 'goerli',
  80001: 'mumbai',
  421613: 'arbitrum-goerli',
  11155111: 'sepolia',
  97: 'binance-testnet',
  80002: 'polygon-amoy',
  
  // Local development
  1337: 'localhost',
  31337: 'hardhat'
};

/**
 * Chain names to chain ID mapping
 */
export const CHAIN_NAMES = Object.entries(CHAIN_IDS).reduce((acc, [id, name]) => {
  acc[name] = parseInt(id, 10);
  return acc;
}, {});

/**
 * Chain to RPC URL mapping
 */
export const CHAIN_RPC_URLS = {
  // Mainnets
  'ethereum': 'https://ethereum.publicnode.com',
  'polygon': 'https://polygon-rpc.com',
  'arbitrum': 'https://arb1.arbitrum.io/rpc',
  'optimism': 'https://mainnet.optimism.io',
  'binance': 'https://bsc-dataseed.binance.org',
  'avalanche': 'https://api.avax.network/ext/bc/C/rpc',
  'fantom': 'https://rpc.ftm.tools',
  
  // Testnets
  'goerli': 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  'mumbai': 'https://rpc-mumbai.maticvigil.com',
  'arbitrum-goerli': 'https://goerli-rollup.arbitrum.io/rpc',
  'sepolia': 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  'binance-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
  'polygon-amoy': 'https://rpc-amoy.polygon.technology',
  
  // Local development
  'localhost': 'http://localhost:8545',
  'hardhat': 'http://localhost:8545'
};

/**
 * Chain to Explorer URL mapping
 */
export const CHAIN_EXPLORER_URLS = {
  // Mainnets
  'ethereum': 'https://etherscan.io',
  'polygon': 'https://polygonscan.com',
  'arbitrum': 'https://arbiscan.io',
  'optimism': 'https://optimistic.etherscan.io',
  'binance': 'https://bscscan.com',
  'avalanche': 'https://snowtrace.io',
  'fantom': 'https://ftmscan.com',
  
  // Testnets
  'goerli': 'https://goerli.etherscan.io',
  'mumbai': 'https://mumbai.polygonscan.com',
  'arbitrum-goerli': 'https://goerli.arbiscan.io',
  'sepolia': 'https://sepolia.etherscan.io',
  'binance-testnet': 'https://testnet.bscscan.com',
  'polygon-amoy': 'https://amoy.polygonscan.com',
  
  // Local development - these don't have explorers by default
  'localhost': null,
  'hardhat': null
};

/**
 * Chain to Native Token mapping
 */
export const CHAIN_NATIVE_TOKENS = {
  // Mainnets
  'ethereum': 'ETH',
  'polygon': 'MATIC',
  'arbitrum': 'ETH',
  'optimism': 'ETH',
  'binance': 'BNB',
  'avalanche': 'AVAX',
  'fantom': 'FTM',
  
  // Testnets
  'goerli': 'ETH',
  'mumbai': 'MATIC',
  'arbitrum-goerli': 'ETH',
  'sepolia': 'ETH',
  'binance-testnet': 'BNB',
  'polygon-amoy': 'MATIC',
  
  // Local development
  'localhost': 'ETH',
  'hardhat': 'ETH'
};

/**
 * Chain to Moralis API chain identifier mapping
 */
export const CHAIN_MORALIS_MAPPING = {
  'ethereum': 'eth',
  'polygon': 'polygon',
  'arbitrum': 'arbitrum',
  'optimism': 'optimism',
  'binance': 'bsc',
  'avalanche': 'avalanche',
  'fantom': 'fantom',
  
  'goerli': 'goerli',
  'mumbai': 'mumbai',
  'arbitrum-goerli': 'arbitrum_goerli',
  'sepolia': 'sepolia',
  'binance-testnet': 'bsc_testnet',
  'polygon-amoy': 'polygon_amoy',
  'amoy': 'polygon_amoy' // Alternative name
};

/**
 * Get chain name from chain ID
 * @param {number|string} chainId - Chain ID as number or hex string
 * @returns {string} Chain name or 'unknown' if not found
 */
export function getChainName(chainId) {
  // Convert from hex string if needed
  if (typeof chainId === 'string' && chainId.startsWith('0x')) {
    chainId = parseInt(chainId, 16);
  }
  
  // Convert to number if string
  if (typeof chainId === 'string') {
    chainId = parseInt(chainId, 10);
  }
  
  return CHAIN_IDS[chainId] || 'unknown';
}

/**
 * Get chain ID from chain name
 * @param {string} chainName - Chain name (case insensitive)
 * @returns {number} Chain ID or null if not found
 */
export function getChainId(chainName) {
  if (!chainName) {return null;}
  
  const normalizedName = chainName.toLowerCase();
  return CHAIN_NAMES[normalizedName] || null;
}

/**
 * Get RPC URL for a chain
 * @param {string|number} chain - Chain name or ID
 * @returns {string} RPC URL or null if not found
 */
export function getRpcUrl(chain) {
  let chainName;
  
  if (typeof chain === 'number' || (typeof chain === 'string' && !isNaN(parseInt(chain, 10)))) {
    // If chain is a number or numeric string, treat as chain ID
    chainName = getChainName(chain);
  } else if (typeof chain === 'string') {
    // If chain is a non-numeric string, treat as chain name
    chainName = chain.toLowerCase();
  } else {
    return null;
  }
  
  return CHAIN_RPC_URLS[chainName] || null;
}

/**
 * Get explorer URL for a chain
 * @param {string|number} chain - Chain name or ID
 * @returns {string} Explorer URL or null if not found
 */
export function getExplorerUrl(chain) {
  let chainName;
  
  if (typeof chain === 'number' || (typeof chain === 'string' && !isNaN(parseInt(chain, 10)))) {
    // If chain is a number or numeric string, treat as chain ID
    chainName = getChainName(chain);
  } else if (typeof chain === 'string') {
    // If chain is a non-numeric string, treat as chain name
    chainName = chain.toLowerCase();
  } else {
    return null;
  }
  
  return CHAIN_EXPLORER_URLS[chainName] || null;
}

/**
 * Get native token symbol for a chain
 * @param {string|number} chain - Chain name or ID
 * @returns {string} Native token symbol or 'ETH' if not found
 */
export function getNativeTokenSymbol(chain) {
  let chainName;
  
  if (typeof chain === 'number' || (typeof chain === 'string' && !isNaN(parseInt(chain, 10)))) {
    // If chain is a number or numeric string, treat as chain ID
    chainName = getChainName(chain);
  } else if (typeof chain === 'string') {
    // If chain is a non-numeric string, treat as chain name
    chainName = chain.toLowerCase();
  } else {
    return 'ETH'; // Default
  }
  
  return CHAIN_NATIVE_TOKENS[chainName] || 'ETH';
}

/**
 * Get Moralis API identifier for a chain
 * @param {string|number} chain - Chain name or ID
 * @returns {string} Moralis chain identifier or null if not found
 */
export function getMoralisChainId(chain) {
  let chainName;
  
  if (typeof chain === 'number' || (typeof chain === 'string' && !isNaN(parseInt(chain, 10)))) {
    // If chain is a number or numeric string, treat as chain ID
    chainName = getChainName(chain);
  } else if (typeof chain === 'string') {
    // If chain is a non-numeric string, treat as chain name
    chainName = chain.toLowerCase();
  } else {
    return null;
  }
  
  return CHAIN_MORALIS_MAPPING[chainName] || null;
}

export default {
  CHAIN_IDS,
  CHAIN_NAMES,
  CHAIN_RPC_URLS,
  CHAIN_EXPLORER_URLS,
  CHAIN_NATIVE_TOKENS,
  CHAIN_MORALIS_MAPPING,
  getChainName,
  getChainId,
  getRpcUrl,
  getExplorerUrl,
  getNativeTokenSymbol,
  getMoralisChainId
};