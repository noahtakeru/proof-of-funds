/**
 * @file ProofOfFundsContract.ts
 * @description Contract interface for ProofOfFunds smart contract
 */

import { ethers } from 'ethers';
import { ContractInterface } from './ContractInterface';
import { 
  ProofData, 
  TransactionOptions, 
  VerificationResult,
  ProofType, 
  WalletAddress,
  ProofSubmission,
  ProofStatus
} from '../types';

/**
 * Interface for ProofOfFunds smart contract
 */
export class ProofOfFundsContract extends ContractInterface {
  /**
   * Creates a new ProofOfFunds contract interface
   * @param provider The ethers provider
   * @param signer Optional signer for transactions
   * @param chainId Chain ID where the contract is deployed
   */
  constructor(
    provider: ethers.providers.Provider,
    signer: ethers.Signer | null,
    chainId: number
  ) {
    super(provider, signer, 'ProofOfFunds', chainId);
  }
  
  /**
   * Submits a proof to the contract
   * @param proofData The proof data to submit
   * @param proofType The type of proof
   * @param walletAddress The wallet address the proof is for
   * @param additionalData Any additional data for the proof
   * @param options Transaction options
   * @returns Promise that resolves to the submission result
   */
  async submitProof(
    proofData: ProofData,
    proofType: ProofType,
    walletAddress: WalletAddress,
    additionalData: string = '0x',
    options: TransactionOptions = {}
  ): Promise<ProofSubmission> {
    // Data validation
    this.validateProofData(proofData);
    
    // Ensure wallet address is valid
    if (!ethers.utils.isAddress(walletAddress)) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }
    
