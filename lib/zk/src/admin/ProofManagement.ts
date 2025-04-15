/**
 * Admin Proof Management System
 * 
 * This module provides comprehensive proof management functionality for the admin dashboard,
 * including proof searching, verification, invalidation, and analytics.
 * 
 * The implementation uses the Role-Based Access Control (RBAC) system to enforce
 * access controls based on user roles and permissions.
 */

import { rbacSystem, Permission, Role } from './RoleBasedAccessControl';
import { zkErrorLogger } from '../zkErrorLogger.mjs';

// PoF (Proof of Funds) interface
export interface ProofOfFunds {
  id: string;
  proofHash: string;
  proofType: 'standard' | 'threshold' | 'maximum' | 'zk';
  walletAddress: string;
  network: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'valid' | 'expired' | 'invalidated' | 'pending';
  verificationStatus: 'verified' | 'unverified' | 'failed';
  verificationCount: number;
  lastVerifiedAt?: Date;
  invalidatedReason?: string;
  invalidatedBy?: string;
  invalidatedAt?: Date;
  metadata?: Record<string, any>;
  proof?: any;
  publicSignals?: any[];
}

// Proof search filters
export interface ProofSearchFilters {
  proofHash?: string;
  proofType?: 'standard' | 'threshold' | 'maximum' | 'zk';
  walletAddress?: string;
  network?: string;
  status?: 'valid' | 'expired' | 'invalidated' | 'pending';
  verificationStatus?: 'verified' | 'unverified' | 'failed';
  createdAfter?: Date;
  createdBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
}

// Proof verification result
export interface ProofVerificationResult {
  proofId: string;
  isValid: boolean;
  verifiedBy: string;
  verifiedAt: Date;
  details?: any;
}

// Proof statistics interface
export interface ProofStatistics {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byNetwork: Record<string, number>;
  verificationCounts: {
    total: number;
    successful: number;
    failed: number;
  };
  validityPeriods: {
    averageDays: number;
    medianDays: number;
    maxDays: number;
    minDays: number;
  };
  creationTrend: Array<{
    date: Date;
    count: number;
  }>;
}

/**
 * Proof Management System
 */
export class ProofManagementSystem {
  private proofs: ProofOfFunds[] = [];
  
  constructor() {
    // Initialize with example proofs for development
    if (process.env.NODE_ENV === 'development') {
      this.initializeExampleProofs();
    }
  }
  
