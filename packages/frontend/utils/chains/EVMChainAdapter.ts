/**
 * EVM Chain Adapter Implementation
 * 
 * This module implements the ChainAdapter interface for Ethereum-compatible
 * chains such as Ethereum Mainnet, Polygon, Arbitrum, and Optimism.
 * It provides methods for interacting with EVM chains using ethers.js.
 */
import { ethers, BigNumber } from 'ethers';
import {
  ChainAdapter,
  Transaction,
  TransactionOptions,
  ConnectionStatus,
  ChainAccount
} from './ChainAdapter';

// Import centralized chain mappings
import { 
  CHAIN_IDS, 
  CHAIN_NAMES, 
  CHAIN_NATIVE_TOKENS,
  CHAIN_EXPLORER_URLS,
  CHAIN_RPC_URLS
} from '@proof-of-funds/common/utils/chainMappings';

// Network configurations for supported EVM chains
// Enhanced with data from centralized chain mappings
export const EVM_NETWORKS = {
  1: {
    name: 'Ethereum Mainnet',
    rpcUrl: CHAIN_RPC_URLS['ethereum'] || 'https://mainnet.infura.io/v3/${INFURA_ID}',
    blockExplorer: CHAIN_EXPLORER_URLS['ethereum'] || 'https://etherscan.io',
    symbol: CHAIN_NATIVE_TOKENS['ethereum'] || 'ETH',
    decimals: 18,
    logo: '/assets/networks/ethereum.svg'
  },
  137: {
    name: 'Polygon',
    rpcUrl: CHAIN_RPC_URLS['polygon'] || 'https://polygon-rpc.com',
    blockExplorer: CHAIN_EXPLORER_URLS['polygon'] || 'https://polygonscan.com',
    symbol: CHAIN_NATIVE_TOKENS['polygon'] || 'MATIC',
    decimals: 18,
    logo: '/assets/networks/polygon.svg'
  },
  42161: {
    name: 'Arbitrum',
    rpcUrl: CHAIN_RPC_URLS['arbitrum'] || 'https://arb1.arbitrum.io/rpc',
    blockExplorer: CHAIN_EXPLORER_URLS['arbitrum'] || 'https://arbiscan.io',
    symbol: CHAIN_NATIVE_TOKENS['arbitrum'] || 'ETH',
    decimals: 18,
    logo: '/assets/networks/arbitrum.svg'
  },
  10: {
    name: 'Optimism',
    rpcUrl: CHAIN_RPC_URLS['optimism'] || 'https://mainnet.optimism.io',
    blockExplorer: CHAIN_EXPLORER_URLS['optimism'] || 'https://optimistic.etherscan.io',
    symbol: CHAIN_NATIVE_TOKENS['optimism'] || 'ETH',
    decimals: 18,
    logo: '/assets/networks/optimism.svg'
  },
  // Testnet support
  11155111: {
    name: 'Sepolia',
    rpcUrl: CHAIN_RPC_URLS['sepolia'] || 'https://sepolia.infura.io/v3/${INFURA_ID}',
    blockExplorer: CHAIN_EXPLORER_URLS['sepolia'] || 'https://sepolia.etherscan.io',
    symbol: CHAIN_NATIVE_TOKENS['sepolia'] || 'ETH',
    decimals: 18,
    logo: '/assets/networks/ethereum.svg',
    testnet: true
  },
  80001: {
    name: 'Polygon Mumbai',
    rpcUrl: CHAIN_RPC_URLS['mumbai'] || 'https://rpc-mumbai.maticvigil.com',
    blockExplorer: CHAIN_EXPLORER_URLS['mumbai'] || 'https://mumbai.polygonscan.com',
    symbol: CHAIN_NATIVE_TOKENS['mumbai'] || 'MATIC',
    decimals: 18,
    logo: '/assets/networks/polygon.svg',
    testnet: true
  },
  421613: {
    name: 'Arbitrum Goerli',
    rpcUrl: CHAIN_RPC_URLS['arbitrum-goerli'] || 'https://goerli-rollup.arbitrum.io/rpc',
    blockExplorer: CHAIN_EXPLORER_URLS['arbitrum-goerli'] || 'https://goerli.arbiscan.io',
    symbol: CHAIN_NATIVE_TOKENS['arbitrum-goerli'] || 'ETH',
    decimals: 18,
    logo: '/assets/networks/arbitrum.svg',
    testnet: true
  }
};

