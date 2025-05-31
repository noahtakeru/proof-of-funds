/**
 * Integration Service
 * 
 * Connects and coordinates interactions between all system components:
 * - Chain adapters for blockchain data
 * - Database for persistent storage
 * - ZK proof generation and verification
 * - Audit logging for security events
 * - Smart contract interactions
 */

import { ChainAdapterRegistry, ChainType } from '@proof-of-funds/frontend/utils/chains';
import { ZKProofService } from './zkProofService';
import { TransactionHistoryProcessor } from '@proof-of-funds/frontend/services/TransactionHistoryProcessor';
import { BlacklistChecker } from '@proof-of-funds/frontend/services/BlacklistChecker';
import { VerificationResultFormatter } from '@proof-of-funds/frontend/services/VerificationResultFormatter';
import auditLogger, { LogCategory, LogSeverity } from '@proof-of-funds/common/src/logging/auditLogger';
import { PrismaClient, ProofType, ProofStatus, WalletType } from '@proof-of-funds/db';
import { ethers } from 'ethers';
import { randomBytes } from 'crypto';

// Interface for proof generation parameters
export interface ProofGenerationParams {
  userId: string;
  wallets: Array<{ address: string, chainId: number }>;
  proofType: ProofType;
  threshold?: string;
  maxAmount?: string;
  exactAmount?: string;
  expiryPeriod: number; // in seconds
  templateId?: string;
  message?: string;
}

// Interface for proof verification parameters
export interface ProofVerificationParams {
  referenceId: string;
  verifierAddress?: string;
}

// Interface for proof result
export interface ProofResult {
  referenceId: string;
  proofId: string;
  status: ProofStatus;
  createdAt: Date;
  expiresAt: Date;
  type: ProofType;
  wallets: Array<{ address: string, chainId: number }>;
  tempWalletAddress: string;
}

// Interface for verification result
export interface VerificationResult {
  isValid: boolean;
  proofType: ProofType;
  createdAt: Date;
  expiresAt: Date;
  currentBalance?: string;
  threshold?: string;
  maxAmount?: string;
  exactAmount?: string;
  message?: string;
  warningFlags: string[];
}

/**
 * Integration Service class
 */
export class IntegrationService {
  private chainRegistry: ChainAdapterRegistry;
  private zkProofService: ZKProofService;
  private transactionProcessor: TransactionHistoryProcessor;
  private blacklistChecker: BlacklistChecker;
  private resultFormatter: VerificationResultFormatter;
  private prisma: PrismaClient;
  
  constructor() {
    this.chainRegistry = new ChainAdapterRegistry();
    this.zkProofService = new ZKProofService();
    this.transactionProcessor = new TransactionHistoryProcessor();
    this.blacklistChecker = new BlacklistChecker();
    this.resultFormatter = new VerificationResultFormatter();
    this.prisma = new PrismaClient();
  }
  
  /**
   * Generate a cryptographic reference ID
   */
  private generateReferenceId(): string {
    return `pof-${randomBytes(16).toString('hex')}`;
  }
  
  /**
   * Generate a temporary wallet for proof submission
   */
  private async generateTemporaryWallet(userId: string, chainId: number = 137): Promise<string> {
    const wallet = ethers.Wallet.createRandom();
    
    // Save wallet to database
    const tempWallet = await this.prisma.wallet.create({
      data: {
        userId,
        address: wallet.address,
        chainId,
        type: WalletType.TEMPORARY,
        encryptedPrivateKey: wallet.privateKey, // This should be encrypted in production
        keyId: randomBytes(8).toString('hex')
      }
    });
    
    await auditLogger.info(
      'wallet.temporary.created', 
      { walletId: tempWallet.id, chainId }, 
      { userId }
    );
    
    return tempWallet.id;
  }
  
  /**
   * Check if wallets are on blacklists
   */
  private async checkBlacklists(wallets: Array<{ address: string, chainId: number }>): Promise<string[]> {
    const warnings: string[] = [];
    
    for (const wallet of wallets) {
      const isBlacklisted = await this.blacklistChecker.checkAddress(wallet.address, wallet.chainId);
      if (isBlacklisted) {
        warnings.push(`WALLET_BLACKLISTED:${wallet.address}`);
        
        await auditLogger.warning(
          'blacklist.match', 
          { address: wallet.address, chainId: wallet.chainId }, 
          {}
        );
      }
    }
    
    return warnings;
  }
  
  /**
   * Get wallet balances across chains
   */
  private async getWalletBalances(wallets: Array<{ address: string, chainId: number }>): Promise<
    Array<{ address: string, chainId: number, balance: string }>
  > {
    const results = await Promise.all(
      wallets.map(async wallet => {
        try {
          const adapter = this.chainRegistry.getAdapter(wallet.chainId);
          if (!adapter) {
            throw new Error(`Unsupported chain ID: ${wallet.chainId}`);
          }
          
          const balance = await adapter.getBalance(wallet.address);
          return {
            address: wallet.address,
            chainId: wallet.chainId,
            balance: balance.toString()
          };
        } catch (error) {
          console.error(`Failed to get balance for ${wallet.address} on chain ${wallet.chainId}:`, error);
          return {
            address: wallet.address,
            chainId: wallet.chainId,
            balance: '0'
          };
        }
      })
    );
    
    return results;
  }
  
