/**
 * Chain Adapter Tests
 * 
 * This file contains tests for the Chain Adapter implementation.
 */
const { describe, it, expect } = require('@jest/globals');
const { ethers } = require('ethers');

// Import the chain adapters
const { 
  ChainType,
  EVMChainAdapter 
} = require('../utils/chains');

describe('Chain Adapters', () => {
  describe('EVMChainAdapter', () => {
    it('should initialize with default chain ID', () => {
      const adapter = new EVMChainAdapter();
      expect(adapter.getChainId()).toBe(1); // Ethereum Mainnet
    });
    
    it('should initialize with custom chain ID', () => {
      const adapter = new EVMChainAdapter(137); // Polygon
      expect(adapter.getChainId()).toBe(137);
      expect(adapter.getChainName()).toBe('Polygon');
    });
    
    it('should validate Ethereum addresses', () => {
      const adapter = new EVMChainAdapter();
      
      // Valid address
      expect(adapter.validateAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe(true);
      
      // Invalid addresses
      expect(adapter.validateAddress('not-an-address')).toBe(false);
      expect(adapter.validateAddress('0x1234')).toBe(false);
      expect(adapter.validateAddress('')).toBe(false);
    });
    
    it('should recover address from signature', () => {
      const adapter = new EVMChainAdapter();
      
      // Sample message and signature (created with ethers.js)
      const message = 'Hello, blockchain!';
      const wallet = ethers.Wallet.createRandom();
      const messageHash = ethers.utils.hashMessage(message);
      const signature = wallet.signMessage(message);
      
      // Recover address (synchronous in ethers.js v5)
      const recoveredAddress = adapter.getAddressFromSignature(message, signature);
      
      // Address should match the original wallet
      expect(recoveredAddress.toLowerCase()).toBe(wallet.address.toLowerCase());
    });
  });
  
  describe('ChainAdapterRegistry', () => {
    // Import after the adapter tests to avoid circular dependencies
    const chainRegistry = require('../utils/chains').default;
    
    it('should return supported networks', () => {
      const networks = chainRegistry.getSupportedNetworks();
      
      // Should have at least Ethereum, Polygon, and placeholders for Solana and Bitcoin
      expect(networks.length).toBeGreaterThanOrEqual(4);
      
      // Check for Ethereum Mainnet
      const ethereum = networks.find(n => n.chainId === 1);
      expect(ethereum).toBeDefined();
      expect(ethereum.name).toBe('Ethereum Mainnet');
      expect(ethereum.type).toBe(ChainType.EVM);
      
      // Check for Polygon
      const polygon = networks.find(n => n.chainId === 137);
      expect(polygon).toBeDefined();
      expect(polygon.name).toBe('Polygon');
      expect(polygon.type).toBe(ChainType.EVM);
    });
    
    it('should filter networks by testnet status', () => {
      const mainnets = chainRegistry.getSupportedNetworks({ testnet: false });
      const testnets = chainRegistry.getSupportedNetworks({ testnet: true });
      
      // Check that they are different sets
      expect(mainnets.length).toBeGreaterThan(0);
      expect(testnets.length).toBeGreaterThan(0);
      expect(mainnets.length + testnets.length).toBe(chainRegistry.getSupportedNetworks().length);
      
      // Verify some specific networks
      expect(mainnets.some(n => n.chainId === 1)).toBe(true); // Ethereum Mainnet
      expect(testnets.some(n => n.chainId === 11155111)).toBe(true); // Sepolia testnet
    });
    
    it('should filter networks by chain type', () => {
      const evmNetworks = chainRegistry.getSupportedNetworks({ type: ChainType.EVM });
      const solanaNetworks = chainRegistry.getSupportedNetworks({ type: ChainType.SOLANA });
      const bitcoinNetworks = chainRegistry.getSupportedNetworks({ type: ChainType.BITCOIN });
      
      // Check that each type has at least one network
      expect(evmNetworks.length).toBeGreaterThan(0);
      expect(solanaNetworks.length).toBe(1);
      expect(bitcoinNetworks.length).toBe(1);
      
      // Check that total matches
      expect(evmNetworks.length + solanaNetworks.length + bitcoinNetworks.length)
        .toBe(chainRegistry.getSupportedNetworks().length);
    });
    
    it('should get adapter by chain ID', () => {
      const ethereumAdapter = chainRegistry.getAdapter(1);
      const polygonAdapter = chainRegistry.getAdapter(137);
      
      expect(ethereumAdapter).toBeDefined();
      expect(ethereumAdapter.getChainId()).toBe(1);
      expect(ethereumAdapter.getChainName()).toBe('Ethereum Mainnet');
      
      expect(polygonAdapter).toBeDefined();
      expect(polygonAdapter.getChainId()).toBe(137);
      expect(polygonAdapter.getChainName()).toBe('Polygon');
    });
    
    it('should get adapter by chain type', () => {
      const evmAdapter = chainRegistry.getAdapterByType(ChainType.EVM);
      
      expect(evmAdapter).toBeDefined();
      expect(evmAdapter.getChainId()).toBe(1); // Default is Ethereum Mainnet
      
      // Should get specific chain within type
      const specificAdapter = chainRegistry.getAdapterByType(ChainType.EVM, 137);
      expect(specificAdapter).toBeDefined();
      expect(specificAdapter.getChainId()).toBe(137);
    });
  });
});