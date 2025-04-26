/**
 * @file AbiVersionManager.ts
 * @description Manages ABI versioning for smart contracts
 * 
 * ---------- MOCK STATUS ----------
 * This file contains the following mock implementations:
 * - CONTRACT_ABIS: Contains placeholder ABI definitions (lines 32-39) that use basic ERC-20 
 *   methods instead of actual contract ABIs.
 * 
 * This mock is documented in MOCKS.md with priority MEDIUM for replacement.
 */

import { ethers } from 'ethers';

/**
 * Interface for contract ABI version data
 */
interface ContractAbiVersion {
  version: string;
  abi: ethers.ContractInterface;
  deployedDate: Date;
  compatibleChains: number[];
  notes?: string;
}

/**
 * Manages multiple versions of contract ABIs
 */
export class AbiVersionManager {
  private contractName: string;
  private versions: Map<string, ContractAbiVersion> = new Map();
  private currentVersion: string;

  // Contract ABIs - for ESM, using hardcoded ABIs instead of dynamic imports for simplicity
  private static readonly CONTRACT_ABIS: Record<string, Record<string, ContractAbiVersion>> = {
    'ProofOfFunds': {
      '1.0.0': {
        version: '1.0.0',
        abi: [
          // Basic ERC-20 methods as placeholder (will be filled with actual ABI in production)
          "function balanceOf(address owner) view returns (uint256)",
          "function transfer(address to, uint256 amount) returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function transferFrom(address from, address to, uint256 amount) returns (bool)",
          "event Transfer(address indexed from, address indexed to, uint256 amount)",
          "event Approval(address indexed owner, address indexed spender, uint256 amount)",
          // ProofOfFunds specific methods
          "function submitProof(uint8 proofType, address walletAddress, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input, bytes additionalData) returns (bytes32)",
          "function verifyProofLocally(uint8 proofType, address walletAddress, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input) view returns (bool)",
          "function submitProofBatch(uint8[] proofTypes, address[] walletAddresses, uint256[2][] a, uint256[2][2][] b, uint256[2][] c, uint256[][] inputs, bytes[] additionalData) returns (bytes32[])",
          "function getProofInfo(bytes32 proofId) view returns (bool, uint8, uint256, address, uint8)",
          "function getLatestProofForWallet(address walletAddress, uint8 proofType) view returns (bytes32)",
          "function getAllProofsForWallet(address walletAddress, uint8 proofType) view returns (bytes32[])",
          "event ProofSubmitted(bytes32 indexed proofId, address indexed walletAddress, uint8 proofType, bool verified)"
        ],
        deployedDate: new Date('2025-03-25'),
        compatibleChains: [1, 5, 137, 80001, 80002]
      }
    },
    'ProofOfFundsSimple': {
      '1.0.0': {
        version: '1.0.0',
        abi: [
          // ProofOfFundsSimple specific methods
          "function submitProof(uint8 proofType, address walletAddress, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input, bytes additionalData) returns (bytes32)",
          "function verifyProofLocally(uint8 proofType, address walletAddress, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input) view returns (bool)",
          "function getProofInfo(bytes32 proofId) view returns (bool, uint8, uint256, address, uint8)",
          "event ProofSubmitted(bytes32 indexed proofId, address indexed walletAddress, uint8 proofType, bool verified)"
        ],
        deployedDate: new Date('2025-03-25'),
        compatibleChains: [1, 5, 137, 80001, 80002]
      }
    },
    'ZKVerifier': {
      '1.0.0': {
        version: '1.0.0',
        abi: [
          // ZKVerifier specific methods
          "function verifyProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input) returns (bool)",
          "function verifyProofLocally(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input) view returns (bool)",
          "function getVerificationKey(string circuitId) view returns (string)",
          "function setVerificationKey(string circuitId, string verificationKey) returns (bool)",
          "function verifiedProofs(bytes32) view returns (bool)",
          "event ProofVerified(bytes32 indexed proofId, bool verified)"
        ],
        deployedDate: new Date('2025-03-25'),
        compatibleChains: [1, 5, 137, 80001, 80002]
      }
    }
  };

