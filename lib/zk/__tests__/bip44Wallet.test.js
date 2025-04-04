/**
 * BIP44 Wallet Derivation Tests
 * 
 * This file contains tests for the BIP44 wallet functionality in walletHelpers.js
 * to ensure correct derivation paths and wallet generation.
 */

// Import the functions to test
import { 
  getBIP44Path, 
  deriveWalletFromMnemonic, 
  generateTemporaryWallet 
} from '../../walletHelpers.js';

// Test mnemonic for deterministic tests
// WARNING: This is only for testing - never use this mnemonic in production!
const TEST_MNEMONIC = 'test test test test test test test test test test test junk';

describe('BIP44 Wallet Functions', () => {
  // Test path generation
  describe('getBIP44Path', () => {
    test('should generate correct Ethereum path', () => {
      const path = getBIP44Path('ethereum', 0);
      expect(path).toBe("m/44'/60'/0'/0/0");
    });
    
    test('should generate correct Polygon path', () => {
      const path = getBIP44Path('polygon', 1);
      expect(path).toBe("m/44'/60'/0'/0/1");
    });
    
    test('should generate correct Solana path', () => {
      const path = getBIP44Path('solana', 0);
      expect(path).toBe("m/44'/501'/0'/0/0");
    });
    
    test('should use Ethereum as default for unknown chains', () => {
      const path = getBIP44Path('unknown_chain', 0);
      expect(path).toBe("m/44'/60'/0'/0/0");
    });
    
    test('should handle different account numbers', () => {
      const path = getBIP44Path('ethereum', 0, 1);
      expect(path).toBe("m/44'/60'/1'/0/0");
    });
  });
  
  // Test wallet derivation
  describe('deriveWalletFromMnemonic', () => {
    test('should derive deterministic wallets from mnemonic', async () => {
      // First wallet at m/44'/60'/0'/0/0
      const wallet0 = await deriveWalletFromMnemonic(
        TEST_MNEMONIC, 
        "m/44'/60'/0'/0/0"
      );
      
      // Second wallet at m/44'/60'/0'/0/1
      const wallet1 = await deriveWalletFromMnemonic(
        TEST_MNEMONIC, 
        "m/44'/60'/0'/0/1"
      );
      
      // Verify we got different addresses
      expect(wallet0.address).not.toBe(wallet1.address);
      
      // Verify addresses are in correct format
      expect(wallet0.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet1.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      
      // Verify private keys are in correct format
      expect(wallet0.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(wallet1.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
    
    test('should always derive the same wallet from the same path', async () => {
      // Derive the same wallet twice
      const wallet1 = await deriveWalletFromMnemonic(
        TEST_MNEMONIC, 
        "m/44'/60'/0'/0/0"
      );
      
      const wallet2 = await deriveWalletFromMnemonic(
        TEST_MNEMONIC, 
        "m/44'/60'/0'/0/0"
      );
      
      // Should get identical results
      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet1.privateKey).toBe(wallet2.privateKey);
    });
  });
  
  // Test temporary wallet generation
  describe('generateTemporaryWallet', () => {
    test('should generate a wallet with correct structure', async () => {
      const wallet = await generateTemporaryWallet({
        chain: 'polygon',
        index: 0,
        mnemonic: TEST_MNEMONIC
      });
      
      // Check wallet structure
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet).toHaveProperty('path');
      expect(wallet).toHaveProperty('chain');
      expect(wallet).toHaveProperty('index');
      
      // Verify path is correct
      expect(wallet.path).toBe("m/44'/60'/0'/0/0");
      
      // Verify chain is correct
      expect(wallet.chain).toBe('polygon');
      
      // Verify index is correct
      expect(wallet.index).toBe(0);
    });
    
    test('should generate new wallet with each call unless mnemonic provided', async () => {
      // Generate two wallets without specifying mnemonic
      const wallet1 = await generateTemporaryWallet();
      const wallet2 = await generateTemporaryWallet();
      
      // Should get different wallets
      expect(wallet1.address).not.toBe(wallet2.address);
    });
    
    test('should use provided options', async () => {
      const wallet = await generateTemporaryWallet({
        chain: 'solana',
        index: 5,
        mnemonic: TEST_MNEMONIC
      });
      
      // Verify chain is correct
      expect(wallet.chain).toBe('solana');
      
      // Verify index is correct
      expect(wallet.index).toBe(5);
      
      // Verify path is correct for Solana
      expect(wallet.path).toBe("m/44'/501'/0'/0/5");
    });
    
    test('should use default options if none provided', async () => {
      const wallet = await generateTemporaryWallet({
        mnemonic: TEST_MNEMONIC // Only provide mnemonic for deterministic test
      });
      
      // Verify chain is default (polygon)
      expect(wallet.chain).toBe('polygon');
      
      // Verify index is default (0)
      expect(wallet.index).toBe(0);
      
      // Verify path is correct
      expect(wallet.path).toBe("m/44'/60'/0'/0/0");
    });
  });
});