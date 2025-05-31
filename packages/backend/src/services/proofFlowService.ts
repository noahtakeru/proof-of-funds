/**
 * Proof Flow Service
 * 
 * Implements the complete flow for proof generation and verification,
 * integrating all system components.
 */

import { IntegrationService, ProofGenerationParams, ProofVerificationParams } from './integrationService';
import { ProofType, ProofStatus } from '@proof-of-funds/db';
import auditLogger from '@proof-of-funds/common/src/logging/auditLogger';
import performanceBenchmark from '../utils/performanceBenchmark';
import { ethers } from 'ethers';

// Interface for proof creation parameters
export interface ProofCreationParams {
  userId: string;
  walletAddresses: string[];
  chainIds: number[];
  proofType: ProofType;
  amount: string;
  expiryPeriod?: number; // in seconds
  templateId?: string;
  message?: string;
}

// Interface for batched proof result
export interface BatchedProofResult {
  referenceIds: string[];
  batchId: string;
  status: ProofStatus;
  transactionHash?: string;
}

/**
 * Proof Flow Service class
 * Orchestrates the complete flow for proof generation and verification
 */
export class ProofFlowService {
  private integrationService: IntegrationService;
  
  constructor() {
    this.integrationService = new IntegrationService();
  }
  
  /**
   * Create a proof using parameters appropriate for the proof type
   */
  async createProof(params: ProofCreationParams): Promise<string> {
    const context = { userId: params.userId, proofType: params.proofType };
    
    try {
      // Start audit logging
      await auditLogger.info(
        'proof.flow.start', 
        { 
          walletCount: params.walletAddresses.length,
          proofType: params.proofType,
          chainIds: params.chainIds
        }, 
        context
      );
      
      // Convert wallets to required format
      const wallets = params.walletAddresses.map((address, index) => ({
        address,
        chainId: params.chainIds[index] || params.chainIds[0] // Use first chain ID as fallback
      }));
      
      // Measure performance of proof generation
      const proofResult = await performanceBenchmark.measure(
        `proof_generation.${params.proofType.toLowerCase()}`,
        async () => {
          // Create proof generation parameters based on proof type
          const proofParams: ProofGenerationParams = {
            userId: params.userId,
            wallets,
            proofType: params.proofType,
            expiryPeriod: params.expiryPeriod || 86400, // Default to 1 day
            templateId: params.templateId,
            message: params.message
          };
          
          // Set appropriate amount parameter based on proof type
          switch (params.proofType) {
            case ProofType.STANDARD:
              proofParams.exactAmount = params.amount;
              break;
            case ProofType.THRESHOLD:
              proofParams.threshold = params.amount;
              break;
            case ProofType.MAXIMUM:
              proofParams.maxAmount = params.amount;
              break;
            case ProofType.ZERO_KNOWLEDGE:
              proofParams.threshold = params.amount;
              break;
          }
          
          return this.integrationService.generateProof(proofParams);
        },
        { userId: params.userId, proofType: params.proofType }
      );
      
      // Log success
      await auditLogger.info(
        'proof.flow.complete', 
        { 
          referenceId: proofResult.referenceId,
          proofId: proofResult.proofId,
          status: proofResult.status
        }, 
        context
      );
      
      return proofResult.referenceId;
      
    } catch (error) {
      // Log error
      await auditLogger.error(
        'proof.flow.error', 
        { 
          error: error instanceof Error ? error.message : String(error),
          proofType: params.proofType
        }, 
        context
      );
      
      throw error;
    }
  }
  
  /**
   * Verify a proof by reference ID
   */
  async verifyProof(referenceId: string, verifierAddress?: string): Promise<boolean> {
    const context = { referenceId, verifierAddress };
    
    try {
      // Start audit logging
      await auditLogger.info(
        'proof.verification.flow.start', 
        { referenceId }, 
        context
      );
      
      // Measure performance of proof verification
      const verificationResult = await performanceBenchmark.measure(
        'proof_verification',
        async () => {
          return this.integrationService.verifyProof({
            referenceId,
            verifierAddress
          });
        },
        { referenceId }
      );
      
      // Log result
      await auditLogger.info(
        'proof.verification.flow.complete', 
        { 
          referenceId,
          isValid: verificationResult.isValid,
          proofType: verificationResult.proofType,
          warningFlags: verificationResult.warningFlags
        }, 
        context
      );
      
      return verificationResult.isValid;
      
    } catch (error) {
      // Log error
      await auditLogger.error(
        'proof.verification.flow.error', 
        { 
          error: error instanceof Error ? error.message : String(error),
          referenceId
        }, 
        context
      );
      
      return false;
    }
  }
  
  /**
   * Create multiple proofs in batch for a user
   */
  async createBatchedProofs(
    userId: string,
    proofs: Array<Omit<ProofCreationParams, 'userId'>>
  ): Promise<BatchedProofResult> {
    const context = { userId, proofCount: proofs.length };
    
    try {
      // Start audit logging
      await auditLogger.info(
        'proof.batch.start', 
        { proofCount: proofs.length }, 
        context
      );
      
      // Generate proofs in parallel
      const proofResults = await Promise.all(
        proofs.map(proofParams => 
          this.createProof({
            ...proofParams,
            userId
          })
        )
      );
      
      // In a real implementation, we would:
      // 1. Submit all proofs to a batch processing queue
      // 2. Create a Merkle tree from all proofs
      // 3. Submit the Merkle root to the blockchain
      // 4. Update all proofs with the batch ID and Merkle path
      
      // For now, we just return the reference IDs
      const batchResult: BatchedProofResult = {
        referenceIds: proofResults,
        batchId: `batch-${Date.now()}`,
        status: ProofStatus.PENDING
      };
      
      // Log result
      await auditLogger.info(
        'proof.batch.complete', 
        { 
          batchId: batchResult.batchId,
          referenceIds: batchResult.referenceIds,
          status: batchResult.status
        }, 
        context
      );
      
      return batchResult;
      
    } catch (error) {
      // Log error
      await auditLogger.error(
        'proof.batch.error', 
        { 
          error: error instanceof Error ? error.message : String(error),
          proofCount: proofs.length
        }, 
        context
      );
      
      throw error;
    }
  }
  
  /**
   * Get the performance metrics for proof operations
   */
  getPerformanceMetrics(): any {
    return performanceBenchmark.getReport();
  }
  
  /**
   * Clean up resources on shutdown
   */
  async shutdown(): Promise<void> {
    await this.integrationService.shutdown();
  }
}