    try {
      // Format proof data for contract
      const { a, b, c, input } = this.formatProofForContract(proofData);
      
      // Normalize addresses to checksummed format
      const normalizedWalletAddress = ethers.utils.getAddress(walletAddress);
      
      // Generate a proof ID
      const proofId = this.generateProofId(proofData, proofType, normalizedWalletAddress);
      
      // Send the submission transaction
      const result = await this.sendTransaction(
        'submitProof',
        options,
        proofType,
        normalizedWalletAddress,
        a, b, c, input,
        additionalData
      );
      
      // Extract submission result from transaction logs
      const submissionResult = this.extractSubmissionResultFromLogs(result.logs || [], proofId);
      
      return {
        proofId,
        transactionHash: result.transactionHash,
        status: submissionResult ? ProofStatus.Verified : ProofStatus.Rejected,
        error: submissionResult ? undefined : 'Proof verification failed',
        blockNumber: result.blockNumber,
        timestamp: Math.floor(Date.now() / 1000),
        walletAddress: normalizedWalletAddress,
        proofType,
        additionalData
      };
    } catch (error: any) {
      return {
        proofId: this.generateProofId(proofData, proofType, walletAddress),
        status: ProofStatus.Failed,
        error: error.message,
        timestamp: Math.floor(Date.now() / 1000),
        walletAddress,
        proofType,
        additionalData
      };
    }
  }
  
  /**
   * Verifies a proof locally without submitting it to the blockchain
   * @param proofData The proof data to verify
   * @param proofType The type of proof
   * @param walletAddress The wallet address the proof is for
   * @returns Promise that resolves to the verification result
   */
  async verifyProofLocally(
    proofData: ProofData,
    proofType: ProofType,
    walletAddress: WalletAddress
  ): Promise<VerificationResult> {
    // Data validation
    this.validateProofData(proofData);
    
    try {
      // Format proof data for contract
      const { a, b, c, input } = this.formatProofForContract(proofData);
      
      // Normalize addresses to checksummed format
      const normalizedWalletAddress = ethers.utils.getAddress(walletAddress);
      
      // Call the contract's verification function without a transaction
      const isVerified = await this.call<boolean>(
        'verifyProofLocally',
        proofType,
        normalizedWalletAddress,
        a, b, c, input
      );
      
      return {
        isVerified,
        error: isVerified ? undefined : 'Proof verification failed',
        contractAddress: this.getAddress(),
        proofId: this.generateProofId(proofData, proofType, normalizedWalletAddress),
        verificationMethod: 'local'
      };
    } catch (error: any) {
      return {
        isVerified: false,
        error: error.message,
        contractAddress: this.getAddress(),
        proofId: this.generateProofId(proofData, proofType, walletAddress),
        verificationMethod: 'local'
      };
    }
  }
  
  /**
   * Submits multiple proofs in a batch
   * @param proofs Array of proofs to submit
   * @param options Transaction options
   * @returns Promise that resolves to an array of submission results
   */
  async submitProofBatch(
    proofs: Array<{
      proofData: ProofData;
      proofType: ProofType;
      walletAddress: WalletAddress;
      additionalData?: string;
    }>,
    options: TransactionOptions = {}
  ): Promise<ProofSubmission[]> {
    if (!proofs.length) {
      throw new Error('No proofs provided for batch submission');
    }
    
    // Format all proofs for contract
    const formattedProofs = proofs.map(({ proofData, proofType, walletAddress, additionalData = '0x' }) => {
      this.validateProofData(proofData);
      
      // Ensure wallet address is valid
      if (!ethers.utils.isAddress(walletAddress)) {
        throw new Error(`Invalid wallet address: ${walletAddress}`);
      }
      
      const { a, b, c, input } = this.formatProofForContract(proofData);
      
      return {
        proofType,
        walletAddress: ethers.utils.getAddress(walletAddress),
        a, b, c, input,
        additionalData,
        proofId: this.generateProofId(proofData, proofType, walletAddress),
        originalData: { proofData, proofType, walletAddress, additionalData }
      };
    });
    
    try {
      // Prepare arrays for batch submission
      const proofTypes = formattedProofs.map(p => p.proofType);
      const walletAddresses = formattedProofs.map(p => p.walletAddress);
      const proofAs = formattedProofs.map(p => p.a);
      const proofBs = formattedProofs.map(p => p.b);
      const proofCs = formattedProofs.map(p => p.c);
      const proofInputs = formattedProofs.map(p => p.input);
      const additionalDatas = formattedProofs.map(p => p.additionalData);
      
      // Send the batch submission transaction
      const result = await this.sendTransaction(
        'submitProofBatch',
        options,
        proofTypes,
        walletAddresses,
        proofAs,
        proofBs,
        proofCs,
        proofInputs,
        additionalDatas
      );
      
      // Parse batch results from logs
      const batchResults = this.extractBatchResultsFromLogs(result.logs || [], formattedProofs.map(p => p.proofId));
      
      // Create submission results
      return formattedProofs.map((proof, index) => {
        const batchResult = batchResults[index] || false;
        
        return {
          proofId: proof.proofId,
          transactionHash: result.transactionHash,
          status: batchResult ? ProofStatus.Verified : ProofStatus.Rejected,
          error: batchResult ? undefined : 'Proof verification failed in batch',
          blockNumber: result.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          walletAddress: proof.walletAddress,
          proofType: proof.proofType,
          additionalData: proof.additionalData,
          batchIndex: index
        };
      });
    } catch (error: any) {
      // Handle batch submission error
      return formattedProofs.map(proof => ({
        proofId: proof.proofId,
        status: ProofStatus.Failed,
        error: error.message,
        timestamp: Math.floor(Date.now() / 1000),
        walletAddress: proof.walletAddress,
        proofType: proof.proofType,
        additionalData: proof.additionalData
      }));
    }
  }
  
  /**
   * Gets information about a submitted proof
   * @param proofId ID of the proof
   * @returns Promise that resolves to the proof information
   */
  async getProofInfo(proofId: string): Promise<{
    exists: boolean;
    status: ProofStatus;
    timestamp: number;
    walletAddress: string;
    proofType: ProofType;
  }> {
    try {
      const result = await this.call<[boolean, number, number, string, number]>(
        'getProofInfo',
        proofId
      );
      
      return {
        exists: result[0],
        status: result[1] as ProofStatus,
        timestamp: result[2],
        walletAddress: result[3],
        proofType: result[4] as ProofType
      };
    } catch (error) {
      return {
        exists: false,
        status: ProofStatus.NotFound,
        timestamp: 0,
        walletAddress: ethers.constants.AddressZero,
        proofType: ProofType.Standard
      };
    }
  }
  
  /**
   * Gets the latest proof for a wallet
   * @param walletAddress Wallet address to get the latest proof for
   * @param proofType Optional type of proof to filter by
   * @returns Promise that resolves to the latest proof ID or null if none found
   */
  async getLatestProofForWallet(
    walletAddress: WalletAddress,
    proofType?: ProofType
  ): Promise<string | null> {
    try {
      // Normalize address
      const normalizedWalletAddress = ethers.utils.getAddress(walletAddress);
      
      const proofId = await this.call<string>(
        'getLatestProofForWallet',
        normalizedWalletAddress,
        proofType !== undefined ? proofType : 0
      );
      
      return proofId === ethers.constants.HashZero ? null : proofId;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Gets all proofs for a wallet
   * @param walletAddress Wallet address to get proofs for
   * @param proofType Optional type of proof to filter by
   * @returns Promise that resolves to an array of proof IDs
   */
  async getAllProofsForWallet(
    walletAddress: WalletAddress,
    proofType?: ProofType
  ): Promise<string[]> {
    try {
      // Normalize address
      const normalizedWalletAddress = ethers.utils.getAddress(walletAddress);
      
      const proofIds = await this.call<string[]>(
        'getAllProofsForWallet',
        normalizedWalletAddress,
        proofType !== undefined ? proofType : 0
      );
      
      // Filter out zero hash values
      return proofIds.filter(id => id !== ethers.constants.HashZero);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Validates proof data
   * @param proofData The proof data to validate
   * @throws Error if proof data is invalid
   */
  private validateProofData(proofData: ProofData): void {
    if (!proofData) {
      throw new Error('Proof data is required');
    }
    
    if (!proofData.proof || !proofData.publicSignals) {
      throw new Error('Proof data is incomplete');
    }
    
    // Validate proof structure
    const proof = proofData.proof;
    if (!proof.a || !proof.b || !proof.c || 
        !Array.isArray(proof.a) || proof.a.length !== 2 ||
        !Array.isArray(proof.b) || proof.b.length !== 2 || 
        !Array.isArray(proof.b[0]) || proof.b[0].length !== 2 ||
        !Array.isArray(proof.b[1]) || proof.b[1].length !== 2 ||
        !Array.isArray(proof.c) || proof.c.length !== 2) {
      throw new Error('Proof structure is invalid');
    }
    
    // Validate public signals
    if (!Array.isArray(proofData.publicSignals) || proofData.publicSignals.length === 0) {
      throw new Error('Public signals are invalid');
    }
  }
  
  /**
   * Formats proof data for the contract
   * @param proofData The proof data to format
   * @returns Formatted proof for contract
   */
  private formatProofForContract(proofData: ProofData): {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
    input: string[];
  } {
    const { proof, publicSignals } = proofData;
    
    return {
      a: [proof.a[0], proof.a[1]],
      b: [
        [proof.b[0][0], proof.b[0][1]],
        [proof.b[1][0], proof.b[1][1]]
      ],
      c: [proof.c[0], proof.c[1]],
      input: publicSignals.map(signal => signal.toString())
    };
  }
  
  /**
   * Extracts submission result from transaction logs
   * @param logs Transaction logs
   * @param proofId The proof ID to check for
   * @returns True if the proof was verified
   */
  private extractSubmissionResultFromLogs(logs: ethers.providers.Log[], proofId: string): boolean {
    // Look for ProofSubmitted event
    const proofSubmittedTopic = ethers.utils.id('ProofSubmitted(bytes32,address,uint8,bool)');
    
    for (const log of logs) {
      if (log.topics[0] === proofSubmittedTopic) {
        // Check if this log is for our proof ID
        const logProofId = log.topics[1];
        
        if (logProofId === ethers.utils.hexZeroPad(proofId, 32)) {
          // Parse the event data to check if the proof was verified
          const data = ethers.utils.defaultAbiCoder.decode(['address', 'uint8', 'bool'], log.data);
          return data[2]; // The verified status
        }
      }
    }
    
    // If we couldn't find the event, default to assuming it succeeded
    return true;
  }
  
  /**
   * Extracts batch results from transaction logs
   * @param logs Transaction logs
   * @param proofIds Array of proof IDs in the batch
   * @returns Array of boolean results in the same order as the proof IDs
   */
  private extractBatchResultsFromLogs(logs: ethers.providers.Log[], proofIds: string[]): boolean[] {
    // Initialize results with default false values
    const results = Array(proofIds.length).fill(false);
    
    // Look for ProofSubmitted events
    const proofSubmittedTopic = ethers.utils.id('ProofSubmitted(bytes32,address,uint8,bool)');
    
    for (const log of logs) {
      if (log.topics[0] === proofSubmittedTopic) {
        // Get the proof ID from the log
        const logProofId = log.topics[1];
        
        // Find which proof this is in our batch
        const index = proofIds.findIndex(id => 
          ethers.utils.hexZeroPad(id, 32).toLowerCase() === logProofId.toLowerCase()
        );
        
        if (index !== -1) {
          // Parse the event data to check if the proof was verified
          const data = ethers.utils.defaultAbiCoder.decode(['address', 'uint8', 'bool'], log.data);
          results[index] = data[2]; // The verified status
        }
      }
    }
    
    return results;
  }
  
  /**
   * Generates a unique proof ID
   * @param proofData The proof data
   * @param proofType The type of proof
   * @param walletAddress The wallet address
   * @returns A unique proof ID
   */
  private generateProofId(
    proofData: ProofData,
    proofType: ProofType,
    walletAddress: string
  ): string {
    // Create a hash of the proof, type, and wallet address
    const proofString = JSON.stringify({
      a: proofData.proof.a,
      b: proofData.proof.b,
      c: proofData.proof.c,
      input: proofData.publicSignals,
      type: proofType,
      wallet: walletAddress.toLowerCase()
    });
    
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(proofString));
  }
}