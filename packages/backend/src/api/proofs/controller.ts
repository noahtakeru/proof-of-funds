/**
 * Proof Controller
 * 
 * Handles the creation and management of zero-knowledge proofs
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { prisma, transaction } from '@proof-of-funds/db';
import { ApiError } from '../../middleware/errorHandler';
import logger from '../../utils/logger';
import { encryptData, generateEncryptionKey } from '../../utils/crypto';
import config from '../../config';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { auditLogService } from '../../services/auditLogService';
import { AuditEventType, ActorType, AuditAction, AuditStatus, AuditSeverity } from '../../models/auditLog';

// Initialize Secret Manager client if GCP integration is enabled
const secretManager = config.gcp.secretManager.enabled
  ? new SecretManagerServiceClient()
  : null;

/**
 * Generate a zero-knowledge proof
 */
export const generateProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proofType, input } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    if (!proofType || !input) {
      throw new ApiError(400, 'Proof type and input are required', 'MISSING_PARAMETERS');
    }

    // Validate proof type
    const validProofTypes = ['STANDARD', 'THRESHOLD', 'MAXIMUM', 'ZERO_KNOWLEDGE'];
    if (!validProofTypes.includes(proofType)) {
      throw new ApiError(400, `Invalid proof type. Must be one of: ${validProofTypes.join(', ')}`, 'INVALID_PROOF_TYPE');
    }

    // Generate a unique reference ID
    const referenceId = `ref-${uuidv4()}`;

    // Set expiration date (default 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    try {
      // Import snarkjs dynamically to avoid frontend issues
      const snarkjs = require('snarkjs');

      // Determine circuit paths based on proof type
      const circuitName = proofType.toLowerCase().replace('_', '') + 'Proof';
      const wasmPath = path.join(config.zkProof.circuitPaths[proofType.toLowerCase() as keyof typeof config.zkProof.circuitPaths], '.wasm');
      const zkeyPath = path.join(config.zkProof.circuitPaths[proofType.toLowerCase() as keyof typeof config.zkProof.circuitPaths], '.zkey');

      // Check if circuit files exist
      if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        throw new ApiError(500, 'ZK circuit files not found', 'CIRCUIT_NOT_FOUND');
      }

      // Generate proof
      logger.info('Generating ZK proof', { proofType, userId });
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

      // Encrypt the proof data
      const encryptionKey = generateEncryptionKey();
      const proofData = {
        proof,
        publicSignals,
        input,
        proofType,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        userId
      };

      const encryptedData = encryptData(proofData, encryptionKey);

      // Store encryption key securely
      let encryptionKeyId = '';
      if (secretManager) {
        // Store key in GCP Secret Manager
        const keyId = `proof-key-${uuidv4()}`;
        const parent = `projects/${config.gcp.projectId}`;
        
        const [secret] = await secretManager.createSecret({
          parent,
          secretId: keyId,
          secret: {
            replication: {
              automatic: {}
            }
          }
        });
        
        await secretManager.addSecretVersion({
          parent: secret.name,
          payload: {
            data: encryptionKey
          }
        });
        
        encryptionKeyId = keyId;
      } else {
        // Store locally (not recommended for production)
        encryptionKeyId = `local-${uuidv4()}`;
        // In a real implementation, this would be stored securely
      }

      // Create temporary wallet for proof submission
      const tempWallet = await prisma.wallet.create({
        data: {
          id: uuidv4(),
          userId,
          address: `0x${uuidv4().replace(/-/g, '')}`,
          chainId: 137, // Polygon
          type: 'TEMPORARY',
          createdAt: new Date(),
          lastUsedAt: new Date()
        }
      });

      // Store proof in database
      const proofRecord = await prisma.proof.create({
        data: {
          id: uuidv4(),
          userId,
          referenceId,
          createdAt: new Date(),
          expiresAt,
          proofType: proofType as any,
          encryptedData,
          encryptionKeyId,
          tempWalletId: tempWallet.id,
          warningFlags: [],
          originalWallets: input.wallets || [],
          status: 'PENDING'
        }
      });

      // Log proof generation success
      await auditLogService.log({
        eventType: AuditEventType.PROOF_GENERATE,
        actorType: ActorType.USER,
        actorId: userId,
        action: AuditAction.CREATE,
        status: AuditStatus.SUCCESS,
        resourceType: 'proof',
        resourceId: proofRecord.id,
        details: {
          proofType,
          referenceId,
          tempWalletId: tempWallet.id
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.INFO
      });

      // Return success response
      res.status(201).json({
        success: true,
        referenceId,
        proofId: proofRecord.id,
        expiresAt,
        proofType,
        decryptionKey: encryptionKey.toString('hex') // Only for demonstration, would be handled differently in production
      });
    } catch (error) {
      logger.error('ZK proof generation error', { error, proofType, userId });
      
      // Log proof generation failure
      await auditLogService.log({
        eventType: AuditEventType.PROOF_GENERATE,
        actorType: ActorType.USER,
        actorId: userId,
        action: AuditAction.CREATE,
        status: AuditStatus.FAILURE,
        resourceType: 'proof',
        details: {
          proofType,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: AuditSeverity.ERROR
      });
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, 'Error generating ZK proof', 'PROOF_GENERATION_ERROR', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get proofs for authenticated user
 */
export const getUserProofs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    // Pagination parameters
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const offset = (page - 1) * limit;

    // Status filter
    const status = req.query.status as string;
    const proofType = req.query.type as string;

    // Build query
    const where: any = { userId };
    if (status) {
      where.status = status;
    }
    if (proofType) {
      where.proofType = proofType;
    }

    // Get total count
    const totalCount = await prisma.proof.count({ where });

    // Get proofs with pagination
    const proofs = await prisma.proof.findMany({
      where,
      select: {
        id: true,
        referenceId: true,
        createdAt: true,
        expiresAt: true,
        proofType: true,
        status: true,
        isRevoked: true,
        revokedAt: true,
        warningFlags: true,
        originalWallets: true,
        transactionHash: true
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    // Return proofs with pagination metadata
    res.status(200).json({
      proofs,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke a proof
 */
export const revokeProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proofId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    // Find the proof
    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      select: { id: true, userId: true, status: true, isRevoked: true }
    });

    // Check if proof exists and belongs to user
    if (!proof) {
      throw new ApiError(404, 'Proof not found', 'PROOF_NOT_FOUND');
    }

    if (proof.userId !== userId) {
      throw new ApiError(403, 'Not authorized to revoke this proof', 'UNAUTHORIZED');
    }

    // Check if proof is already revoked
    if (proof.isRevoked) {
      throw new ApiError(400, 'Proof is already revoked', 'ALREADY_REVOKED');
    }

    // Revoke the proof
    const updatedProof = await prisma.proof.update({
      where: { id: proofId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revocationReason: reason,
        status: 'REVOKED'
      },
      select: {
        id: true,
        referenceId: true,
        status: true,
        isRevoked: true,
        revokedAt: true
      }
    });

    // Log proof revocation
    await auditLogService.log({
      eventType: AuditEventType.PROOF_REVOKE,
      actorType: ActorType.USER,
      actorId: userId,
      action: AuditAction.REVOKE,
      status: AuditStatus.SUCCESS,
      resourceType: 'proof',
      resourceId: proofId,
      details: {
        referenceId: updatedProof.referenceId,
        reason: reason || 'No reason provided'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: AuditSeverity.INFO
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Proof successfully revoked',
      proof: updatedProof
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get proof details
 */
export const getProofDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proofId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    // Find the proof
    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      select: {
        id: true,
        referenceId: true,
        createdAt: true,
        expiresAt: true,
        proofType: true,
        status: true,
        isRevoked: true,
        revokedAt: true,
        revocationReason: true,
        warningFlags: true,
        originalWallets: true,
        transactionHash: true,
        merkleRoot: true,
        userId: true,
        tempWallet: {
          select: {
            address: true,
            chainId: true
          }
        },
        verifications: {
          select: {
            id: true,
            verifierAddress: true,
            verifiedAt: true,
            isSuccessful: true
          },
          orderBy: {
            verifiedAt: 'desc'
          },
          take: 5
        }
      }
    });

    // Check if proof exists and belongs to user
    if (!proof) {
      throw new ApiError(404, 'Proof not found', 'PROOF_NOT_FOUND');
    }

    if (proof.userId !== userId) {
      throw new ApiError(403, 'Not authorized to view this proof', 'UNAUTHORIZED');
    }

    // Remove sensitive fields
    const { userId: _, ...safeProof } = proof;

    // Return proof details
    res.status(200).json(safeProof);
  } catch (error) {
    next(error);
  }
};