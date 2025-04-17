/**
 * Proof Management Module
 * 
 * Provides administrative functionality for managing ZK proofs,
 * including creation, validation, and archiving.
 */

import { SystemConfiguration } from './SystemConfiguration.js';
import { ZKErrorLogger } from '../zkErrorLogger.js';

// Create a logger instance
const logger = new ZKErrorLogger({
  logLevel: 'info',
  privacyLevel: 'internal'
});

/**
 * Proof status enum
 */
export enum ProofStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
  EXPIRED = 'expired'
}

/**
 * Proof type enum
 */
export enum ProofType {
  STANDARD = 'standard',
  THRESHOLD = 'threshold',
  MAXIMUM = 'maximum',
  COMPOSITE = 'composite'
}

/**
 * Interface for proof metadata
 */
export interface ProofMetadata {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  status: ProofStatus;
  type: ProofType;
  version: string;
  expiresAt?: Date;
  tags?: string[];
  isPublic: boolean;
  verificationCount: number;
  lastVerifiedAt?: Date;
}

/**
 * Interface for proof search filters
 */
export interface ProofSearchFilters {
  userId?: string;
  status?: ProofStatus[];
  type?: ProofType[];
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  isPublic?: boolean;
  keyword?: string;
}

/**
 * Proof verification result
 */
export interface ProofVerificationResult {
  proofId: string;
  isValid: boolean;
  verifiedBy: string;
  verifiedAt: Date;
  details?: Record<string, any>;
}

/**
 * Proof statistics interface
 */
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
  creationTrend: Array<{ date: Date; count: number }>;
}

/**
 * Handles proof management operations
 */
export class ProofManagement {
  private systemConfig: SystemConfiguration;
  private proofs: Map<string, ProofMetadata> = new Map();

  /**
   * Creates a new ProofManagement instance
   * 
   * @param systemConfig System configuration instance
   */
  constructor(systemConfig: SystemConfiguration) {
    this.systemConfig = systemConfig;

    // Initialize with example data in development mode
    if (process.env.NODE_ENV === 'development') {
      this.initializeExampleProofs();
    }
  }

  /**
   * Creates a new proof
   * 
   * @param userId ID of user creating the proof
   * @param title Proof title
   * @param description Proof description
   * @param type Proof type
   * @param isPublic Whether the proof is public
   * @param tags Optional tags
   * @returns The created proof metadata
   */
  public createProof(
    userId: string,
    title: string,
    description: string | undefined,
    type: ProofType,
    isPublic: boolean,
    tags?: string[]
  ): ProofMetadata {
    // Validate inputs
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!title) {
      throw new Error('Title is required');
    }
    if (!Object.values(ProofType).includes(type)) {
      throw new Error(`Invalid proof type: ${type}`);
    }

