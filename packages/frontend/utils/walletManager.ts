/**
 * Wallet Manager
 * 
 * This module provides utilities for managing multiple wallets across
 * different blockchain networks. It integrates with the Chain Adapter system
 * to provide a unified interface for wallet operations.
 */
import { ethers, BigNumber } from 'ethers';
import { v4 as uuidv4 } from 'uuid';

import chainRegistry, { ChainType } from './chains/ChainAdapterRegistry';
import { ConnectionStatus } from './chains/ChainAdapter';

/**
 * Connected wallet information
 */
export interface ConnectedWallet {
  id: string;
  name: string;
  address: string;
  formattedAddress: string;
  fullAddress: string;
  chain: string;
  chainId: number;
  type: ChainType;
  balance?: string;
}

/**
 * Options for wallet connection
 */
export interface WalletConnectionOptions {
  chainType: ChainType;
  chainId?: number;
}

/**
 * Format an address for display (shortens the address)
 * @param address The address to format
 * @returns Formatted address
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  
  if (address.length > 20) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  
  return address;
}

/**
 * Generate a unique ID for a wallet
 * @param type Chain type
 * @param address Wallet address
 * @returns Unique wallet ID
 */
export function generateWalletId(type: ChainType, address: string): string {
  return `${type}-${address.substring(0, 8).toLowerCase()}`;
}

/**
 * Get provider name based on chain type
 * @param type Chain type
 * @returns Provider name
 */
export function getProviderName(type: ChainType): string {
  switch (type) {
    case ChainType.EVM:
      return 'MetaMask';
    case ChainType.SOLANA:
      return 'Phantom';
    case ChainType.BITCOIN:
      return 'Bitcoin Wallet';
    default:
      return 'Unknown';
  }
}

/**
 * Store wallets in localStorage
 * @param wallets Wallets to store
 */
export function storeWallets(wallets: ConnectedWallet[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Only store non-sensitive information
    const walletsToStore = wallets.map(wallet => ({
      id: wallet.id,
      address: wallet.address,
      fullAddress: wallet.fullAddress,
      chain: wallet.chain,
      chainId: wallet.chainId,
      type: wallet.type
    }));
    
    localStorage.setItem('connectedWallets', JSON.stringify(walletsToStore));
  } catch (error) {
    console.error('Error storing wallets:', error);
  }
}

/**
 * Load wallets from localStorage
 * @returns Stored wallets
 */
export function loadWallets(): Partial<ConnectedWallet>[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const storedWallets = localStorage.getItem('connectedWallets');
    if (!storedWallets) return [];
    
    return JSON.parse(storedWallets);
  } catch (error) {
    console.error('Error loading wallets:', error);
    return [];
  }
}

/**
 * Connect to a wallet using the specified options
 * @param options Connection options
 * @returns Connected wallet information
 */
export async function connectWallet(
  options: WalletConnectionOptions
): Promise<ConnectedWallet> {
  const { chainType, chainId } = options;
  
  // Get the appropriate adapter
  const adapter = chainId 
    ? chainRegistry.getAdapter(chainId)
    : chainRegistry.getAdapterByType(chainType);
  
  // Connect to the wallet
  const address = await adapter.connect();
  
  // Create wallet info
  const wallet: ConnectedWallet = {
    id: generateWalletId(chainType, address),
    name: getProviderName(chainType),
    address: formatAddress(address),
    formattedAddress: formatAddress(address),
    fullAddress: address,
    chain: adapter.getChainName(),
    chainId: adapter.getChainId(),
    type: chainType
  };
  
  // Get balance if available
  try {
    const balance = await adapter.getBalance(address);
    if (balance) {
      wallet.balance = ethers.utils.formatEther(balance);
    }
  } catch (error) {
    console.warn('Error getting wallet balance:', error);
  }
  
  return wallet;
}

/**
 * Disconnect a specific wallet
 * @param wallet The wallet to disconnect
 */
export async function disconnectWallet(wallet: ConnectedWallet): Promise<void> {
  const adapter = chainRegistry.getAdapter(wallet.chainId);
  
  // Only disconnect if connected
  if (adapter.getConnectionStatus() === ConnectionStatus.CONNECTED) {
    await adapter.disconnect();
  }
}

/**
 * Create a temporary wallet for proof generation
 * @param chainType Chain type for the temporary wallet
 * @param chainId Chain ID for the temporary wallet
 * @returns Temporary wallet information
 */
export async function createTemporaryWallet(
  chainType: ChainType = ChainType.EVM,
  chainId: number = 1
): Promise<ConnectedWallet> {
  // Generate a random wallet
  const wallet = ethers.Wallet.createRandom();
  
  return {
    id: generateWalletId(chainType, wallet.address),
    name: 'Temporary Wallet',
    address: formatAddress(wallet.address),
    formattedAddress: formatAddress(wallet.address),
    fullAddress: wallet.address,
    chain: chainId === 1 ? 'Ethereum' : chainId === 137 ? 'Polygon' : `Chain ${chainId}`,
    chainId,
    type: chainType,
    balance: '0'
  };
}

/**
 * Get the balance for a wallet
 * @param wallet The wallet to get balance for
 * @returns Promise resolving to the wallet balance
 */
export async function getWalletBalance(wallet: ConnectedWallet): Promise<string> {
  try {
    const adapter = chainRegistry.getAdapter(wallet.chainId);
    const balance = await adapter.getBalance(wallet.fullAddress);
    return ethers.utils.formatEther(balance);
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return '0';
  }
}

/**
 * Sign a message with a wallet
 * @param wallet The wallet to sign with
 * @param message The message to sign
 * @returns Promise resolving to the signature
 */
export async function signMessage(
  wallet: ConnectedWallet,
  message: string
): Promise<string> {
  const adapter = chainRegistry.getAdapter(wallet.chainId);
  
  if (adapter.getConnectionStatus() !== ConnectionStatus.CONNECTED) {
    // Try to reconnect
    await adapter.connect();
  }
  
  return await adapter.signMessage(message);
}