/**
 * @file contractTypes.ts
 * @description Type definitions for contract interaction
 */

import { ethers } from 'ethers';
import { ZK_PROOF_TYPES } from '../../../config/constants';

/**
 * Wallet address type alias
 */
export type WalletAddress = string;

/**
 * Enum for proof types
 */
export enum ProofType {
  Standard = 1, // Proof of exactly X amount
  Threshold = 2, // Proof of at least X amount
  Maximum = 3 // Proof of at most X amount
}

/**
 * Enum for proof status
 */
export enum ProofStatus {
  NotFound = 0,
  Pending = 1,
  Verified = 2,
  Rejected = 3,
  Expired = 4,
  Failed = 5
}

/**
 * Interface for ZK proof data
 */
export interface ProofData {
  proof: {
    a: string[];
    b: string[][];
    c: string[];
  };
  publicSignals: string[];
  circuit?: string; // Optional circuit identifier
}

/**
 * Interface for transaction options
 */
export interface TransactionOptions {
  gasLimit?: ethers.BigNumber | number;
  gasPrice?: ethers.BigNumber | number;
  maxFeePerGas?: ethers.BigNumber | number;
  maxPriorityFeePerGas?: ethers.BigNumber | number;
  value?: ethers.BigNumber | number;
  waitForConfirmation?: boolean;
  confirmations?: number;
}

/**
 * Interface for transaction result
 */
export interface TransactionResult {
  transactionHash: string;
  blockNumber?: number;
  confirmations?: number;
  status?: boolean;
  logs?: ethers.providers.Log[];
  receipt?: ethers.providers.TransactionReceipt;
  transaction: ethers.providers.TransactionResponse;
}

/**
 * Interface for verification result
 */
export interface VerificationResult {
  isVerified: boolean;
  error?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  contractAddress?: string;
  proofId?: string;
  verificationMethod?: 'onchain' | 'local' | 'offchain';
}

/**
 * Interface for proof submission result
 */
export interface ProofSubmission {
  proofId: string;
  status: ProofStatus;
  error?: string;
  transactionHash?: string;
  blockNumber?: number;
  timestamp: number;
  walletAddress: string;
  proofType: ProofType;
  additionalData?: string;
  batchIndex?: number;
}

/**
 * Interface for gas strategy
 */
export interface GasStrategy {
  name: string;
  multiplier: number;
  description: string;
  estimatedTimeSeconds: number;
}

/**
 * Interface for gas price estimation
 */
export interface GasPriceEstimation {
  gasPrice?: ethers.BigNumber;
  maxFeePerGas?: ethers.BigNumber;
  maxPriorityFeePerGas?: ethers.BigNumber;
  baseFeePerGas?: ethers.BigNumber;
  estimatedCostWei: ethers.BigNumber;
  estimatedCostUsd?: number;
  estimatedTimeSeconds: number;
  strategy: string;
}

/**
 * Interface for contract metadata
 */
export interface ContractMetadata {
  name: string;
  address: string;
  chainId: number;
  deployedAt: number;
  version: string;
  abi: ethers.ContractInterface;
}

/**
 * Interface for chain configuration
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  testnet: boolean;
}

/**
 * Interface for proof verification params
 */
export interface ProofVerificationParams {
  proofType: ProofType;
  walletAddress: WalletAddress;
  amount: ethers.BigNumber;
  timestamp?: number;
}

/**
 * Interface for contract call info
 */
export interface ContractCallInfo {
  contractName: string;
  methodName: string;
  args: any[];
  value?: ethers.BigNumber;
  gasLimit?: ethers.BigNumber;
  gasPrice?: ethers.BigNumber;
}

/**
 * Interface for contract event data
 */
export interface ContractEventData {
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  args: any[];
  timestamp?: number;
}

/**
 * Interface for event filters
 */
export interface EventFilter {
  fromBlock?: number;
  toBlock?: number;
  address?: string | string[];
  topics?: (string | string[] | null)[];
}

/**
 * Interface for contract deployment info
 */
export interface ContractDeploymentInfo {
  contractName: string;
  address: string;
  version: string;
  chainId: number;
  deployedAt: number;
  deployer: string;
  implementation?: string;
  transactionHash: string;
}