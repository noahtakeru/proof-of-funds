/**
 * @jest-environment node
 * @jest-global describe
 * @jest-global test
 * @jest-global expect
 * @jest-global beforeEach
 * @jest-global jest
 */

import { ethers } from 'ethers';
import {
  ContractInterface,
  AbiVersionManager,
  ContractAddressRegistry,
  ZKVerifierContract,
  ProofOfFundsContract,
  ProofType
} from '../src/contracts/index.js';

// Mock provider for testing
class MockProvider {
  constructor() {
    this.blockNumber = 1000000;
    this.gasPrice = ethers.utils.parseUnits('50', 'gwei');
    this.code = '0x0123456789abcdef'; // Non-empty code indicates contract exists
  }

  async getBlockNumber() {
    return this.blockNumber;
  }

  async getGasPrice() {
    return this.gasPrice;
  }

  async getCode(address) {
    return this.code;
  }
}

// Mock contract for testing
class MockContract {
  constructor(address, mockInterface) {
    this.address = address;
    this.interface = mockInterface || new ethers.utils.Interface([
      'function verifyProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input) returns (bool)',
      'function getVerificationKey(string) returns (string)',
      'function verifyProofLocally(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input) returns (bool)',
      'function verifiedProofs(bytes32) returns (bool)'
    ]);

    // Mock contract functions
    this.verifyProof = jest.fn().mockResolvedValue(true);
    this.getVerificationKey = jest.fn().mockResolvedValue('0x123456');
    this.verifyProofLocally = jest.fn().mockResolvedValue(true);
    this.verifiedProofs = jest.fn().mockResolvedValue(true);
    this.setVerificationKey = jest.fn().mockResolvedValue({
      hash: '0xabcdef',
      wait: jest.fn().mockResolvedValue({ status: 1 })
    });

    // ProofOfFunds specific functions
    this.submitProof = jest.fn().mockResolvedValue({
      hash: '0xabcdef',
      wait: jest.fn().mockResolvedValue({
        status: 1,
        logs: [
          {
            topics: [
              ethers.utils.id('ProofSubmitted(bytes32,address,uint8,bool)'),
              ethers.utils.hexZeroPad('0x123456', 32)
            ],
            data: ethers.utils.defaultAbiCoder.encode(
              ['address', 'uint8', 'bool'],
              ['0x1234567890123456789012345678901234567890', 1, true]
            )
          }
        ]
      })
    });
    this.submitProofBatch = jest.fn().mockResolvedValue({
      hash: '0xabcdef',
      wait: jest.fn().mockResolvedValue({
        status: 1,
        logs: [
          {
            topics: [
              ethers.utils.id('ProofSubmitted(bytes32,address,uint8,bool)'),
              ethers.utils.hexZeroPad('0x123456', 32)
            ],
            data: ethers.utils.defaultAbiCoder.encode(
              ['address', 'uint8', 'bool'],
              ['0x1234567890123456789012345678901234567890', 1, true]
            )
          }
        ]
      })
    });
    this.getProofInfo = jest.fn().mockResolvedValue([
      true, 2, Math.floor(Date.now() / 1000), '0x1234567890123456789012345678901234567890', 1
    ]);
    this.getLatestProofForWallet = jest.fn().mockResolvedValue('0x123456');
    this.getAllProofsForWallet = jest.fn().mockResolvedValue(['0x123456', '0x789abc']);

    // Mock estimateGas
    this.estimateGas = {
      verifyProof: jest.fn().mockResolvedValue(ethers.BigNumber.from(150000)),
      submitProof: jest.fn().mockResolvedValue(ethers.BigNumber.from(250000))
    };
  }

  // Mock connection methods
  connect(signer) {
    this.signer = signer;
    return this;
  }
}

// Mock ContractInterface implementation for testing
class TestContractInterface extends ContractInterface {
  constructor(provider, signer, contractName, chainId) {
    super(provider, signer, contractName, chainId);

    // Override contract initialization
    this.contract = new MockContract('0x1234567890123456789012345678901234567890');
  }

  // Expose protected methods for testing
  testCall(method, ...args) {
    return this.call(method, ...args);
  }

  testSendTransaction(method, options, ...args) {
    return this.sendTransaction(method, options, ...args);
  }
}

// Sample proof data for testing
const sampleProofData = {
  proof: {
    a: ['123456789', '987654321'],
    b: [['123456789', '987654321'], ['123456789', '987654321']],
    c: ['123456789', '987654321']
  },
  publicSignals: ['123456789', '987654321']
};

