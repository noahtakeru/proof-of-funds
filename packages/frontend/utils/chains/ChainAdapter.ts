/**
 * Chain Adapter Interface
 * 
 * This module defines a universal interface for interacting with different blockchains.
 * It allows the application to abstract away blockchain-specific implementation details
 * and provides a consistent API for balance and transaction operations.
 */
import { BigNumber } from 'ethers';

/**
 * Represents a blockchain transaction
 */
export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  blockNumber: number;
  confirmations: number;
  status: 'success' | 'failed' | 'pending';
}

/**
 * Interface for chain-specific account information
 */
export interface ChainAccount {
  address: string;
  balance: BigNumber;
  nonce?: number;
  chainId: number;
}

/**
 * Chain connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

/**
 * Configuration options for retrieving transactions
 */
export interface TransactionOptions {
  limit?: number;
  offset?: number;
  startBlock?: number;
  endBlock?: number;
  minValue?: BigNumber;
}

/**
 * Common interface for all blockchain adapters
 */
export interface ChainAdapter {
  /**
   * Get the balance of an address
   * @param address The address to check
   * @returns Promise resolving to the address balance
   */
  getBalance(address: string): Promise<BigNumber>;

  /**
   * Get transactions for an address
   * @param address The address to get transactions for
   * @param options Transaction retrieval options
   * @returns Promise resolving to an array of transactions
   */
  getTransactions(address: string, options?: TransactionOptions): Promise<Transaction[]>;

  /**
   * Validate an address for the specific chain
   * @param address The address to validate
   * @returns Whether the address is valid for this chain
   */
  validateAddress(address: string): boolean;

  /**
   * Sign a message with the connected wallet
   * @param message The message to sign
   * @returns Promise resolving to the signature
   */
  signMessage(message: string): Promise<string>;

  /**
   * Recover the address that signed a message
   * @param message The original message that was signed
   * @param signature The signature to verify
   * @returns The address that created the signature
   */
  getAddressFromSignature(message: string, signature: string): string;

  /**
   * Get the chain ID for this adapter
   * @returns The chain ID
   */
  getChainId(): number;

  /**
   * Get human-readable name of the chain
   * @returns The chain name
   */
  getChainName(): string;

  /**
   * Get the current connection status
   * @returns The connection status
   */
  getConnectionStatus(): ConnectionStatus;

  /**
   * Connect to the chain
   * @param options Optional connection options
   * @returns Promise resolving to the connected address
   */
  connect(options?: any): Promise<string>;

  /**
   * Disconnect from the chain
   * @returns Promise that resolves when disconnected
   */
  disconnect(): Promise<void>;

  /**
   * Check if the adapter is ready to use
   * @returns Whether the adapter is ready
   */
  isReady(): boolean;
}