// Rate limiting settings to prevent provider overload
const RATE_LIMIT = {
  callsPerMinute: 100,
  callWindow: 60 * 1000, // 1 minute in ms
};

/**
 * Adapter for EVM-compatible chains using ethers.js
 */
export class EVMChainAdapter implements ChainAdapter {
  private provider: ethers.providers.Provider | null = null;
  private signer: ethers.Signer | null = null;
  private chainId: number;
  private walletAddress: string | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private callCounter: number = 0;
  private lastCallTimestamp: number = 0;
  private networkConfig: typeof EVM_NETWORKS[keyof typeof EVM_NETWORKS];
  private isMetaMaskInstalled: boolean = false;
  
  /**
   * Create a new EVM Chain Adapter
   * @param chainId The chain ID to connect to (defaults to Ethereum Mainnet)
   */
  constructor(chainId: number = 1) {
    // Validate chain ID
    if (!EVM_NETWORKS[chainId]) {
      console.warn(`Chain ID ${chainId} not supported, defaulting to Ethereum Mainnet`);
      this.chainId = 1;
    } else {
      this.chainId = chainId;
    }
    
    this.networkConfig = EVM_NETWORKS[this.chainId];
    
    // Check for MetaMask or other injected providers
    if (typeof window !== 'undefined' && window.ethereum) {
      this.isMetaMaskInstalled = true;
    }
    
    // Initialize providers
    this.initializeProvider();
  }
  