    // Create unique ID
    const timestamp = new Date();
    const id = `proof_${timestamp.getTime()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create proof metadata
    const proofMetadata: ProofMetadata = {
      id,
      title,
      description,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: userId,
      status: ProofStatus.DRAFT,
      type,
      version: '1.0.0', // Use hardcoded version until SystemConfiguration is implemented
      tags: tags || [],
      isPublic,
      verificationCount: 0
    };

    // Save proof
    this.proofs.set(id, proofMetadata);

    // Log the creation
    logger.info(`Proof created: ${id}`, {
      userId,
      proofId: id,
      proofType: type
    });

    return proofMetadata;
  }

  /**
   * Updates proof metadata
   * 
   * @param proofId ID of the proof to update
   * @param userId ID of user making the update
   * @param updates Updates to apply
   * @returns The updated proof metadata
   */
  public updateProof(
    proofId: string,
    userId: string,
    updates: Partial<Pick<ProofMetadata, 'title' | 'description' | 'tags' | 'isPublic'>>
  ): ProofMetadata {
    // Validate inputs
    if (!proofId) {
      throw new Error('Proof ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get existing proof
    const proof = this.proofs.get(proofId);
    if (!proof) {
      throw new Error(`Proof not found: ${proofId}`);
    }

    // Check if user is allowed to update
    if (proof.createdBy !== userId && !this.isAdmin(userId)) {
      throw new Error('User is not authorized to update this proof');
    }

    // Apply updates
    const updatedProof = {
      ...proof,
      ...updates,
      updatedAt: new Date()
    };

    // Save updated proof
    this.proofs.set(proofId, updatedProof);

    // Log the update
    logger.info(`Proof updated: ${proofId}`, {
      userId,
      proofId
    });

    return updatedProof;
  }

  /**
   * Updates proof status
   * 
   * @param proofId ID of the proof
   * @param userId ID of user changing status
   * @param status New status
   * @returns The updated proof metadata
   */
  public updateProofStatus(
    proofId: string,
    userId: string,
    status: ProofStatus
  ): ProofMetadata {
    // Validate inputs
    if (!proofId) {
      throw new Error('Proof ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!Object.values(ProofStatus).includes(status)) {
      throw new Error(`Invalid proof status: ${status}`);
    }

    // Get existing proof
    const proof = this.proofs.get(proofId);
    if (!proof) {
      throw new Error(`Proof not found: ${proofId}`);
    }

    // Check if user is allowed to update status
    const isOwner = proof.createdBy === userId;
    const isAdmin = this.isAdmin(userId);

    if (!isOwner && !isAdmin) {
      throw new Error('User is not authorized to update this proof status');
    }

    // Some status changes are restricted to admins
    const restrictedStatusChanges = [
      ProofStatus.VERIFIED,
      ProofStatus.REJECTED,
      ProofStatus.ARCHIVED
    ];

    if (restrictedStatusChanges.includes(status) && !isAdmin) {
      throw new Error(`Only administrators can set proof status to ${status}`);
    }

    // Apply update
    const updatedProof = {
      ...proof,
      status,
      updatedAt: new Date()
    };

    // If verifying, update verification stats
    if (status === ProofStatus.VERIFIED) {
      updatedProof.verificationCount += 1;
      updatedProof.lastVerifiedAt = new Date();
    }

    // Save updated proof
    this.proofs.set(proofId, updatedProof);

    // Log the status change
    logger.info(`Proof status changed: ${proofId} -> ${status}`, {
      userId,
      proofId,
      oldStatus: proof.status,
      newStatus: status
    });

    return updatedProof;
  }

  /**
   * Gets a proof by ID
   * 
   * @param proofId ID of the proof
   * @param userId ID of user making the request
   * @returns The proof metadata or null if not found
   */
  public getProof(proofId: string, userId: string): ProofMetadata | null {
    // Validate inputs
    if (!proofId) {
      throw new Error('Proof ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get proof
    const proof = this.proofs.get(proofId);
    if (!proof) {
      return null;
    }

    // Check access
    const isOwner = proof.createdBy === userId;
    const isAdmin = this.isAdmin(userId);
    const isPublic = proof.isPublic;

    if (!isOwner && !isAdmin && !isPublic) {
      logger.warn(`Unauthorized proof access attempt: ${proofId}`, {
        userId,
        proofId
      });
      return null;
    }

    // Log access
    logger.info(`Proof accessed: ${proofId}`, {
      userId,
      proofId
    });

    return proof;
  }
  
  /**
   * Gets a proof by ID for administrative purposes
   * This is a special method for admin interfaces where userId validation is handled separately
   * 
   * @param proofId ID of the proof to retrieve
   * @returns The proof metadata or null if not found
   */
  public getProofById(proofId: string): ProofMetadata | null {
    // Validate inputs
    if (!proofId) {
      throw new Error('Proof ID is required');
    }

    // Get proof
    const proof = this.proofs.get(proofId);
    if (!proof) {
      return null;
    }

    // Log admin access
    logger.info(`Admin accessed proof: ${proofId}`, {
      proofId,
      access: 'admin'
    });

    return proof;
  }
  
  /**
   * Finds proofs based on criteria
   * 
   * @param criteria Search criteria
   * @param options Pagination and sorting options
   * @returns Array of matching proofs
   */
  public findProofs(
    criteria: {
      ids?: string[];
      statuses?: ProofStatus[];
      types?: ProofType[];
      userIds?: string[];
      keywords?: string[];
      tags?: string[];
      fromDate?: Date;
      toDate?: Date;
      isPublic?: boolean;
    },
    options: {
      limit?: number;
      offset?: number;
      sortBy?: keyof ProofMetadata;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): { proofs: ProofMetadata[]; total: number } {
    // Get all proofs
    const allProofs = Array.from(this.proofs.values());
    
    // Apply filters
    const filteredProofs = allProofs.filter(proof => {
      // Filter by IDs
      if (criteria.ids && criteria.ids.length > 0 && !criteria.ids.includes(proof.id)) {
        return false;
      }
      
      // Filter by statuses
      if (criteria.statuses && criteria.statuses.length > 0 && !criteria.statuses.includes(proof.status)) {
        return false;
      }
      
      // Filter by types
      if (criteria.types && criteria.types.length > 0 && !criteria.types.includes(proof.type)) {
        return false;
      }
      
      // Filter by user IDs
      if (criteria.userIds && criteria.userIds.length > 0 && !criteria.userIds.includes(proof.createdBy)) {
        return false;
      }
      
      // Filter by tags
      if (criteria.tags && criteria.tags.length > 0) {
        const proofTags = proof.tags || [];
        const hasAnyTag = criteria.tags.some(tag => proofTags.includes(tag));
        if (!hasAnyTag) {
          return false;
        }
      }
      
      // Filter by date range
      if (criteria.fromDate && proof.createdAt < criteria.fromDate) {
        return false;
      }
      if (criteria.toDate && proof.createdAt > criteria.toDate) {
        return false;
      }
      
      // Filter by visibility
      if (criteria.isPublic !== undefined && proof.isPublic !== criteria.isPublic) {
        return false;
      }
      
      // Filter by keywords (in title, description, tags)
      if (criteria.keywords && criteria.keywords.length > 0) {
        const proofText = [
          proof.title,
          proof.description || '',
          ...(proof.tags || [])
        ].join(' ').toLowerCase();
        
        const hasAnyKeyword = criteria.keywords.some(keyword => 
          proofText.includes(keyword.toLowerCase())
        );
        
        if (!hasAnyKeyword) {
          return false;
        }
      }
      
      return true;
    });
    
    // Get total count before pagination
    const total = filteredProofs.length;
    
    // Sort if requested
    if (options.sortBy) {
      filteredProofs.sort((a, b) => {
        const aValue = a[options.sortBy as keyof ProofMetadata];
        const bValue = b[options.sortBy as keyof ProofMetadata];
        
        // Handle different types of values
        let comparison = 0;
        if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
          comparison = aValue === bValue ? 0 : (aValue ? 1 : -1);
        }
        
        // Apply sort order
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }
    
    // Apply pagination if requested
    let paginatedProofs = filteredProofs;
    if (options.limit !== undefined) {
      const offset = options.offset || 0;
      paginatedProofs = filteredProofs.slice(offset, offset + options.limit);
    }
    
    // Log the operation
    logger.info(`Found ${paginatedProofs.length} proofs matching criteria (total: ${total})`, {
      operation: 'findProofs',
      filters: Object.keys(criteria).length,
      total
    });
    
    return {
      proofs: paginatedProofs,
      total
    };
  }
  
  /**
   * Invalidates a proof
   * 
   * @param proofId ID of the proof to invalidate
   * @param userId ID of user performing the invalidation (must be admin)
   * @param reason Reason for invalidation
   * @returns The updated proof metadata
   */
  public invalidateProof(
    proofId: string,
    userId: string,
    reason: string
  ): ProofMetadata {
    // Validate inputs
    if (!proofId) {
      throw new Error('Proof ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    // Check admin privileges
    if (!this.isAdmin(userId)) {
      throw new Error('Only administrators can invalidate proofs');
    }
    
    // Get existing proof
    const proof = this.proofs.get(proofId);
    if (!proof) {
      throw new Error(`Proof not found: ${proofId}`);
    }
    
    // Update status to REJECTED
    const updatedProof = {
      ...proof,
      status: ProofStatus.REJECTED,
      updatedAt: new Date()
    };
    
    // Save updated proof
    this.proofs.set(proofId, updatedProof);
    
    // Log the invalidation
    logger.info(`Proof invalidated: ${proofId}`, {
      userId,
      proofId,
      reason,
      oldStatus: proof.status,
      newStatus: ProofStatus.REJECTED
    });
    
    return updatedProof;
  }

  /**
   * Searches for proofs based on filters
   * 
   * @param userId ID of user making the request
   * @param filters Search filters
   * @returns Array of matching proof metadata
   */
  public searchProofs(userId: string, filters: ProofSearchFilters): ProofMetadata[] {
    // Validate inputs
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get all proofs
    const allProofs = Array.from(this.proofs.values());

    // Apply access filter
    const isAdmin = this.isAdmin(userId);
    const accessibleProofs = isAdmin
      ? allProofs // Admins can see all proofs
      : allProofs.filter(proof =>
        proof.createdBy === userId || // User's own proofs
        proof.isPublic // Public proofs
      );

    // Apply provided filters
    return accessibleProofs.filter(proof => {
      // Filter by user ID
      if (filters.userId && proof.createdBy !== filters.userId) {
        return false;
      }

      // Filter by status
      if (filters.status && filters.status.length > 0 && !filters.status.includes(proof.status)) {
        return false;
      }

      // Filter by type
      if (filters.type && filters.type.length > 0 && !filters.type.includes(proof.type)) {
        return false;
      }

      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        const proofTags = proof.tags || [];
        const hasAllTags = filters.tags.every(tag => proofTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      // Filter by date range
      if (filters.startDate && proof.createdAt < filters.startDate) {
        return false;
      }
      if (filters.endDate && proof.createdAt > filters.endDate) {
        return false;
      }

      // Filter by visibility
      if (filters.isPublic !== undefined && proof.isPublic !== filters.isPublic) {
        return false;
      }

      // Filter by keyword
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        const title = (proof.title || '').toLowerCase();
        const description = (proof.description || '').toLowerCase();
        const tags = (proof.tags || []).join(' ').toLowerCase();

        if (!title.includes(keyword) && !description.includes(keyword) && !tags.includes(keyword)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Deletes a proof
   * 
   * @param proofId ID of the proof to delete
   * @param userId ID of user requesting deletion
   * @returns Whether the deletion was successful
   */
  public deleteProof(proofId: string, userId: string): boolean {
    // Validate inputs
    if (!proofId) {
      throw new Error('Proof ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get proof
    const proof = this.proofs.get(proofId);
    if (!proof) {
      return false;
    }

    // Check if user is allowed to delete
    const isOwner = proof.createdBy === userId;
    const isAdmin = this.isAdmin(userId);

    if (!isOwner && !isAdmin) {
      logger.warn(`Unauthorized proof deletion attempt: ${proofId}`, {
        userId,
        proofId
      });
      throw new Error('User is not authorized to delete this proof');
    }

    // Delete proof
    const deleted = this.proofs.delete(proofId);

    // Log the deletion
    if (deleted) {
      logger.info(`Proof deleted: ${proofId}`, {
        userId,
        proofId
      });
    }

    return deleted;
  }

  /**
   * Checks if a user is an admin
   * 
   * @param userId User ID to check
   * @returns Whether the user is an admin
   * @private
   */
  private isAdmin(userId: string): boolean {
    // In a real implementation, this would check against RBAC
    // For now, using hardcoded admin users
    const adminUsers = ['admin1', 'admin2', 'superuser'];
    return adminUsers.includes(userId);
  }

  /**
   * Initializes example proofs for development
   * @private
   */
  private initializeExampleProofs(): void {
    const proofTypes = [
      ProofType.STANDARD,
      ProofType.THRESHOLD,
      ProofType.MAXIMUM
    ];

    const users = ['admin1', 'user123', 'user456'];

    // Create some example proofs
    for (let i = 0; i < 10; i++) {
      const userId = users[i % users.length];
      const type = proofTypes[i % proofTypes.length];
      const isPublic = i % 2 === 0;

      this.createProof(
        userId,
        `Example Proof ${i + 1}`,
        `This is an example proof for testing purposes (#${i + 1})`,
        type,
        isPublic,
        [`tag${i % 5}`, 'example']
      );
    }

    // Set some proofs to different statuses
    const proofIds = Array.from(this.proofs.keys());
    if (proofIds.length >= 3) {
      this.updateProofStatus(proofIds[0], 'admin1', ProofStatus.VERIFIED);
      this.updateProofStatus(proofIds[1], 'admin1', ProofStatus.REJECTED);
      this.updateProofStatus(proofIds[2], 'admin1', ProofStatus.ARCHIVED);
    }
  }
}