describe('Contract Interfaces', () => {
  let mockProvider;
  let mockSigner;

  beforeEach(() => {
    mockProvider = new MockProvider();
    mockSigner = ethers.Wallet.createRandom().connect(mockProvider);
  });

  describe('ContractInterface', () => {
    let contractInterface;

    beforeEach(() => {
      contractInterface = new TestContractInterface(
        mockProvider,
        mockSigner,
        'TestContract',
        1 // Ethereum Mainnet
      );
    });

    test('should initialize with provider and signer', () => {
      expect(contractInterface).toBeDefined();
      expect(contractInterface.provider).toBe(mockProvider);
    });

    test('should allow connecting a signer', () => {
      const newSigner = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890456');
      newSigner.provider = mockProvider;

      const result = contractInterface.connect(newSigner);

      expect(result).toBe(contractInterface); // Should return this for chaining
    });

    test('should check if contract exists', async () => {
      const exists = await contractInterface.contractExists();
      expect(exists).toBe(true);

      // Test non-existent contract
      mockProvider.code = '0x';
      const notExists = await contractInterface.contractExists();
      expect(notExists).toBe(false);
    });

    test('should handle contract call correctly', async () => {
      const result = await contractInterface.testCall('verifyProofLocally', 1, 2, 3);
      expect(result).toBe(true);
    });

    test('should handle transaction sending correctly', async () => {
      const options = {
        gasLimit: ethers.BigNumber.from(200000),
        waitForConfirmation: true
      };

      const result = await contractInterface.testSendTransaction('verifyProof', options, 1, 2, 3);

      expect(result).toHaveProperty('transactionHash');
      expect(result).toHaveProperty('transaction');
    });
  });

  describe('AbiVersionManager', () => {
    test('should load contract ABIs', () => {
      const manager = new AbiVersionManager('ProofOfFunds');
      expect(manager).toBeDefined();

      const version = manager.getCurrentVersion();
      expect(version).toBeDefined();

      const abi = manager.getCurrentAbi();
      expect(Array.isArray(abi)).toBe(true);
    });

    test('should handle version selection', () => {
      const manager = new AbiVersionManager('ProofOfFunds');
      const versions = manager.getAvailableVersions();

      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBeGreaterThan(0);

      if (versions.length > 0) {
        const version = versions[0];
        manager.setCurrentVersion(version);
        expect(manager.getCurrentVersion()).toBe(version);

        const abi = manager.getAbi(version);
        expect(Array.isArray(abi)).toBe(true);
      }
    });

    test('should check chain compatibility', () => {
      const manager = new AbiVersionManager('ProofOfFunds');
      const versions = manager.getAvailableVersions();

      if (versions.length > 0) {
        const version = versions[0];
        const isCompatible = manager.isVersionCompatibleWithChain(version, 1);
        expect(typeof isCompatible).toBe('boolean');

        const chainVersions = manager.getVersionsForChain(1);
        expect(Array.isArray(chainVersions)).toBe(true);
      }
    });
  });

  describe('ContractAddressRegistry', () => {
    let registry;

    beforeEach(() => {
      registry = new ContractAddressRegistry();
    });

    test('should initialize with default deployments', () => {
      expect(registry).toBeDefined();
      const contractNames = registry.getContractNames();
      expect(Array.isArray(contractNames)).toBe(true);
    });

    test('should allow adding new deployments', () => {
      registry.addDeployment(
        'TestContract',
        1,
        '0x1234567890123456789012345678901234567890',
        12345678,
        '0x1234567890123456789012345678901234567890',
        undefined,
        '1.0.0'
      );

      const address = registry.getAddress('TestContract', 1);
      expect(address).toBe('0x1234567890123456789012345678901234567890');

      const deployments = registry.getAllDeployments('TestContract', 1);
      expect(deployments.length).toBeGreaterThan(0);

      const chains = registry.getDeployedChains('TestContract');
      expect(chains).toContain(1);
    });

    test('should support chain information', () => {
      const supportedChains = registry.getSupportedChains();
      expect(Array.isArray(supportedChains)).toBe(true);
      expect(supportedChains.length).toBeGreaterThan(0);

      if (supportedChains.length > 0) {
        const chainId = supportedChains[0];
        const chainInfo = registry.getChainInfo(chainId);
        expect(chainInfo).toHaveProperty('name');
        expect(chainInfo).toHaveProperty('rpcUrls');
        expect(chainInfo).toHaveProperty('nativeCurrency');
      }

      expect(registry.isChainSupported(1)).toBe(true);
      expect(registry.isChainSupported(999999)).toBe(false);
    });

    test('should allow adding new chain support', () => {
      const chainConfig = {
        name: 'Test Chain',
        rpcUrls: ['https://testchain.io/rpc'],
        blockExplorerUrls: ['https://testchain.io/explorer'],
        nativeCurrency: {
          name: 'Test Coin',
          symbol: 'TEST',
          decimals: 18
        }
      };

      registry.addChainSupport(12345, chainConfig);

      expect(registry.isChainSupported(12345)).toBe(true);
      expect(registry.getChainInfo(12345)).toEqual(chainConfig);
    });
  });

  describe('ZKVerifierContract', () => {
    let zkVerifier;

    beforeEach(() => {
      zkVerifier = new ZKVerifierContract(
        mockProvider,
        mockSigner,
        1 // Ethereum Mainnet
      );

      // Override the contract for testing
      zkVerifier.contract = new MockContract('0x1234567890123456789012345678901234567890');
    });

    test('should verify proof on-chain', async () => {
      const result = await zkVerifier.verifyProof(sampleProofData);

      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('transactionHash');
      expect(result).toHaveProperty('proofId');
    });

    test('should verify proof locally', async () => {
      const result = await zkVerifier.verifyProofLocally(sampleProofData);

      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('verificationMethod', 'local');
      expect(result).toHaveProperty('proofId');
    });

    test('should get verification key', async () => {
      const key = await zkVerifier.getVerificationKey('standard');
      expect(key).toBe('0x123456');
    });

    test('should set verification key', async () => {
      const tx = await zkVerifier.setVerificationKey('standard', '0x654321');
      expect(tx).toHaveProperty('hash', '0xabcdef');
    });

    test('should check if proof is verified', async () => {
      const isVerified = await zkVerifier.isProofVerified('0x123456');
      expect(isVerified).toBe(true);
    });
  });

  describe('ProofOfFundsContract', () => {
    let pofContract;

    beforeEach(() => {
      pofContract = new ProofOfFundsContract(
        mockProvider,
        mockSigner,
        1 // Ethereum Mainnet
      );

      // Override the contract for testing
      pofContract.contract = new MockContract('0x1234567890123456789012345678901234567890');
    });

    test('should submit proof', async () => {
      const result = await pofContract.submitProof(
        sampleProofData,
        ProofType.Standard,
        '0x1234567890123456789012345678901234567890'
      );

      expect(result).toHaveProperty('proofId');
      expect(result).toHaveProperty('transactionHash');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('walletAddress');
      expect(result).toHaveProperty('proofType', ProofType.Standard);
    });

    test('should verify proof locally', async () => {
      const result = await pofContract.verifyProofLocally(
        sampleProofData,
        ProofType.Standard,
        '0x1234567890123456789012345678901234567890'
      );

      expect(result).toHaveProperty('isVerified', true);
      expect(result).toHaveProperty('verificationMethod', 'local');
      expect(result).toHaveProperty('proofId');
    });

    test('should submit proof batch', async () => {
      const results = await pofContract.submitProofBatch([
        {
          proofData: sampleProofData,
          proofType: ProofType.Standard,
          walletAddress: '0x1234567890123456789012345678901234567890'
        },
        {
          proofData: sampleProofData,
          proofType: ProofType.Threshold,
          walletAddress: '0x1234567890123456789012345678901234567890'
        }
      ]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0]).toHaveProperty('proofId');
      expect(results[0]).toHaveProperty('transactionHash');
      expect(results[0]).toHaveProperty('batchIndex', 0);
      expect(results[1]).toHaveProperty('batchIndex', 1);
    });

    test('should get proof info', async () => {
      const info = await pofContract.getProofInfo('0x123456');

      expect(info).toHaveProperty('exists', true);
      expect(info).toHaveProperty('status');
      expect(info).toHaveProperty('timestamp');
      expect(info).toHaveProperty('walletAddress');
      expect(info).toHaveProperty('proofType');
    });

    test('should get latest proof for wallet', async () => {
      const proofId = await pofContract.getLatestProofForWallet(
        '0x1234567890123456789012345678901234567890'
      );

      expect(proofId).toBe('0x123456');
    });

    test('should get all proofs for wallet', async () => {
      const proofIds = await pofContract.getAllProofsForWallet(
        '0x1234567890123456789012345678901234567890'
      );

      expect(Array.isArray(proofIds)).toBe(true);
      expect(proofIds.length).toBe(2);
      expect(proofIds[0]).toBe('0x123456');
      expect(proofIds[1]).toBe('0x789abc');
    });
  });
});