  /**
   * Creates a new ABI version manager
   * @param contractName Name of the contract
   */
  constructor(contractName: string) {
    this.contractName = contractName;

    // Load available versions for this contract
    const contractVersions = AbiVersionManager.CONTRACT_ABIS[contractName];
    if (!contractVersions) {
      throw new Error(`No ABI versions found for contract: ${contractName}`);
    }

    // Add all versions to the map
    Object.values(contractVersions).forEach(version => {
      this.versions.set(version.version, version);
    });

    // Set the current version to the latest one
    this.currentVersion = this.getLatestVersion();
  }

  /**
   * Gets the latest version based on semver
   * @returns The latest version string
   */
  private getLatestVersion(): string {
    // Simple implementation just using the first version
    // In a real implementation, this would use semver comparison
    const versions = [...this.versions.keys()];
    if (versions.length === 0) {
      throw new Error(`No versions available for contract: ${this.contractName}`);
    }

    // Sort versions using semver
    versions.sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);

      // Compare major, minor, patch in order
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = i < aParts.length ? aParts[i] : 0;
        const bVal = i < bParts.length ? bParts[i] : 0;

        if (aVal !== bVal) {
          return bVal - aVal; // Descending order for latest first
        }
      }

      return 0;
    });

    return versions[0];
  }

  /**
   * Gets the current ABI version
   * @returns The current version string
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Sets the current ABI version
   * @param version The version to set as current
   * @throws Error if the version does not exist
   */
  setCurrentVersion(version: string): void {
    if (!this.versions.has(version)) {
      throw new Error(`Version ${version} not found for contract: ${this.contractName}`);
    }

    this.currentVersion = version;
  }

  /**
   * Gets the current ABI
   * @returns The current ABI
   */
  getCurrentAbi(): ethers.ContractInterface {
    const version = this.versions.get(this.currentVersion);
    if (!version) {
      throw new Error(`Version ${this.currentVersion} not found for contract: ${this.contractName}`);
    }

    return version.abi;
  }

  /**
   * Gets an ABI for a specific version
   * @param version The version to get
   * @returns The requested ABI
   */
  getAbi(version: string): ethers.ContractInterface {
    const versionData = this.versions.get(version);
    if (!versionData) {
      throw new Error(`Version ${version} not found for contract: ${this.contractName}`);
    }

    return versionData.abi;
  }

  /**
   * Gets all available versions
   * @returns Array of available version strings
   */
  getAvailableVersions(): string[] {
    return [...this.versions.keys()];
  }

  /**
   * Checks if a version is compatible with a specific chain
   * @param version The version to check
   * @param chainId The chain ID to check compatibility with
   * @returns True if the version is compatible with the chain
   */
  isVersionCompatibleWithChain(version: string, chainId: number): boolean {
    const versionData = this.versions.get(version);
    if (!versionData) {
      return false;
    }

    return versionData.compatibleChains.includes(chainId);
  }

  /**
   * Gets all versions compatible with a specific chain
   * @param chainId The chain ID to filter by
   * @returns Array of compatible version strings
   */
  getVersionsForChain(chainId: number): string[] {
    const compatibleVersions: string[] = [];

    this.versions.forEach((data, version) => {
      if (data.compatibleChains.includes(chainId)) {
        compatibleVersions.push(version);
      }
    });

    return compatibleVersions;
  }

  /**
   * Gets detailed information about a version
   * @param version The version to get details for
   * @returns The version details
   */
  getVersionDetails(version: string): Omit<ContractAbiVersion, 'abi'> {
    const versionData = this.versions.get(version);
    if (!versionData) {
      throw new Error(`Version ${version} not found for contract: ${this.contractName}`);
    }

    // Return everything except the ABI for cleaner output
    const { abi, ...details } = versionData;
    return details;
  }
}