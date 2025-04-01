// Define mock implementations before imports
jest.mock('../../services/gcpSecretManager', () => {
  let callCount = 0;
  return {
    getMasterSeed: jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('GCP not available in test'));
      }
      return Promise.resolve('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    })
  };
});

jest.mock('../zkProofGenerator', () => {
  return {
    createTemporaryWallet: jest.fn().mockImplementation((seed, purpose) => {
      return Promise.resolve({
        address: `0x${purpose.slice(0, 8).padEnd(8, '0')}1234567890abcdef`,
        privateKey: `0xprivate${purpose.slice(0, 6)}`,
        derivationPath: `m/44'/60'/0'/0/${purpose.length % 1000}`,
        purpose
      });
    })
  };
});

jest.mock('../../walletHelpers/bip44', () => ({
  generateDerivationPath: jest.fn().mockReturnValue('m/44\'/60\'/0\'/0/123'),
  deriveWalletFromMnemonic: jest.fn().mockReturnValue({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    privateKey: '0xprivatekey123'
  }),
  storeDerivedWallet: jest.fn(),
  getDerivedWallet: jest.fn().mockImplementation((address) => {
    return {
      address,
      privateKey: '0xprivatekey123',
      derivationPath: 'm/44\'/60\'/0\'/0/123',
      createdAt: Date.now() - 10000
    };
  }),
  listTemporaryWallets: jest.fn().mockImplementation(() => [
    {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      derivationPath: 'm/44\'/60\'/0\'/0/123',
      purpose: 'test-purpose',
      createdAt: Date.now() - 10000
    },
    {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      derivationPath: 'm/44\'/60\'/0\'/0/456',
      purpose: 'other-purpose',
      createdAt: Date.now() - 86400000 // 1 day old
    }
  ]),
  archiveWallet: jest.fn().mockResolvedValue(true)
}));

jest.mock('ethers', () => ({
  ethers: {
    Wallet: {
      createRandom: jest.fn().mockReturnValue({
        mnemonic: { phrase: 'test test test test test test test test test test test junk' },
        address: '0xmockedaddress',
        privateKey: '0xmockedprivatekey'
      })
    },
    utils: {
      HDNode: {
        fromSeed: jest.fn().mockReturnValue({
          derivePath: jest.fn().mockReturnValue({
            address: '0x1234567890abcdef1234567890abcdef12345678',
            privateKey: '0xprivatekey123'
          })
        })
      },
      arrayify: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      keccak256: jest.fn().mockReturnValue('0xmockhash'),
      toUtf8Bytes: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      parseEther: jest.fn().mockImplementation(val => val + '000000000000000000'),
      formatEther: jest.fn().mockImplementation(val => val.toString().replace('000000000000000000', ''))
    },
    providers: {
      Web3Provider: jest.fn().mockImplementation(() => ({
        getSigner: jest.fn().mockReturnValue({
          sendTransaction: jest.fn().mockResolvedValue({
            hash: '0xmocktxhash',
            wait: jest.fn().mockResolvedValue({})
          })
        }),
        getBalance: jest.fn().mockResolvedValue('1000000000000000000')
      }))
    }
  }
}));

// Mock window for ethers
global.window = {
  ethereum: {
    request: jest.fn()
  }
};

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

// Apply localStorage mock
global.localStorage = localStorageMock;

// Now import the module under test
import {
  generateMasterSeed,
  createTemporaryWalletForPurpose,
  getTemporaryWalletByPurpose,
  getAllTemporaryWallets,
  cleanupOldTemporaryWallets
} from '../tempWalletManager';

