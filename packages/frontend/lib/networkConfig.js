/**
 * Network configuration for different environments
 * This ensures we use the correct network (Amoy for development, mainnet for production)
 */

const networks = {
  amoy: {
    chainId: 80002,
    name: 'Polygon Amoy Testnet',
    rpcUrl: 'https://rpc-amoy.polygon.technology/',
    explorer: 'https://amoy.polygonscan.com/',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    }
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com/',
    explorer: 'https://polygonscan.com/',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    }
  }
};

export function getNetworkConfig() {
  // Default to Amoy for development
  const isProduction = process.env.NODE_ENV === 'production';
  const useMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
  
  // Use mainnet only if explicitly set in production
  if (isProduction && useMainnet) {
    return networks.polygon;
  }
  
  // Default to Amoy testnet for development and testing
  return networks.amoy;
}

export function getRpcUrl() {
  const network = getNetworkConfig();
  return process.env.POLYGON_RPC_URL || network.rpcUrl;
}

export function getExplorerUrl(hash) {
  const network = getNetworkConfig();
  return `${network.explorer}tx/${hash}`;
}

export default networks;