  /**
   * Calculate total balance across wallets
   */
  private calculateTotalBalance(
    walletBalances: Array<{ address: string, chainId: number, balance: string }>
  ): string {
    let totalBalance = ethers.BigNumber.from(0);
    
    for (const wallet of walletBalances) {
      try {
        totalBalance = totalBalance.add(ethers.BigNumber.from(wallet.balance));
      } catch (error) {
        console.error(`Failed to add balance for ${wallet.address}:`, error);
      }
    }
    
    return totalBalance.toString();
  }
  
  /**
   * Generate a proof using all system components
   */
  async generateProof(params: ProofGenerationParams): Promise<ProofResult> {
    const context = { userId: params.userId };
    
    try {
      // Start audit log for proof generation
      await auditLogger.info(
        'proof.generation.start', 
        { proofType: params.proofType, walletCount: params.wallets.length }, 
        context
      );
      
      // Check if wallets are on any blacklists
      const warningFlags = await this.checkBlacklists(params.wallets);
      
      // Get balances for all wallets
      const walletBalances = await this.getWalletBalances(params.wallets);
      const totalBalance = this.calculateTotalBalance(walletBalances);
      
      // Create a temporary wallet for proof submission
      const tempWalletId = await this.generateTemporaryWallet(params.userId);
      
      // Get proof template if provided
      let template = null;
      if (params.templateId) {
        template = await this.prisma.proofTemplate.findUnique({
          where: { id: params.templateId }
        });
        
        if (!template) {
          throw new Error(`Template not found: ${params.templateId}`);
        }
      }
      
      // Generate reference ID
      const referenceId = this.generateReferenceId();
      
      // Calculate expiry date
      const expiryPeriod = template?.expiryPeriod || params.expiryPeriod;
      const expiresAt = new Date(Date.now() + expiryPeriod * 1000);
      
      // Generate ZK proof based on proof type
      let zkProofData;
      switch (params.proofType) {
        case ProofType.STANDARD:
          zkProofData = await this.zkProofService.generateStandardProof({
            balance: totalBalance,
            threshold: params.exactAmount || '0',
            userAddress: params.wallets[0].address
          });
          break;
          
        case ProofType.THRESHOLD:
          zkProofData = await this.zkProofService.generateThresholdProof({
            totalBalance,
            threshold: params.threshold || '0',
            userAddress: params.wallets[0].address,
            networkId: params.wallets[0].chainId.toString()
          });
          break;
          
        case ProofType.MAXIMUM:
          zkProofData = await this.zkProofService.generateMaximumProof({
            maxBalance: totalBalance,
            threshold: params.maxAmount || '0',
            userAddress: params.wallets[0].address,
            networks: params.wallets.map(w => w.chainId.toString()).slice(0, 4)
          });
          break;
          
        case ProofType.ZERO_KNOWLEDGE:
          zkProofData = await this.zkProofService.generateZeroKnowledgeProof({
            totalBalance,
            threshold: params.threshold || params.maxAmount || params.exactAmount || '0',
            userAddress: params.wallets[0].address,
            networkId: params.wallets[0].chainId.toString()
          });
          break;
          
        default:
          throw new Error(`Unsupported proof type: ${params.proofType}`);
      }
      
      // Generate encryption key for proof data
      const encryptionKeyId = randomBytes(16).toString('hex');
      
      // Create proof metadata
      const metadataJson = JSON.stringify({
        wallets: walletBalances,
        totalBalance,
        message: params.message,
        template: template ? { id: template.id, name: template.name } : null,
        proofType: params.proofType,
        threshold: params.threshold,
        maxAmount: params.maxAmount,
        exactAmount: params.exactAmount,
        zkProofData,
        timestamp: new Date().toISOString()
      });
      
      // Store proof in database
      const proof = await this.prisma.proof.create({
        data: {
          userId: params.userId,
          referenceId,
          proofType: params.proofType,
          expiresAt,
          encryptedData: metadataJson, // This should be encrypted in production
          encryptionKeyId,
          tempWalletId,
          originalWallets: params.wallets.map(w => w.address),
          warningFlags,
          status: ProofStatus.PENDING
        }
      });
      
      // Log proof creation
      await auditLogger.info(
        'proof.generation.complete', 
        { 
          proofId: proof.id, 
          referenceId, 
          proofType: params.proofType,
          walletCount: params.wallets.length
        }, 
        context
      );
      
      // Get temporary wallet for return
      const tempWallet = await this.prisma.wallet.findUnique({
        where: { id: tempWalletId }
      });
      
      return {
        referenceId,
        proofId: proof.id,
        status: proof.status,
        createdAt: proof.createdAt,
        expiresAt: proof.expiresAt,
        type: proof.proofType,
        wallets: params.wallets,
        tempWalletAddress: tempWallet?.address || ''
      };
      
    } catch (error) {
      // Log error
      await auditLogger.error(
        'proof.generation.error', 
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
   * Verify a proof using all system components
   */
  async verifyProof(params: ProofVerificationParams): Promise<VerificationResult> {
    const context = { verifierAddress: params.verifierAddress };
    
    try {
      // Start audit log for proof verification
      await auditLogger.info(
        'proof.verification.start', 
        { referenceId: params.referenceId }, 
        context
      );
      
      // Get proof from database
      const proof = await this.prisma.proof.findUnique({
        where: { referenceId: params.referenceId }
      });
      
      if (!proof) {
        await auditLogger.warning(
          'proof.verification.not_found', 
          { referenceId: params.referenceId }, 
          context
        );
        
        throw new Error(`Proof not found: ${params.referenceId}`);
      }
      
      // Check if proof is expired
      if (proof.expiresAt < new Date()) {
        await auditLogger.info(
          'proof.verification.expired', 
          { 
            referenceId: params.referenceId,
            expiresAt: proof.expiresAt
          }, 
          context
        );
        
        return {
          isValid: false,
          proofType: proof.proofType,
          createdAt: proof.createdAt,
          expiresAt: proof.expiresAt,
          warningFlags: ['PROOF_EXPIRED']
        };
      }
      
      // Check if proof is revoked
      if (proof.isRevoked) {
        await auditLogger.info(
          'proof.verification.revoked', 
          { 
            referenceId: params.referenceId,
            revokedAt: proof.revokedAt
          }, 
          context
        );
        
        return {
          isValid: false,
          proofType: proof.proofType,
          createdAt: proof.createdAt,
          expiresAt: proof.expiresAt,
          warningFlags: ['PROOF_REVOKED']
        };
      }
      
      // Parse encrypted data
      const proofData = JSON.parse(proof.encryptedData);
      
      // Verify ZK proof
      let isValid = false;
      switch (proof.proofType) {
        case ProofType.STANDARD:
          isValid = await this.zkProofService.verifyStandardProof(proofData.zkProofData);
          break;
          
        case ProofType.THRESHOLD:
          isValid = await this.zkProofService.verifyThresholdProof(proofData.zkProofData);
          break;
          
        case ProofType.MAXIMUM:
          isValid = await this.zkProofService.verifyMaximumProof(proofData.zkProofData);
          break;
          
        case ProofType.ZERO_KNOWLEDGE:
          isValid = await this.zkProofService.verifyZeroKnowledgeProof(proofData.zkProofData);
          break;
          
        default:
          throw new Error(`Unsupported proof type: ${proof.proofType}`);
      }
      
      // Get current balances if proof is valid
      let currentBalance = undefined;
      if (isValid) {
        // For standard and zero-knowledge proofs, we don't check current balances
        if (proof.proofType === ProofType.THRESHOLD || proof.proofType === ProofType.MAXIMUM) {
          try {
            const walletBalances = await this.getWalletBalances(
              proof.originalWallets.map((address, index) => ({
                address,
                chainId: proofData.wallets[index]?.chainId || 1 // Default to Ethereum if chain ID not found
              }))
            );
            
            currentBalance = this.calculateTotalBalance(walletBalances);
          } catch (error) {
            console.error('Failed to get current balances:', error);
          }
        }
      }
      
      // Record verification
      const verification = await this.prisma.verification.create({
        data: {
          proofId: proof.id,
          referenceId: proof.referenceId,
          verifierAddress: params.verifierAddress,
          isSuccessful: isValid,
          failureReason: isValid ? null : 'Proof verification failed',
          verificationResult: {
            isValid,
            proofType: proof.proofType,
            createdAt: proof.createdAt,
            expiresAt: proof.expiresAt,
            currentBalance,
            threshold: proofData.threshold,
            maxAmount: proofData.maxAmount,
            exactAmount: proofData.exactAmount,
            message: proofData.message,
            warningFlags: proof.warningFlags
          }
        }
      });
      
      // Log verification result
      await auditLogger.info(
        'proof.verification.complete', 
        {
          referenceId: params.referenceId,
          verificationId: verification.id,
          isValid
        }, 
        context
      );
      
      return verification.verificationResult as VerificationResult;
      
    } catch (error) {
      // Log error
      await auditLogger.error(
        'proof.verification.error', 
        { 
          error: error instanceof Error ? error.message : String(error),
          referenceId: params.referenceId
        }, 
        context
      );
      
      throw error;
    }
  }
  
  /**
   * Get transaction history for a wallet
   */
  async getTransactionHistory(
    address: string, 
    chainId: number, 
    limit: number = 10
  ): Promise<any[]> {
    try {
      return await this.transactionProcessor.getTransactionHistory(address, chainId, limit);
    } catch (error) {
      console.error(`Failed to get transaction history for ${address}:`, error);
      return [];
    }
  }
  
  /**
   * Clean up resources on shutdown
   */
  async shutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}