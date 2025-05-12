/**
 * Network Manager Utility
 * 
 * This utility provides functions to manage and switch between networks.
 * It allows for runtime switching between testnet and mainnet environments
 * without requiring code changes or environment variables.
 */

import { POLYGON_NETWORKS, DEFAULT_NETWORK } from '../config/networks';

// Store current network key
let currentNetworkKey = DEFAULT_NETWORK;

/**
 * Get the current network configuration
 * @returns {Object} The current network configuration
 */
export const getCurrentNetwork = () => {
  return POLYGON_NETWORKS[currentNetworkKey];
};

/**
 * Switch the active network
 * @param {string} networkKey - The key of the network to switch to (e.g., 'AMOY', 'MAINNET')
 * @returns {Object} The new current network configuration
 */
export const switchNetwork = (networkKey) => {
  if (!POLYGON_NETWORKS[networkKey]) {
    console.warn(`Network ${networkKey} not found, using current ${currentNetworkKey}`);
    return POLYGON_NETWORKS[currentNetworkKey];
  }
  
  // Update current network key
  currentNetworkKey = networkKey;
  
  // Log network change
  console.log(`Switched to network: ${POLYGON_NETWORKS[currentNetworkKey].name}`);
  
  // Return the new current network
  return POLYGON_NETWORKS[currentNetworkKey];
};

/**
 * Check if current network is a testnet
 * @returns {boolean} True if current network is a testnet
 */
export const isTestnet = () => {
  return POLYGON_NETWORKS[currentNetworkKey].isTestnet;
};

/**
 * Get contract address for current network
 * @returns {string} The contract address for the current network
 */
export const getContractAddress = () => {
  return POLYGON_NETWORKS[currentNetworkKey].contractAddress;
};

/**
 * Get ZK verifier address for current network
 * @returns {string} The ZK verifier address for the current network
 */
export const getZKVerifierAddress = () => {
  return POLYGON_NETWORKS[currentNetworkKey].zkVerifierAddress;
};