// Singleton instance
let instance: ProofManagement | null = null;

/**
 * Gets the singleton instance of ProofManagement
 * 
 * @returns The ProofManagement singleton instance
 */
export function getInstance(): ProofManagement {
  if (!instance) {
    // Create instance with a default configuration
    const defaultConfig: SystemConfiguration = {
      id: 'default',
      version: 1,
      createdAt: new Date(),
      createdBy: 'system',
      settings: {
        siteName: 'ZK Proof System',
        siteDescription: 'Zero-Knowledge Proof Management System',
        proofValidity: {
          standard: 30,
          threshold: 15,
          maximum: 90,
          zk: 60
        },
        verification: {
          cacheResults: true,
          cacheLifetime: 24,
          verificationTimeout: 60
        },
        security: {
          userVerificationRequired: true,
          minPasswordLength: 8,
          twoFactorAuthEnabled: false,
          sessionTimeout: 30,
          rateLimiting: {
            maxRequests: 100,
            timeWindow: 60
          }
        },
        notifications: {
          emailNotifications: false,
          adminAlerts: true,
          securityAlerts: true
        },
        analytics: {
          enabled: false,
          anonymizeIpAddresses: true,
          retentionPeriod: 90
        }
      }
    };

    instance = new ProofManagement(defaultConfig);
  }
  return instance;
}

// Export singleton instance
export const proofManagement = getInstance();

// Export default for module compatibility
export default proofManagement;