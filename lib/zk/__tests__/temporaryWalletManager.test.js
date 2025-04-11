/**
 * Tests for Temporary Wallet Manager
 * 
 * These tests verify the functionality of the temporary wallet system,
 * including wallet creation, lifecycle management, and security features.
 */

import { jest } from '@jest/globals';
import {
  createTemporaryWallet,
  destroyWallet,
  hasWallet,
  getWalletInfo,
  extendWalletLifetime,
  withWalletPrivateKey,
  destroyAllWallets
} from '../src/temporaryWalletManager.js';

// Mock dependencies to isolate tests
jest.mock('../../ethersUtils.js', () => ({
  getEthers: jest.fn().mockResolvedValue({
    utils: {
      entropyToMnemonic: jest.fn().mockReturnValue('test test test test test test test test test test test junk'),
      defaultAbiCoder: {
        encode: jest.fn().mockReturnValue('0x1234')
      },
      id: jest.fn().mockReturnValue('0x1234'),
      keccak256: jest.fn().mockReturnValue('0x5678')
    },
    Wallet: {
      createRandom: jest.fn().mockReturnValue({
        mnemonic: { phrase: 'test test test test test test test test test test test junk' }
      })
    },
    wordlists: {
      en: {}
    }
  })
}));

jest.mock('../../walletHelpers.js', () => ({
  getBIP44Path: jest.fn().mockImplementation((chain, index) => {
    return `m/44'/60'/0'/0/${index}`;
  }),
  deriveWalletFromMnemonic: jest.fn().mockImplementation(async (mnemonic, path) => {
    // Return deterministic addresses based on path index
    const pathIndex = parseInt(path.split('/').pop(), 10);
    return {
      address: `0x${pathIndex.toString().padStart(40, '0')}`,
      privateKey: `0x${pathIndex.toString().padStart(64, '0')}`
    };
  })
}));

// Mock setTimeout and clearTimeout
jest.useFakeTimers();

describe('Temporary Wallet Manager', () => {
  // Clear state and mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    destroyAllWallets();
  });

  describe('Wallet Creation', () => {
    it('should create a temporary wallet with default options', async () => {
      const wallet = await createTemporaryWallet();

      // Verify wallet structure
      expect(wallet).toBeDefined();
      expect(wallet.address).toBeDefined();
      expect(wallet.chain).toBe('ethereum');
      expect(wallet.path).toBeDefined();
      expect(wallet.creationTime).toBeDefined();
      expect(wallet.expirationTime).toBeDefined();

      // Verify no private data is exposed
      expect(wallet.privateKey).toBeUndefined();
      expect(wallet.mnemonic).toBeUndefined();
    });

    it('should create a wallet with custom chain and index', async () => {
      const wallet = await createTemporaryWallet({
        chain: 'polygon',
        index: 5
      });

      expect(wallet.chain).toBe('polygon');
      expect(wallet.index).toBe(5);
      expect(wallet.address).toBe('0x0000000000000000000000000000000000000005');
    });

    it('should support custom lifetime', async () => {
      const now = Date.now();
      const customLifetime = 60000; // 1 minute

      const wallet = await createTemporaryWallet({
        lifetimeMs: customLifetime
      });

      // Verify expiration time (with small tolerance for test execution time)
      expect(wallet.expirationTime).toBeGreaterThanOrEqual(now + customLifetime - 100);
      expect(wallet.expirationTime).toBeLessThanOrEqual(now + customLifetime + 100);
    });
  });

  describe('Wallet Lifecycle Management', () => {
    it('should allow manual wallet destruction', async () => {
      // Create a wallet
      const wallet = await createTemporaryWallet();

      // Verify it exists
      expect(hasWallet(wallet.address)).toBe(true);

      // Destroy it
      const destroyed = destroyWallet(wallet.address);

      // Verify destruction
      expect(destroyed).toBe(true);
      expect(hasWallet(wallet.address)).toBe(false);
    });

    it('should expire wallets automatically', async () => {
      // Create a wallet with 5 second lifetime
      const wallet = await createTemporaryWallet({
        lifetimeMs: 5000
      });

      // Verify it exists
      expect(hasWallet(wallet.address)).toBe(true);

      // Fast-forward time by 6 seconds
      jest.advanceTimersByTime(6000);

      // Wallet should be destroyed
      expect(hasWallet(wallet.address)).toBe(false);
    });

    it('should call onExpiration callback when wallet expires', async () => {
      const expirationCallback = jest.fn();

      // Create a wallet with callback
      const wallet = await createTemporaryWallet({
        lifetimeMs: 5000,
        onExpiration: expirationCallback
      });

      // Fast-forward time
      jest.advanceTimersByTime(6000);

      // Callback should have been called with address
      expect(expirationCallback).toHaveBeenCalledWith(wallet.address);
    });

    it('should allow wallet lifetime extension', async () => {
      // Create a wallet with 5 second lifetime
      const wallet = await createTemporaryWallet({
        lifetimeMs: 5000
      });

      const originalExpiration = wallet.expirationTime;

      // Extend by 10 seconds
      const extended = extendWalletLifetime(wallet.address, 10000);

      // Verify extension
      expect(extended).toBe(true);

      // Get updated wallet info
      const updatedWallet = getWalletInfo(wallet.address);
      expect(updatedWallet.expirationTime).toBeGreaterThan(originalExpiration);

      // Wallet should still exist after original expiration
      jest.advanceTimersByTime(6000);
      expect(hasWallet(wallet.address)).toBe(true);

      // But should be gone after extended expiration
      jest.advanceTimersByTime(10000);
      expect(hasWallet(wallet.address)).toBe(false);
    });

    it('should support accessing private key via callback', async () => {
      // Create a wallet
      const wallet = await createTemporaryWallet({
        index: 42
      });

      // Access private key via callback
      const signedData = await withWalletPrivateKey(wallet.address, (privateKey) => {
        // Verify private key matches expected format
        expect(privateKey).toBe('0x0000000000000000000000000000000000000000000000000000000000000042');

        // Return fake signed data
        return 'signed_data_example';
      });

      // Verify result from callback
      expect(signedData).toBe('signed_data_example');
    });

    it('should destroy all wallets when requested', async () => {
      // Create multiple wallets
      await createTemporaryWallet({ index: 1 });
      await createTemporaryWallet({ index: 2 });
      await createTemporaryWallet({ index: 3 });

      // Verify all wallets exist
      expect(hasWallet('0x0000000000000000000000000000000000000001')).toBe(true);
      expect(hasWallet('0x0000000000000000000000000000000000000002')).toBe(true);
      expect(hasWallet('0x0000000000000000000000000000000000000003')).toBe(true);

      // Destroy all wallets
      const count = destroyAllWallets();

      // Verify count and that all wallets are gone
      expect(count).toBe(3);
      expect(hasWallet('0x0000000000000000000000000000000000000001')).toBe(false);
      expect(hasWallet('0x0000000000000000000000000000000000000002')).toBe(false);
      expect(hasWallet('0x0000000000000000000000000000000000000003')).toBe(false);
    });
  });

  // More tests can be added here
});