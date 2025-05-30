/**
 * Verification Controller
 * 
 * Handles the verification of proofs
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { prisma } from '@proof-of-funds/db';
import { ApiError } from '../../middleware/errorHandler';
import logger from '../../utils/logger';
import { decryptData } from '../../utils/crypto';
import config from '../../config';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Initialize Secret Manager client if GCP integration is enabled
const secretManager = config.gcp.secretManager.enabled
  ? new SecretManagerServiceClient()
  : null;

/**
 * Verify a proof using its reference ID
 */
export const verifyProof = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referenceId } = req.params;
    const { decryptionKey } = req.body;

    if (!referenceId) {
      throw new ApiError(400, 'Reference ID is required', 'MISSING_REFERENCE_ID');
    }

    if (!decryptionKey) {
      throw new ApiError(400, 'Decryption key is required', 'MISSING_DECRYPTION_KEY');
    }

    // Find the proof by reference ID
    const proof = await prisma.proof.findUnique({
      where: { referenceId },
      select: {
        id: true,
        referenceId: true,
        proofType: true,
        encryptedData: true,
        encryptionKeyId: true,
        isRevoked: true,
        expiresAt: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            address: true
          }
        }
      }
    });

    // Check if proof exists
    if (!proof) {
      throw new ApiError(404, 'Proof not found', 'PROOF_NOT_FOUND');
    }

    // Check if proof is not revoked
    if (proof.isRevoked) {
      throw new ApiError(400, 'Proof has been revoked', 'PROOF_REVOKED');
    }

    // Check if proof is expired
    if (proof.expiresAt < new Date()) {
      throw new ApiError(400, 'Proof has expired', 'PROOF_EXPIRED');
    }

    // Check if proof is confirmed
    if (proof.status !== 'CONFIRMED') {
      throw new ApiError(400, `Proof is in ${proof.status} state, not ready for verification`, 'PROOF_NOT_CONFIRMED');
    }

    try {
      // Convert decryption key from hex to buffer
      const keyBuffer = Buffer.from(decryptionKey, 'hex');
      
      // Decrypt the proof data
      const decryptedData = decryptData(proof.encryptedData, keyBuffer);
      
      // Import snarkjs dynamically to avoid frontend issues
      const snarkjs = require('snarkjs');
      
      // Determine circuit paths based on proof type
      const proofTypeKey = proof.proofType.toLowerCase() as keyof typeof config.zkProof.circuitPaths;
      const circuitPath = config.zkProof.circuitPaths[proofTypeKey];
      const vkeyPath = `${circuitPath}.vkey.json`;
      
      // Check if verification key exists
      if (!fs.existsSync(vkeyPath)) {
        throw new ApiError(500, 'Verification key not found', 'VKEY_NOT_FOUND');
      }
      
      // Load verification key
      const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
      
      // Verify the proof
      const isValid = await snarkjs.groth16.verify(
        vKey,
        decryptedData.publicSignals,
        decryptedData.proof
      );
      
      // Record the verification attempt
      const verification = await prisma.verification.create({
        data: {
          id: uuidv4(),
          proofId: proof.id,
          referenceId: proof.referenceId,
          verifierAddress: req.body.verifierAddress || null,
          verifiedAt: new Date(),
          isSuccessful: isValid,
          verificationResult: {
            isValid,
            proofType: proof.proofType,
            createdAt: proof.createdAt,
            expiresAt: proof.expiresAt,
            issuerAddress: proof.user.address,
            ...decryptedData.input
          }
        }
      });
      
      // Return verification result
      res.status(200).json({
        success: true,
        isValid,
        proofType: proof.proofType,
        createdAt: proof.createdAt,
        expiresAt: proof.expiresAt,
        verificationId: verification.id,
        input: decryptedData.input,
        // Only include the safe subset of data that should be viewable by verifier
        issuerAddress: proof.user.address
      });
    } catch (error) {
      logger.error('Proof verification error', { error, referenceId });
      
      // Create a record of failed verification
      await prisma.verification.create({
        data: {
          id: uuidv4(),
          proofId: proof.id,
          referenceId: proof.referenceId,
          verifierAddress: req.body.verifierAddress || null,
          verifiedAt: new Date(),
          isSuccessful: false,
          failureReason: error instanceof Error ? error.message : 'Unknown error',
          verificationResult: {
            isValid: false,
            proofType: proof.proofType,
            createdAt: proof.createdAt,
            expiresAt: proof.expiresAt,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      });
      
      throw new ApiError(400, 'Proof verification failed', 'VERIFICATION_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Check if a proof exists and its status
 */
export const checkProofStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referenceId } = req.params;

    if (!referenceId) {
      throw new ApiError(400, 'Reference ID is required', 'MISSING_REFERENCE_ID');
    }

    // Find the proof by reference ID
    const proof = await prisma.proof.findUnique({
      where: { referenceId },
      select: {
        proofType: true,
        isRevoked: true,
        expiresAt: true,
        status: true,
        createdAt: true
      }
    });

    // Check if proof exists
    if (!proof) {
      throw new ApiError(404, 'Proof not found', 'PROOF_NOT_FOUND');
    }

    // Return proof status
    res.status(200).json({
      exists: true,
      proofType: proof.proofType,
      status: proof.status,
      isRevoked: proof.isRevoked,
      isExpired: proof.expiresAt < new Date(),
      createdAt: proof.createdAt,
      expiresAt: proof.expiresAt
    });
  } catch (error) {
    next(error);
  }
};