// Set up the test suite
describe('Temporary Wallet Manager', () => {
  beforeEach(() => {
    // Clear mock calls before each test
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Reset the mock implementation for getMasterSeed
    const getMasterSeed = require('../../services/gcpSecretManager').getMasterSeed;
    let callCount = 0;
    getMasterSeed.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('GCP not available in test'));
      }
      return Promise.resolve('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    });
  });

  test('generates master seed with fallback if GCP fails', async () => {
    // First call should fail and use fallback
    const seed1 = await generateMasterSeed();
    expect(seed1).toBeTruthy();
    expect(typeof seed1).toBe('string');
    
    // Reset mock to test happy path
    jest.clearAllMocks();
    
    // Second call should succeed directly (mocked in jest.mock implementation)
    const seed2 = await generateMasterSeed();
    expect(seed2).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
  });

  test('creates temporary wallet for a specific purpose', async () => {
    const masterSeed = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const purposeId = 'test-purpose';
    const metadata = { testKey: 'testValue' };
    
    // Create the wallet
    const wallet = await createTemporaryWalletForPurpose(masterSeed, purposeId, metadata);
    
    // Verify wallet structure
    expect(wallet).toHaveProperty('address');
    expect(wallet).toHaveProperty('privateKey');
    expect(wallet).toHaveProperty('derivationPath');
    expect(wallet).toHaveProperty('createdAt');
    expect(wallet).toHaveProperty('status', 'active');
    expect(wallet).toHaveProperty('metadata', metadata);
    
    // Create another wallet with the same purpose - should get the cached one
    const wallet2 = await createTemporaryWalletForPurpose(masterSeed, purposeId, metadata);
    expect(wallet2).toHaveProperty('address', wallet.address);
  });

  test('retrieves temporary wallet by purpose', async () => {
    const masterSeed = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const purposeId = 'retrieval-test';
    const metadata = { retrievalTest: true };
    
    // Create a wallet
    const createdWallet = await createTemporaryWalletForPurpose(masterSeed, purposeId, metadata);
    
    // Retrieve the wallet
    const retrievedWallet = getTemporaryWalletByPurpose(purposeId, metadata);
    
    // Should have the same address
    expect(retrievedWallet).toHaveProperty('address', createdWallet.address);
    
    // Try to retrieve a non-existent wallet
    const nonExistentWallet = getTemporaryWalletByPurpose('does-not-exist');
    expect(nonExistentWallet).toBeNull();
  });

  test('gets all temporary wallets', async () => {
    const masterSeed = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    // Create multiple wallets with different purposes
    await createTemporaryWalletForPurpose(masterSeed, 'purpose1', { test: 1 });
    await createTemporaryWalletForPurpose(masterSeed, 'purpose2', { test: 2 });
    await createTemporaryWalletForPurpose(masterSeed, 'purpose3', { test: 3 });
    
    // Get all wallets
    const allWallets = getAllTemporaryWallets();
    
    // Should have at least 3 wallets
    expect(allWallets.length).toBeGreaterThanOrEqual(3);
    
    // All should have status 'active'
    const activeWallets = getAllTemporaryWallets('active');
    expect(activeWallets.length).toBeGreaterThanOrEqual(3);
    
    // Check wallet structure
    expect(activeWallets[0]).toHaveProperty('address');
    expect(activeWallets[0]).toHaveProperty('privateKey');
  });

  test('cleans up old temporary wallets', async () => {
    const masterSeed = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    // Create wallets with different timestamps
    const wallet1 = await createTemporaryWalletForPurpose(masterSeed, 'fresh-wallet', { test: 1 });
    const wallet2 = await createTemporaryWalletForPurpose(masterSeed, 'old-wallet', { test: 2 });
    
    // Manually set the creation time for the second wallet to be old
    wallet2.createdAt = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    wallet2.status = 'archived'; // Only non-active wallets are cleaned up
    
    // Clean up wallets older than 24 hours
    const cleanedCount = cleanupOldTemporaryWallets(24 * 60 * 60 * 1000);
    
    // Should have cleaned up one wallet
    expect(cleanedCount).toBe(1);
    
    // Should still have the fresh wallet
    const remainingWallets = getAllTemporaryWallets();
    expect(remainingWallets.some(w => w.address === wallet1.address)).toBe(true);
    expect(remainingWallets.some(w => w.address === wallet2.address)).toBe(false);
  });
});