  /**
   * Find proofs by search criteria
   */
  public findProofs(
    filters: ProofSearchFilters,
    adminWalletAddress: string,
    pagination?: { skip: number; limit: number }
  ): { proofs: ProofOfFunds[]; total: number } | null {
    // Check if admin has permission to search proofs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.SEARCH_PROOFS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'search_proofs',
        targetResource: 'proofs',
        status: 'denied',
        details: { filters }
      });
      
      return null;
    }
    
    // Apply filters
    let filteredProofs = this.proofs.filter(proof => {
      if (filters.proofHash && !proof.proofHash.includes(filters.proofHash)) {
        return false;
      }
      
      if (filters.proofType && proof.proofType !== filters.proofType) {
        return false;
      }
      
      if (filters.walletAddress && 
          !proof.walletAddress.toLowerCase().includes(filters.walletAddress.toLowerCase())) {
        return false;
      }
      
      if (filters.network && proof.network !== filters.network) {
        return false;
      }
      
      if (filters.status && proof.status !== filters.status) {
        return false;
      }
      
      if (filters.verificationStatus && proof.verificationStatus !== filters.verificationStatus) {
        return false;
      }
      
      if (filters.createdAfter && proof.createdAt < filters.createdAfter) {
        return false;
      }
      
      if (filters.createdBefore && proof.createdAt > filters.createdBefore) {
        return false;
      }
      
      if (filters.expiresAfter && proof.expiresAt < filters.expiresAfter) {
        return false;
      }
      
      if (filters.expiresBefore && proof.expiresAt > filters.expiresBefore) {
        return false;
      }
      
      return true;
    });
    
    const total = filteredProofs.length;
    
    // Apply pagination if specified
    if (pagination) {
      filteredProofs = filteredProofs.slice(
        pagination.skip,
        pagination.skip + pagination.limit
      );
    }
    
    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    
    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'search_proofs',
      targetResource: 'proofs',
      status: 'success',
      details: {
        filters,
        resultCount: filteredProofs.length,
        totalCount: total
      }
    });
    
    return { proofs: filteredProofs, total };
  }
  
  /**
   * Get a proof by ID
   */
  public getProofById(
    proofId: string,
    adminWalletAddress: string
  ): ProofOfFunds | null {
    // Check if admin has permission to view proofs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_PROOFS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'view_proof',
        targetResource: proofId,
        status: 'denied'
      });
      
      return null;
    }
    
    const proof = this.proofs.find(p => p.id === proofId);
    
    if (!proof) {
      return null;
    }
    
    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    
    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'view_proof',
      targetResource: proofId,
      status: 'success'
    });
    
    return proof;
  }
  
  /**
   * Get proofs by wallet address
   */
  public getProofsByWallet(
    walletAddress: string,
    adminWalletAddress: string,
    pagination?: { skip: number; limit: number }
  ): { proofs: ProofOfFunds[]; total: number } | null {
    // Check if admin has permission to search proofs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.SEARCH_PROOFS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'search_proofs_by_wallet',
        targetResource: walletAddress,
        status: 'denied'
      });
      
      return null;
    }
    
    // Filter proofs by wallet address
    let filteredProofs = this.proofs.filter(
      p => p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
    
    const total = filteredProofs.length;
    
    // Apply pagination if specified
    if (pagination) {
      filteredProofs = filteredProofs.slice(
        pagination.skip,
        pagination.skip + pagination.limit
      );
    }
    
    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    
    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'search_proofs_by_wallet',
      targetResource: walletAddress,
      status: 'success',
      details: {
        resultCount: filteredProofs.length,
        totalCount: total
      }
    });
    
    return { proofs: filteredProofs, total };
  }
  
  /**
   * Verify a proof
   */
  public verifyProof(
    proofId: string,
    adminWalletAddress: string
  ): ProofVerificationResult | null {
    // Check if admin has permission to verify proofs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VERIFY_PROOF)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'verify_proof',
        targetResource: proofId,
        status: 'denied'
      });
      
      return null;
    }
    
    // Find the proof
    const proofIndex = this.proofs.findIndex(p => p.id === proofId);
    
    if (proofIndex === -1) {
      return null;
    }
    
    const proof = this.proofs[proofIndex];
    
    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    const adminId = adminRole?.userId || 'unknown';
    
    // Mock successful verification (in a real implementation, this would actually verify the proof)
    const isValid = true;
    const verificationResult: ProofVerificationResult = {
      proofId,
      isValid,
      verifiedBy: adminId,
      verifiedAt: new Date(),
      details: {
        verificationType: 'admin',
        verifierWallet: adminWalletAddress
      }
    };
    
    // Update the proof with verification result
    this.proofs[proofIndex] = {
      ...proof,
      verificationStatus: isValid ? 'verified' : 'failed',
      verificationCount: proof.verificationCount + 1,
      lastVerifiedAt: new Date()
    };
    
    // Log the action
    rbacSystem.logAction({
      userId: adminId,
      walletAddress: adminWalletAddress,
      action: 'verify_proof',
      targetResource: proofId,
      status: 'success',
      details: {
        isValid,
        verificationCount: proof.verificationCount + 1
      }
    });
    
    return verificationResult;
  }
  
  /**
   * Invalidate a proof
   */
  public invalidateProof(
    proofId: string,
    reason: string,
    adminWalletAddress: string
  ): boolean {
    // Check if admin has permission to invalidate proofs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.INVALIDATE_PROOF)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'invalidate_proof',
        targetResource: proofId,
        status: 'denied',
        details: { reason }
      });
      
      return false;
    }
    
    // Find the proof
    const proofIndex = this.proofs.findIndex(p => p.id === proofId);
    
    if (proofIndex === -1) {
      return false;
    }
    
    const proof = this.proofs[proofIndex];
    
    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    const adminId = adminRole?.userId || 'unknown';
    
    // Update the proof
    this.proofs[proofIndex] = {
      ...proof,
      status: 'invalidated',
      invalidatedReason: reason,
      invalidatedBy: adminId,
      invalidatedAt: new Date()
    };
    
    // Log the action
    rbacSystem.logAction({
      userId: adminId,
      walletAddress: adminWalletAddress,
      action: 'invalidate_proof',
      targetResource: proofId,
      status: 'success',
      details: { reason }
    });
    
    return true;
  }
  
  /**
   * Get proof statistics
   */
  public getProofStatistics(adminWalletAddress: string): ProofStatistics | null {
    // Check if admin has permission to view proofs
    if (!rbacSystem.hasPermission(adminWalletAddress, Permission.VIEW_PROOFS)) {
      rbacSystem.logAction({
        userId: 'unknown',
        walletAddress: adminWalletAddress,
        action: 'view_proof_statistics',
        targetResource: 'proofs',
        status: 'denied'
      });
      
      return null;
    }
    
    // Initialize counters
    const byType: Record<string, number> = {
      standard: 0,
      threshold: 0,
      maximum: 0,
      zk: 0
    };
    
    const byStatus: Record<string, number> = {
      valid: 0,
      expired: 0,
      invalidated: 0,
      pending: 0
    };
    
    const byNetwork: Record<string, number> = {};
    
    let totalVerifications = 0;
    let successfulVerifications = 0;
    let failedVerifications = 0;
    
    // Validity periods in days
    const validityPeriods: number[] = [];
    
    // Creation trend - last 30 days
    const now = new Date();
    const creationTrend: Array<{ date: Date; count: number }> = [];
    
    // Initialize creation trend for the last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      creationTrend.push({ date, count: 0 });
    }
    
    // Count proofs by various attributes
    for (const proof of this.proofs) {
      // Count by type
      byType[proof.proofType]++;
      
      // Count by status
      byStatus[proof.status]++;
      
      // Count by network
      if (byNetwork[proof.network]) {
        byNetwork[proof.network]++;
      } else {
        byNetwork[proof.network] = 1;
      }
      
      // Count verifications
      totalVerifications += proof.verificationCount;
      if (proof.verificationStatus === 'verified') {
        successfulVerifications++;
      } else if (proof.verificationStatus === 'failed') {
        failedVerifications++;
      }
      
      // Calculate validity period in days
      const validityMs = proof.expiresAt.getTime() - proof.createdAt.getTime();
      const validityDays = validityMs / (1000 * 60 * 60 * 24);
      validityPeriods.push(validityDays);
      
      // Update creation trend
      if (proof.createdAt >= creationTrend[0].date) {
        const dayIndex = Math.floor(
          (proof.createdAt.getTime() - creationTrend[0].date.getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        
        if (dayIndex >= 0 && dayIndex < creationTrend.length) {
          creationTrend[dayIndex].count++;
        }
      }
    }
    
    // Calculate validity period statistics
    let averageDays = 0;
    let medianDays = 0;
    let maxDays = 0;
    let minDays = Number.MAX_VALUE;
    
    if (validityPeriods.length > 0) {
      // Average
      averageDays = validityPeriods.reduce((sum, days) => sum + days, 0) / validityPeriods.length;
      
      // Median
      validityPeriods.sort((a, b) => a - b);
      const mid = Math.floor(validityPeriods.length / 2);
      medianDays = validityPeriods.length % 2 === 0
        ? (validityPeriods[mid - 1] + validityPeriods[mid]) / 2
        : validityPeriods[mid];
      
      // Max and min
      maxDays = Math.max(...validityPeriods);
      minDays = Math.min(...validityPeriods);
    }
    
    // Compile statistics
    const statistics: ProofStatistics = {
      total: this.proofs.length,
      byType,
      byStatus,
      byNetwork,
      verificationCounts: {
        total: totalVerifications,
        successful: successfulVerifications,
        failed: failedVerifications
      },
      validityPeriods: {
        averageDays,
        medianDays,
        maxDays,
        minDays: minDays === Number.MAX_VALUE ? 0 : minDays
      },
      creationTrend
    };
    
    // Get admin user info for logging
    const adminRole = rbacSystem.getUserRole(adminWalletAddress);
    
    // Log the action
    rbacSystem.logAction({
      userId: adminRole?.userId || 'unknown',
      walletAddress: adminWalletAddress,
      action: 'view_proof_statistics',
      targetResource: 'proofs',
      status: 'success'
    });
    
    return statistics;
  }
  
  /**
   * Initialize example proofs for development
   */
  private initializeExampleProofs(): void {
    // Generate example proofs for different types and statuses
    const proofTypes = ['standard', 'threshold', 'maximum', 'zk'] as const;
    const statuses = ['valid', 'expired', 'invalidated', 'pending'] as const;
    const verificationStatuses = ['verified', 'unverified', 'failed'] as const;
    const networks = ['ethereum', 'polygon', 'binance', 'optimism', 'arbitrum'];
    
    // Generate proofs with varying parameters
    for (let i = 0; i < 100; i++) {
      const proofType = proofTypes[Math.floor(Math.random() * proofTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const verificationStatus = verificationStatuses[Math.floor(Math.random() * verificationStatuses.length)];
      const network = networks[Math.floor(Math.random() * networks.length)];
      
      // Generate a random wallet address
      const walletAddress = `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
      
      // Generate random dates
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 90)); // Up to 90 days ago
      
      const expiresAt = new Date(createdAt);
      expiresAt.setDate(expiresAt.getDate() + 30 + Math.floor(Math.random() * 60)); // 30-90 days validity
      
      // Generate a proof hash
      const proofHash = `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 42)}`;
      
      // Create proof object
      const proof: ProofOfFunds = {
        id: `proof_${i + 1}`,
        proofHash,
        proofType,
        walletAddress,
        network,
        createdAt,
        expiresAt,
        status,
        verificationStatus,
        verificationCount: Math.floor(Math.random() * 10),
        metadata: {
          fundAmount: Math.floor(Math.random() * 1000000) / 100,
          currency: network === 'ethereum' ? 'ETH' : 
                   network === 'polygon' ? 'MATIC' : 
                   network === 'binance' ? 'BNB' : 'USDC'
        }
      };
      
      // Add last verified date if the proof has been verified
      if (proof.verificationCount > 0) {
        const lastVerifiedAt = new Date(createdAt);
        lastVerifiedAt.setDate(lastVerifiedAt.getDate() + Math.floor(Math.random() * 10)); // 0-10 days after creation
        proof.lastVerifiedAt = lastVerifiedAt;
      }
      
      // Add invalidation details if the proof has been invalidated
      if (status === 'invalidated') {
        proof.invalidatedReason = ['Fraudulent', 'Incorrect balance', 'Expired', 'User request'][Math.floor(Math.random() * 4)];
        proof.invalidatedBy = 'admin_user';
        
        const invalidatedAt = new Date(createdAt);
        invalidatedAt.setDate(invalidatedAt.getDate() + Math.floor(Math.random() * 20)); // 0-20 days after creation
        proof.invalidatedAt = invalidatedAt;
      }
      
      this.proofs.push(proof);
    }
  }
}

// Singleton instance management
let instance: ProofManagementSystem | null = null;

/**
 * Get the singleton instance of the Proof Management System
 */
export function getInstance(): ProofManagementSystem {
  if (!instance) {
    instance = new ProofManagementSystem();
  }
  return instance;
}

// Create a singleton instance
export const proofManagementSystem = getInstance();

// Export default for CommonJS compatibility
export default proofManagementSystem;