/**
 * @file ContractInterface.ts
 * @description Base contract interface for ZK proof verification smart contracts
 */

import { ethers } from 'ethers';
import { ContractAddressRegistry } from './ContractAddressRegistry';
import { AbiVersionManager } from './AbiVersionManager';
import { TransactionOptions, TransactionResult, VerificationResult } from '../types';

/**
 * Base contract interface that provides common functionality for all contract interactions
 */
export abstract class ContractInterface {
  protected provider: ethers.providers.Provider;
  protected signer: ethers.Signer | null;
  protected addressRegistry: ContractAddressRegistry;
  protected abiManager: AbiVersionManager;
  protected contractName: string;
  protected contract: ethers.Contract | null = null;
  
  /**
   * Creates a new contract interface
   * @param provider The ethers provider
   * @param signer Optional signer for transactions
   * @param contractName Name of the contract
   * @param chainId Chain ID where the contract is deployed
   */
  constructor(
    provider: ethers.providers.Provider,
    signer: ethers.Signer | null,
    contractName: string,
    chainId: number
  ) {
    this.provider = provider;
    this.signer = signer;
    this.contractName = contractName;
    this.addressRegistry = new ContractAddressRegistry();
    this.abiManager = new AbiVersionManager(contractName);
    
    // Initialize the contract
    this.initializeContract(chainId);
  }

  /**
   * Initializes the contract instance
   * @param chainId Chain ID where the contract is deployed
   */
  protected initializeContract(chainId: number): void {
    const address = this.addressRegistry.getAddress(this.contractName, chainId);
    const abi = this.abiManager.getCurrentAbi();
    
    if (!address) {
      throw new Error(`No address found for contract ${this.contractName} on chain ${chainId}`);
    }
    
    if (this.signer) {
      this.contract = new ethers.Contract(address, abi, this.signer);
    } else {
      this.contract = new ethers.Contract(address, abi, this.provider);
    }
  }
  
  /**
   * Connects the contract to a signer
   * @param signer The ethers signer
   * @returns The contract interface for chaining
   */
  connect(signer: ethers.Signer): this {
    this.signer = signer;
    if (this.contract) {
      this.contract = this.contract.connect(signer);
    }
    return this;
  }
  
  /**
   * Changes the provider and network
   * @param provider The new provider
   * @param chainId The new chain ID
   * @returns The contract interface for chaining
   */
  changeNetwork(provider: ethers.providers.Provider, chainId: number): this {
    this.provider = provider;
    this.initializeContract(chainId);
    return this;
  }
  
  /**
   * Gets the contract address
   * @returns The contract address
   */
  getAddress(): string {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    return this.contract.address;
  }
  
  /**
   * Gets the current ABI version
   * @returns The current ABI version
   */
  getAbiVersion(): string {
    return this.abiManager.getCurrentVersion();
  }
  
  /**
   * Checks if the contract exists on the current network
   * @returns Promise that resolves to true if the contract exists
   */
  async contractExists(): Promise<boolean> {
    if (!this.contract) {
      return false;
    }
    
    const code = await this.provider.getCode(this.contract.address);
    // If there is no code at the address, the contract doesn't exist
    return code !== '0x';
  }
  
  /**
   * Executes a read-only contract call
   * @param method The contract method to call
   * @param args Arguments for the method
   * @returns Promise that resolves to the result
   */
  protected async call<T>(method: string, ...args: any[]): Promise<T> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    try {
      return await this.contract[method](...args) as T;
    } catch (error: any) {
      throw this.processContractError(error, method, args);
    }
  }
  
  /**
   * Executes a contract transaction
   * @param method The contract method to call
   * @param options Transaction options
   * @param args Arguments for the method
   * @returns Promise that resolves to the transaction result
   */
  protected async sendTransaction(
    method: string, 
    options: TransactionOptions = {},
    ...args: any[]
  ): Promise<TransactionResult> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    if (!this.signer) {
      throw new Error('No signer provided for transaction');
    }
    
    try {
      // Prepare transaction overrides
      const overrides: ethers.PayableOverrides = {};
      
      if (options.gasLimit) {
        overrides.gasLimit = options.gasLimit;
      }
      
      if (options.gasPrice) {
        overrides.gasPrice = options.gasPrice;
      }
      
      if (options.maxFeePerGas) {
        overrides.maxFeePerGas = options.maxFeePerGas;
      }
      
      if (options.maxPriorityFeePerGas) {
        overrides.maxPriorityFeePerGas = options.maxPriorityFeePerGas;
      }
      
      if (options.value) {
        overrides.value = options.value;
      }
      
      // Send transaction
      const tx = await this.contract[method](...args, overrides);
      
      // Handle waiting if required
      if (options.waitForConfirmation) {
        const receipt = await tx.wait(options.confirmations || 1);
        return {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          status: receipt.status === 1 ? 'success' : 'failure',
          gasUsed: receipt.gasUsed?.toNumber(),
          effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
          receipt,
          timestamp: Date.now(),
          errorMessage: receipt.status === 1 ? undefined : 'Transaction failed'
        };
      }
      
      return {
        transactionHash: tx.hash,
        status: 'pending',
        timestamp: Date.now()
      };
    } catch (error: any) {
      throw this.processContractError(error, method, args);
    }
  }
  
  /**
   * Process contract errors to provide more meaningful messages
   * @param error The original error
   * @param method The method that was called
   * @param args The arguments that were passed
   * @returns A more descriptive error
   */
  protected processContractError(error: any, method: string, args: any[]): Error {
    // Check for common error patterns in ethers
    if (error.code === 'CALL_EXCEPTION') {
      return new Error(`Contract call to ${method} failed: ${error.reason || error.message}`);
    }
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return new Error(`Insufficient funds to execute ${method}`);
    }
    
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return new Error(`Cannot estimate gas for ${method}: ${error.reason || error.message}`);
    }
    
    if (error.code === 'TIMEOUT') {
      return new Error(`Timeout when calling ${method}`);
    }
    
    if (error.message && error.message.includes('user rejected')) {
      return new Error(`User rejected transaction for ${method}`);
    }
    
    // Return original error with additional context if no specific handling
    const enhancedError = new Error(`Error executing ${method}: ${error.message}`);
    (enhancedError as any).originalError = error;
    return enhancedError;
  }
  
  /**
   * Estimate gas for a contract transaction
   * @param method The contract method to call
   * @param args Arguments for the method
   * @returns Promise that resolves to the gas estimate
   */
  async estimateGas(method: string, ...args: any[]): Promise<ethers.BigNumber> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    try {
      return await this.contract.estimateGas[method](...args);
    } catch (error: any) {
      throw this.processContractError(error, method, args);
    }
  }
  
  /**
   * Check if the contract implements a specific interface (ERC-165)
   * @param interfaceId The interface ID to check
   * @returns Promise that resolves to true if the interface is supported
   */
  async supportsInterface(interfaceId: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    // Check if the contract has supportsInterface method (ERC-165)
    if (typeof this.contract.supportsInterface !== 'function') {
      return false;
    }
    
    try {
      return await this.contract.supportsInterface(interfaceId);
    } catch (error) {
      // If the call fails, the contract doesn't support ERC-165
      return false;
    }
  }
}