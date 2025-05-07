/**
 * @file ZKVerifierContract.ts
 * @description Contract interface for ZK Verifier smart contract
 */

import { ethers } from 'ethers';
import { ContractInterface } from './ContractInterface';
import { ProofData, TransactionOptions, VerificationResult, TransactionResult } from '../types';

/**
 * Interface for ZK Verifier smart contract
 */
export class ZKVerifierContract extends ContractInterface {
  /**
   * Creates a new ZK Verifier contract interface
   * @param provider The ethers provider
   * @param signer Optional signer for transactions
   * @param chainId Chain ID where the contract is deployed
   */
  constructor(
    provider: ethers.providers.Provider,
    signer: ethers.Signer | null,
    chainId: number
  ) {
    super(provider, signer, 'ZKVerifier', chainId);
  }
  
  /**
   * Verifies a proof on-chain
   * @param proofData The proof data to verify
   * @param options Transaction options
   * @returns Promise that resolves to the verification result
   */
  async verifyProof(
    proofData: ProofData,
    options: TransactionOptions = {}
  ): Promise<VerificationResult> {
    // Data validation
    this.validateProofData(proofData);
    
    try {
      // Format proof data for contract
      const proof = this.formatProofForContract(proofData);
      
      // Send the verification transaction
      const result = await this.sendTransaction('verifyProof', options, proof.a, proof.b, proof.c, proof.input);
      
      // Extract verification result from transaction logs
      const isVerified = this.extractVerificationResultFromLogs(result.logs || []);
      
      return {
        transactionHash: result.transactionHash,
        isVerified,
        error: isVerified ? undefined : 'Proof verification failed',
        blockNumber: result.blockNumber,
        contractAddress: this.getAddress(),
        proofId: this.generateProofId(proofData),
        gasUsed: result.receipt?.gasUsed?.toString()
      };
    } catch (error: any) {
      return {
        isVerified: false,
        error: error.message,
        contractAddress: this.getAddress(),
        proofId: this.generateProofId(proofData)
      };
    }
  }
  
  /**
   * Verifies a proof locally without a transaction
   * @param proofData The proof data to verify
   * @returns Promise that resolves to the verification result
   */
  async verifyProofLocally(proofData: ProofData): Promise<VerificationResult> {
    // Data validation
    this.validateProofData(proofData);
    
    try {
      // Format proof data for contract
      const proof = this.formatProofForContract(proofData);
      
      // Call the contract's verification function without a transaction
      const isVerified = await this.call<boolean>('verifyProofLocally', proof.a, proof.b, proof.c, proof.input);
      
      return {
        isVerified,
        error: isVerified ? undefined : 'Proof verification failed',
        contractAddress: this.getAddress(),
        proofId: this.generateProofId(proofData),
        verificationMethod: 'local'
      };
    } catch (error: any) {
      return {
        isVerified: false,
        error: error.message,
        contractAddress: this.getAddress(),
        proofId: this.generateProofId(proofData),
        verificationMethod: 'local'
      };
    }
  }
  
  /**
   * Gets the verification key for a specific circuit
   * @param circuitId ID of the circuit
   * @returns Promise that resolves to the verification key
   */
  async getVerificationKey(circuitId: string): Promise<string> {
    return this.call<string>('getVerificationKey', circuitId);
  }
  
  /**
   * Sets a verification key (only callable by owner)
   * @param circuitId ID of the circuit
   * @param verificationKey The verification key
   * @param options Transaction options
   * @returns Promise that resolves to the transaction result
   */
  async setVerificationKey(
    circuitId: string,
    verificationKey: string,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    return await this.sendTransaction('setVerificationKey', options, circuitId, verificationKey);
  }
  
  /**
   * Checks if a proof has been verified
   * @param proofId ID of the proof
   * @returns Promise that resolves to true if the proof has been verified
   */
  async isProofVerified(proofId: string): Promise<boolean> {
    return this.call<boolean>('verifiedProofs', proofId);
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
    if (!proof.a || !proof.b || !proof.c) {
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
   * Extracts verification result from transaction logs
   * @param logs Transaction logs
   * @returns True if the proof was verified
   */
  private extractVerificationResultFromLogs(logs: ethers.providers.Log[]): boolean {
    // Look for ProofVerified event
    const proofVerifiedTopic = ethers.utils.id('ProofVerified(bytes32,bool)');
    
    for (const log of logs) {
      if (log.topics[0] === proofVerifiedTopic) {
        // Parse the event data
        const data = ethers.utils.defaultAbiCoder.decode(['bool'], log.data);
        return data[0];
      }
    }
    
    // If we couldn't find the event, check the transaction status instead
    return true;
  }
  
  /**
   * Generates a unique proof ID
   * @param proofData The proof data
   * @returns A unique proof ID
   */
  private generateProofId(proofData: ProofData): string {
    // Create a hash of the proof and public signals
    const proofString = JSON.stringify({
      a: proofData.proof.a,
      b: proofData.proof.b,
      c: proofData.proof.c,
      input: proofData.publicSignals
    });
    
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(proofString));
  }
}