  /**
   * Initialize the ethers provider based on environment and available connectors
   */
  private initializeProvider(): void {
    try {
      // For the browser environment, try to use injected provider first
      if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
      } else {
        // Fallback to RPC provider
        const rpcUrl = this.processRpcUrl(this.networkConfig.rpcUrl);
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      }
    } catch (error) {
      console.error('Failed to initialize provider:', error);
      this.connectionStatus = ConnectionStatus.ERROR;
    }
  }
  
  /**
   * Process RPC URL with environment variables
   * @param url The RPC URL template
   * @returns Processed RPC URL
   */
  private processRpcUrl(url: string): string {
    // Replace ${INFURA_ID} with actual API key
    if (url.includes('${INFURA_ID}')) {
      const infuraId = process.env.NEXT_PUBLIC_INFURA_ID || '';
      if (!infuraId) {
        console.warn('NEXT_PUBLIC_INFURA_ID not set, RPC URL may not work correctly');
      }
      return url.replace('${INFURA_ID}', infuraId);
    }
    return url;
  }
  
  /**
   * Check if we need to rate limit API calls
   * @returns Whether to proceed with the call
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastCallTimestamp > RATE_LIMIT.callWindow) {
      this.callCounter = 0;
      this.lastCallTimestamp = now;
    }
    
    // Check if we've exceeded rate limit
    if (this.callCounter >= RATE_LIMIT.callsPerMinute) {
      return false;
    }
    
    // Increment counter and update timestamp
    this.callCounter++;
    this.lastCallTimestamp = now;
    
    return true;
  }
  
  /**
   * Get the balance of an address
   * @param address The address to check
   * @returns Promise resolving to the address balance
   */
  public async getBalance(address: string): Promise<BigNumber> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded, please try again later');
    }
    
    if (!this.validateAddress(address)) {
      throw new Error('Invalid Ethereum address');
    }
    
    try {
      return await this.provider.getBalance(address);
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }
  
  /**
   * Get transactions for an address
   * @param address The address to get transactions for
   * @param options Transaction retrieval options
   * @returns Promise resolving to an array of transactions
   */
  public async getTransactions(
    address: string,
    options: TransactionOptions = {}
  ): Promise<Transaction[]> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded, please try again later');
    }
    
    if (!this.validateAddress(address)) {
      throw new Error('Invalid Ethereum address');
    }
    
    try {
      // Set defaults for options
      const limit = options.limit || 10;
      const offset = options.offset || 0;
      
      // Get current block for calculating confirmations
      const currentBlock = await this.provider.getBlockNumber();
      
      // Due to ethers.js limitations, we need to use a third-party API
      // or etherscan API to get historical transactions efficiently
      // This is a simplified implementation that gets recent transactions
      
      const transactions: Transaction[] = [];
      
      // For a real implementation, we would use Etherscan, Infura, or another API
      // This approach doesn't work well for accounts with many transactions
      // and should be replaced with a proper indexing service in production
      
      // Get the last few blocks to look for transactions
      const blockCount = 10;
      for (let i = 0; i < blockCount; i++) {
        const blockNumber = currentBlock - i;
        const block = await this.provider.getBlock(blockNumber);
        
        // Filter transactions involving our address
        for (const txHash of block.transactions) {
          const tx = await this.provider.getTransaction(txHash);
          if (tx.from.toLowerCase() === address.toLowerCase() || 
              (tx.to && tx.to.toLowerCase() === address.toLowerCase())) {
            
            // Get receipt to check status
            const receipt = await this.provider.getTransactionReceipt(txHash);
            
            // Create standardized transaction object
            transactions.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to || '',
              value: tx.value.toString(),
              timestamp: block.timestamp,
              blockNumber: tx.blockNumber || 0,
              confirmations: receipt ? currentBlock - receipt.blockNumber : 0,
              status: receipt ? (receipt.status ? 'success' : 'failed') : 'pending'
            });
            
            // Stop if we have enough transactions
            if (transactions.length >= limit + offset) {
              break;
            }
          }
        }
        
        // Stop if we have enough transactions
        if (transactions.length >= limit + offset) {
          break;
        }
      }
      
      // Apply offset and limit
      return transactions.slice(offset, offset + limit);
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  }
  
  /**
   * Validate an Ethereum address
   * @param address The address to validate
   * @returns Whether the address is valid
   */
  public validateAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  }
  
  /**
   * Sign a message with the connected wallet
   * @param message The message to sign
   * @returns Promise resolving to the signature
   */
  public async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }
    
    try {
      return await this.signer.signMessage(message);
    } catch (error) {
      console.error('Error signing message:', error);
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }
  
  /**
   * Recover the address that signed a message
   * @param message The original message that was signed
   * @param signature The signature to verify
   * @returns The address that created the signature
   */
  public getAddressFromSignature(message: string, signature: string): string {
    try {
      return ethers.utils.verifyMessage(message, signature);
    } catch (error) {
      console.error('Error recovering address from signature:', error);
      throw new Error(`Failed to recover address: ${error.message}`);
    }
  }
  
  /**
   * Get the chain ID for this adapter
   * @returns The chain ID
   */
  public getChainId(): number {
    return this.chainId;
  }
  
  /**
   * Get human-readable name of the chain
   * @returns The chain name
   */
  public getChainName(): string {
    return this.networkConfig.name;
  }
  
  /**
   * Get the current connection status
   * @returns The connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }
  
  /**
   * Connect to the chain using browser wallet or fallback methods
   * @param options Optional connection options
   * @returns Promise resolving to the connected address
   */
  public async connect(options: any = {}): Promise<string> {
    try {
      this.connectionStatus = ConnectionStatus.CONNECTING;
      
      // Browser environment with injected provider
      if (typeof window !== 'undefined' && window.ethereum) {
        // Create Web3 provider
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts && accounts.length > 0) {
          this.walletAddress = accounts[0];
          this.signer = this.provider.getSigner();
          
          // Ensure we're on the correct network
          const network = await this.provider.getNetwork();
          if (network.chainId !== this.chainId) {
            // Request network switch
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${this.chainId.toString(16)}` }]
              });
            } catch (switchError) {
              // This error code indicates that the chain has not been added to MetaMask
              if (switchError.code === 4902) {
                // Add the network
                try {
                  await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: `0x${this.chainId.toString(16)}`,
                      chainName: this.networkConfig.name,
                      nativeCurrency: {
                        name: this.networkConfig.symbol,
                        symbol: this.networkConfig.symbol,
                        decimals: this.networkConfig.decimals
                      },
                      rpcUrls: [this.processRpcUrl(this.networkConfig.rpcUrl)],
                      blockExplorerUrls: [this.networkConfig.blockExplorer]
                    }]
                  });
                  
                  // Switch to the network after adding it
                  await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${this.chainId.toString(16)}` }]
                  });
                } catch (addError) {
                  throw new Error(`Could not add or switch to network: ${addError.message}`);
                }
              } else {
                throw new Error(`Could not switch to network: ${switchError.message}`);
              }
            }
          }
          
          // Set up event listeners for account and chain changes
          if (window.ethereum.on) {
            window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
            window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
            window.ethereum.on('disconnect', this.handleDisconnect.bind(this));
          }
          
          this.connectionStatus = ConnectionStatus.CONNECTED;
          return this.walletAddress;
        } else {
          throw new Error('No accounts returned from wallet');
        }
      } else {
        // No injected provider, use RPC provider for read-only operations
        const rpcUrl = this.processRpcUrl(this.networkConfig.rpcUrl);
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        
        // For read-only operations, we don't have a wallet address
        this.walletAddress = null;
        this.signer = null;
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
        
        throw new Error('No web3 provider detected. Please install MetaMask or another wallet.');
      }
    } catch (error) {
      this.connectionStatus = ConnectionStatus.ERROR;
      console.error('Connection error:', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }
  
  /**
   * Handle account changes from the wallet
   * @param accounts New accounts from the wallet
   */
  private async handleAccountsChanged(accounts: string[]): Promise<void> {
    if (accounts.length === 0) {
      // User disconnected their wallet
      await this.disconnect();
    } else {
      // User switched accounts
      this.walletAddress = accounts[0];
      
      // Update signer with new account
      if (this.provider instanceof ethers.providers.Web3Provider) {
        this.signer = this.provider.getSigner();
      }
      
      // Dispatch event for account change
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('evmAccountChanged', {
          detail: { address: this.walletAddress, chainId: this.chainId }
        });
        window.dispatchEvent(event);
      }
    }
  }
  
  /**
   * Handle chain changes from the wallet
   * @param chainIdHex New chain ID in hex format
   */
  private async handleChainChanged(chainIdHex: string): Promise<void> {
    // Convert hex chain ID to number
    const newChainId = parseInt(chainIdHex, 16);
    
    // Update chain ID and network config
    this.chainId = newChainId;
    this.networkConfig = EVM_NETWORKS[newChainId] || {
      name: `Chain ${newChainId}`,
      rpcUrl: '',
      blockExplorer: '',
      symbol: 'ETH',
      decimals: 18,
      logo: '/assets/networks/ethereum.svg'
    };
    
    // Reinitialize provider
    this.initializeProvider();
    
    // Update signer with new provider
    if (this.provider instanceof ethers.providers.Web3Provider && this.walletAddress) {
      this.signer = this.provider.getSigner();
    }
    
    // Dispatch event for chain change
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('evmChainChanged', {
        detail: { chainId: this.chainId, address: this.walletAddress }
      });
      window.dispatchEvent(event);
    }
  }
  
  /**
   * Handle disconnect events from the wallet
   */
  private async handleDisconnect(): Promise<void> {
    await this.disconnect();
  }
  
  /**
   * Disconnect from the chain
   * @returns Promise that resolves when disconnected
   */
  public async disconnect(): Promise<void> {
    // Remove event listeners
    if (typeof window !== 'undefined' && window.ethereum && window.ethereum.removeListener) {
      window.ethereum.removeListener('accountsChanged', this.handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', this.handleChainChanged);
      window.ethereum.removeListener('disconnect', this.handleDisconnect);
    }
    
    // Clear wallet state
    this.walletAddress = null;
    this.signer = null;
    this.connectionStatus = ConnectionStatus.DISCONNECTED;
    
    // Dispatch event for disconnect
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('evmDisconnected', {
        detail: { chainId: this.chainId }
      });
      window.dispatchEvent(event);
    }
  }
  
  /**
   * Check if the adapter is ready to use
   * @returns Whether the adapter is ready
   */
  public isReady(): boolean {
    return this.provider !== null;
  }
}