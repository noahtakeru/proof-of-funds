/**
 * Network configuration for different environments
 * This ensures we use the correct network (Amoy for development, mainnet for production)
 */

import { 
  getChainId, 
  getRpcUrl as getChainRpcUrl, 
  getExplorerUrl as getChainExplorerUrl,
  getNativeTokenSymbol
} from '@proof-of-funds/common/src/utils/chainMappings';

/**
 * Get the network configuration for the current environment
 * @returns {Object} Network configuration object
 */
export function getNetworkConfig() {
  // Default to Amoy for development
  const isProduction = process.env.NODE_ENV === 'production';
  const useMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
  
  // Use mainnet only if explicitly set in production
  const chainName = (isProduction && useMainnet) ? 'polygon' : 'polygon-amoy';
  
  // Use chainMappings to get consistent data
  return {
    chainId: getChainId(chainName),
    name: chainName === 'polygon' ? 'Polygon Mainnet' : 'Polygon Amoy Testnet',
    rpcUrl: getChainRpcUrl(chainName),
    explorer: getChainExplorerUrl(chainName),
    nativeCurrency: {
      name: 'MATIC',
      symbol: getNativeTokenSymbol(chainName),
      decimals: 18
    }
  };
}

/**
 * Get the RPC URL for the current network
 * @returns {string} RPC URL
 */
export function getRpcUrl() {
  const network = getNetworkConfig();
  return process.env.POLYGON_RPC_URL || network.rpcUrl;
}

/**
 * Get the explorer URL for a transaction hash
 * @param {string} hash - Transaction hash
 * @returns {string} Explorer URL
 */
export function getExplorerUrl(hash) {
  const network = getNetworkConfig();
  return `${network.explorer}tx/${hash}`;
}

// Export the network config for potential direct use
export default {
  getNetworkConfig,
  getRpcUrl,
  getExplorerUrl
};