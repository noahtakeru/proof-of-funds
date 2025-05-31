/**
 * Chain Adapter Registry
 * 
 * This module provides a central registry for managing chain adapters.
 * It allows the application to easily access different blockchain adapters
 * through a consistent API.
 */
import { ChainAdapter, ConnectionStatus } from './ChainAdapter';
import { EVMChainAdapter, EVM_NETWORKS } from './EVMChainAdapter';
import { SolanaChainAdapter } from './SolanaChainAdapter';
import { BitcoinChainAdapter } from './BitcoinChainAdapter';

/**
 * Registry of supported chain types
 */
export enum ChainType {
  EVM = 'evm',
  SOLANA = 'solana',
  BITCOIN = 'bitcoin'
}

/**
 * Chain network information
 */
export interface ChainNetwork {
  chainId: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  logoUrl: string;
  testnet?: boolean;
  type: ChainType;
}

/**
 * Registry for managing and accessing chain adapters
 */
export class ChainAdapterRegistry {
  private static instance: ChainAdapterRegistry;
  private adapters: Map<string, ChainAdapter> = new Map();
  private supportedNetworks: ChainNetwork[] = [];
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.initializeSupportedNetworks();
  }
  
  /**
   * Get the singleton instance
   * @returns The ChainAdapterRegistry instance
   */
  public static getInstance(): ChainAdapterRegistry {
    if (!ChainAdapterRegistry.instance) {
      ChainAdapterRegistry.instance = new ChainAdapterRegistry();
    }
    return ChainAdapterRegistry.instance;
  }
  
  /**
   * Initialize the list of supported networks
   */
  private initializeSupportedNetworks(): void {
    // Add EVM networks
    for (const [chainIdStr, network] of Object.entries(EVM_NETWORKS)) {
      const chainId = parseInt(chainIdStr, 10);
      this.supportedNetworks.push({
        chainId,
        name: network.name,
        nativeCurrency: {
          name: network.symbol,
          symbol: network.symbol,
          decimals: network.decimals
        },
        rpcUrls: [network.rpcUrl],
        blockExplorerUrls: [network.blockExplorer],
        logoUrl: network.logo,
        testnet: network.testnet || false,
        type: ChainType.EVM
      });
    }
    
    // Add Solana networks (placeholder for future implementation)
    this.supportedNetworks.push({
      chainId: 999, // Placeholder
      name: 'Solana',
      nativeCurrency: {
        name: 'SOL',
        symbol: 'SOL',
        decimals: 9
      },
      rpcUrls: ['https://api.mainnet-beta.solana.com'],
      blockExplorerUrls: ['https://explorer.solana.com'],
      logoUrl: '/assets/networks/solana.svg',
      type: ChainType.SOLANA
    });
    
    // Add Bitcoin (placeholder for future implementation)
    this.supportedNetworks.push({
      chainId: 0, // Placeholder
      name: 'Bitcoin',
      nativeCurrency: {
        name: 'Bitcoin',
        symbol: 'BTC',
        decimals: 8
      },
      rpcUrls: [],
      blockExplorerUrls: ['https://blockstream.info'],
      logoUrl: '/assets/networks/bitcoin.svg',
      type: ChainType.BITCOIN
    });
  }
  
  /**
   * Get a list of supported networks
   * @param options Optional filter options
   * @returns Array of supported networks
   */
  public getSupportedNetworks(options: { 
    testnet?: boolean,
    type?: ChainType
  } = {}): ChainNetwork[] {
    let networks = [...this.supportedNetworks];
    
    // Filter by testnet status if specified
    if (options.testnet !== undefined) {
      networks = networks.filter(network => network.testnet === options.testnet);
    }
    
    // Filter by chain type if specified
    if (options.type !== undefined) {
      networks = networks.filter(network => network.type === options.type);
    }
    
    return networks;
  }
  
  /**
   * Get or create a chain adapter for the specified chain ID
   * @param chainId The chain ID
   * @returns The chain adapter
   */
  public getAdapter(chainId: number): ChainAdapter {
    const adapterKey = `chain-${chainId}`;
    
    if (this.adapters.has(adapterKey)) {
      return this.adapters.get(adapterKey)!;
    }
    
    // Create a new adapter based on chain type
    const networkInfo = this.supportedNetworks.find(network => network.chainId === chainId);
    
    if (!networkInfo) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    let adapter: ChainAdapter;
    
    switch (networkInfo.type) {
      case ChainType.EVM:
        adapter = new EVMChainAdapter(chainId);
        break;
      case ChainType.SOLANA:
        adapter = new SolanaChainAdapter();
        break;
      case ChainType.BITCOIN:
        adapter = new BitcoinChainAdapter();
        break;
      default:
        throw new Error(`Unsupported chain type: ${networkInfo.type}`);
    }
    
    this.adapters.set(adapterKey, adapter);
    return adapter;
  }
  
  /**
   * Get a chain adapter by type and optional chain ID
   * @param type The chain type
   * @param chainId Optional chain ID (uses default for type if not specified)
   * @returns The chain adapter
   */
  public getAdapterByType(type: ChainType, chainId?: number): ChainAdapter {
    // If chain ID is provided, try to get that specific adapter
    if (chainId !== undefined) {
      const networkInfo = this.supportedNetworks.find(
        network => network.chainId === chainId && network.type === type
      );
      
      if (networkInfo) {
        return this.getAdapter(chainId);
      }
    }
    
    // Otherwise get the default chain for this type
    const defaultNetwork = this.supportedNetworks.find(
      network => network.type === type && !network.testnet
    );
    
    if (!defaultNetwork) {
      throw new Error(`No default network found for chain type: ${type}`);
    }
    
    return this.getAdapter(defaultNetwork.chainId);
  }
  
  /**
   * Get all currently connected adapters
   * @returns Array of connected adapters
   */
  public getConnectedAdapters(): ChainAdapter[] {
    return Array.from(this.adapters.values()).filter(
      adapter => adapter.getConnectionStatus() === ConnectionStatus.CONNECTED
    );
  }
  
  /**
   * Disconnect all adapters
   */
  public async disconnectAll(): Promise<void> {
    const promises = Array.from(this.adapters.values()).map(adapter => adapter.disconnect());
    await Promise.all(promises);
  }
}