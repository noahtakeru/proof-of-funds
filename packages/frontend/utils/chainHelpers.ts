/**
 * Chain Helper Utilities
 * 
 * This module provides helper functions for working with blockchain data
 * and integrating with the Chain Adapter system in API routes and services.
 */
import { ethers, BigNumber } from 'ethers';
import chainRegistry, { ChainType } from './chains/ChainAdapterRegistry';

/**
 * Convert a string value to a BigNumber
 * @param value The value to convert
 * @param defaultValue Default value if conversion fails
 * @returns BigNumber representation
 */
export function toBigNumber(value: string | number, defaultValue = '0'): BigNumber {
  try {
    return BigNumber.from(value.toString());
  } catch (error) {
    console.warn(`Invalid BigNumber value: ${value}. Using default.`);
    return BigNumber.from(defaultValue);
  }
}

/**
 * Format a BigNumber for display with appropriate units
 * @param value The value to format
 * @param decimals Number of decimals (default: 18 for ETH)
 * @param maxDecimals Maximum number of decimal places to display
 * @returns Formatted string
 */
export function formatCryptoValue(
  value: BigNumber | string,
  decimals = 18,
  maxDecimals = 4
): string {
  try {
    const bigNumberValue = typeof value === 'string' ? toBigNumber(value) : value;
    const formatted = ethers.utils.formatUnits(bigNumberValue, decimals);
    
    // Parse to float and fix decimal places
    const parsedValue = parseFloat(formatted);
    return parsedValue.toLocaleString(undefined, {
      maximumFractionDigits: maxDecimals
    });
  } catch (error) {
    console.warn(`Error formatting crypto value: ${error.message}`);
    return '0';
  }
}

/**
 * Validate an address for a specific chain
 * @param address The address to validate
 * @param chainType The chain type
 * @param chainId Optional specific chain ID
 * @returns Whether the address is valid
 */
export function validateAddress(
  address: string,
  chainType: ChainType = ChainType.EVM,
  chainId?: number
): boolean {
  try {
    const adapter = chainId 
      ? chainRegistry.getAdapter(chainId)
      : chainRegistry.getAdapterByType(chainType);
    
    return adapter.validateAddress(address);
  } catch (error) {
    console.error(`Error validating address: ${error.message}`);
    return false;
  }
}

/**
 * Get a provider for a specific chain
 * @param chainType The chain type
 * @param chainId The chain ID
 * @returns Ethers provider
 */
export function getProvider(chainType: ChainType, chainId: number): ethers.providers.Provider {
  // Only EVM chains are supported for now
  if (chainType !== ChainType.EVM) {
    throw new Error(`Provider not available for chain type: ${chainType}`);
  }
  
  // Get appropriate provider based on environment
  if (typeof window !== 'undefined' && window.ethereum) {
    // Browser environment with injected provider
    return new ethers.providers.Web3Provider(window.ethereum);
  } else {
    // Node.js environment or no injected provider
    const networks = chainRegistry.getSupportedNetworks({ type: ChainType.EVM });
    const network = networks.find(net => net.chainId === chainId);
    
    if (!network) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    const rpcUrl = network.rpcUrls[0];
    if (rpcUrl.includes('${INFURA_ID}')) {
      const infuraId = process.env.NEXT_PUBLIC_INFURA_ID || '';
      if (!infuraId) {
        throw new Error('NEXT_PUBLIC_INFURA_ID not set');
      }
      const processedUrl = rpcUrl.replace('${INFURA_ID}', infuraId);
      return new ethers.providers.JsonRpcProvider(processedUrl);
    }
    
    return new ethers.providers.JsonRpcProvider(rpcUrl);
  }
}

/**
 * Get a chain explorer URL for a transaction or address
 * @param chainId The chain ID
 * @param addressOrTx The address or transaction hash
 * @param type The type of URL ('address' or 'tx')
 * @returns Explorer URL
 */
export function getExplorerUrl(
  chainId: number,
  addressOrTx: string,
  type: 'address' | 'tx' = 'address'
): string {
  const networks = chainRegistry.getSupportedNetworks();
  const network = networks.find(net => net.chainId === chainId);
  
  if (!network || !network.blockExplorerUrls || network.blockExplorerUrls.length === 0) {
    return '';
  }
  
  const baseUrl = network.blockExplorerUrls[0];
  return `${baseUrl}/${type}/${addressOrTx}`;
}