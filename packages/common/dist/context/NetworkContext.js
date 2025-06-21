/**
 * Network Context for Proof of Funds
 *
 * This context manages network selection between Polygon Amoy testnet and Polygon mainnet
 * across the application. It provides:
 * - Current network selection state (Polygon Amoy testnet or Polygon mainnet)
 * - Functions to switch between networks
 * - Relevant network configuration (chain ID, RPC URL, contract address)
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { CONTRACT_ADDRESS, POLYGON_AMOY_CHAIN_ID, POLYGON_AMOY_RPC_URL, POLYGON_MAINNET_CONTRACT_ADDRESS, POLYGON_MAINNET_CHAIN_ID, POLYGON_MAINNET_RPC_URL } from '../config/constants';
import { getChainId, getRpcUrl } from '../utils/chainMappings.js';
// Create the context
const NetworkContext = createContext(null);
// Custom hook to use the network context
export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
};
// Network Provider component
export const NetworkProvider = ({ children }) => {
    // Default to testnet for safety
    const [useTestNetwork, setUseTestNetwork] = useState(true);
    // Load network preference from localStorage if available
    useEffect(() => {
        const savedPref = localStorage.getItem('useTestNetwork');
        if (savedPref !== null) {
            setUseTestNetwork(savedPref === 'true');
        }
    }, []);
    // Save preference whenever it changes
    useEffect(() => {
        localStorage.setItem('useTestNetwork', useTestNetwork.toString());
    }, [useTestNetwork]);
    // Toggle network between testnet and mainnet
    const toggleNetwork = () => {
        setUseTestNetwork(prev => !prev);
    };
    // Get current network configuration based on selected network
    const getNetworkConfig = () => {
        // Use chainMappings utility for consistency
        const chainName = useTestNetwork ? 'polygon-amoy' : 'polygon';
        return {
            chainId: useTestNetwork ? POLYGON_AMOY_CHAIN_ID : POLYGON_MAINNET_CHAIN_ID,
            rpcUrl: useTestNetwork ? getRpcUrl(chainName) : getRpcUrl('polygon'),
            contractAddress: useTestNetwork ? CONTRACT_ADDRESS : POLYGON_MAINNET_CONTRACT_ADDRESS,
            networkName: useTestNetwork ? 'Polygon Amoy (Testnet)' : 'Polygon Mainnet',
            isTestnet: useTestNetwork
        };
    };
    // Create the context value
    const contextValue = {
        useTestNetwork,
        setUseTestNetwork,
        toggleNetwork,
        getNetworkConfig,
        // Add contract addresses for convenience
        contractAddress: useTestNetwork ? CONTRACT_ADDRESS : POLYGON_MAINNET_CONTRACT_ADDRESS
    };
    return (<NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>);
};
export default NetworkContext;
