/**
 * Network Configuration
 * 
 * This file provides network configurations for different environments.
 * It allows for easy switching between testnet and mainnet environments.
 */

// Polygon Networks
export const POLYGON_NETWORKS = {
  // Polygon Amoy Testnet
  AMOY: {
    name: 'Polygon Amoy Testnet',
    chainId: 80002,
    rpcUrl: 'https://polygon-amoy-rpc.publicnode.com',
    blockExplorer: 'https://amoy.polygonscan.com',
    isTestnet: true,
    contractAddress: '0xD6bd1eFCE3A2c4737856724f96F39037a3564890', // Amoy testnet contract
    zkVerifierAddress: '0x0000000000000000000000000000000000000456', // Placeholder ZK verifier on Amoy
  },
  
  // Polygon Mainnet
  MAINNET: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    isTestnet: false,
    // Update this with the actual mainnet contract address when deployed
    contractAddress: '0x0000000000000000000000000000000000000000', // Placeholder - replace with real address
    zkVerifierAddress: '0x0000000000000000000000000000000000000000', // Placeholder - replace with real address
  }
};

// Default network to use (can be overridden in app code)
export const DEFAULT_NETWORK = 'AMOY';

// Export a helper for getting current network settings
export const getNetworkConfig = (networkKey = DEFAULT_NETWORK) => {
  if (!POLYGON_NETWORKS[networkKey]) {
    console.warn(`Network ${networkKey} not found, using default ${DEFAULT_NETWORK}`);
    return POLYGON_NETWORKS[DEFAULT_NETWORK];
  }
  return POLYGON_NETWORKS[networkKey];
};