/**
 * API endpoint for verifying ZK proofs
 * 
 * This handles the server-side verification of Zero-Knowledge proofs using real ZK circuits.
 * Part of the ZK Proof Execution Plan implementation.
 */

import snarkjsWrapper from '@proof-of-funds/common/zk-core/snarkjsWrapper';
import path from 'path';
import fs from 'fs';
import { handleApiError } from '../../../utils/apiErrorHandler';
import { VerificationResultFormatter } from '../../../services';

export default async function handler(req, res) {
  const formatter = new VerificationResultFormatter();
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(
      formatter.formatError(
        'unknown',
        'METHOD_ERROR',
        'Method not allowed'
      )
    );
  }

  try {
    const { proofType, proof, publicSignals, wallet, amount, tokenSymbol } = req.body;
    
    if (!proofType || !proof || !publicSignals) {
      return res.status(400).json(
        formatter.formatError(
          proofType || 'unknown',
          'VALIDATION_ERROR',
          'Missing required parameters',
          { missingParams: ['proofType', 'proof', 'publicSignals'].filter(p => !req.body[p]) }
        )
      );
    }
    
    // Validate proof type
    const validProofTypes = ['standard', 'threshold', 'maximum'];
    if (!validProofTypes.includes(proofType)) {
      return res.status(400).json(
        formatter.formatError(
          proofType,
          'VALIDATION_ERROR',
          `Invalid proof type. Must be one of: ${validProofTypes.join(', ')}`,
          { proofType, validProofTypes }
        )
      );
    }
    
    // Build path to verification key
    const circuitName = `${proofType}Proof`;
    const vkeyPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${circuitName}.vkey.json`);
    
    // Verify that verification key exists
    if (!fs.existsSync(vkeyPath)) {
      return res.status(500).json(
        formatter.formatError(
          proofType,
          'CIRCUIT_ERROR',
          'Verification key file not found',
          { vkeyPath }
        )
      );
    }
    
    try {
      // Start timing the verification
      const startTime = Date.now();
      
      // Read verification key
      const vkeyJson = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
      
      // Verify proof
      const verified = await snarkjsWrapper.verify(vkeyJson, publicSignals, proof);
      
      // Calculate verification time
      const verificationTime = Date.now() - startTime;
      
      // Create metadata
      const metadata = {
        proofHash: proof.pi_a?.join?.('_') || JSON.stringify(proof).slice(0, 32),
        expiryTime: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
        circuit: circuitName
      };
      
      // Format proof data
      const proofData = {
        wallet,
        amount,
        tokenSymbol,
        publicInputs: publicSignals,
        circuit: circuitName
      };
      
      if (verified) {
        // Format successful result
        const result = formatter.formatSuccess(
          proofType,
          proofData,
          metadata,
          verificationTime
        );
        
        return res.status(200).json(result);
      } else {
        // Format failure result
        const result = formatter.formatFailure(
          proofType,
          'VERIFICATION_FAILED',
          'Proof verification failed',
          proofData,
          { vkeyPath },
          metadata,
          verificationTime
        );
        
        return res.status(400).json(result);
      }
    } catch (zkError) {
      console.error('ZK proof verification error:', zkError);
      
      return res.status(400).json(
        formatter.formatError(
          proofType,
          'ZK_ERROR',
          zkError.message || 'ZK proof verification failed',
          {
            proofType,
            vkeyPath,
            error: zkError.toString()
          }
        )
      );
    }
  } catch (error) {
    if (handleApiError) {
      return handleApiError(error, res);
    } else {
      return res.status(500).json(
        formatter.formatError(
          req.body?.proofType || 'unknown',
          'SERVER_ERROR',
          error.message || 'Internal server error',
          { stack: error.stack }
        )
      );
    }
  }
}