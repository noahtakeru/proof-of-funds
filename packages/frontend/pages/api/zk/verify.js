/**
 * API endpoint for verifying ZK proofs
 * 
 * This handles the server-side verification of Zero-Knowledge proofs using real ZK circuits.
 * Part of the ZK Proof Execution Plan implementation.
 */

import snarkjsWrapper from '@proof-of-funds/common/src/zk-core/snarkjsWrapper';
import path from 'path';
import fs from 'fs';
import { handleApiError } from '../../../utils/apiErrorHandler';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { proofType, proof, publicSignals } = req.body;
    
    if (!proofType || !proof || !publicSignals) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'proofType, proof, and publicSignals are required'
      });
    }
    
    // Validate proof type
    const validProofTypes = ['standard', 'threshold', 'maximum'];
    if (!validProofTypes.includes(proofType)) {
      return res.status(400).json({ 
        error: 'Invalid proof type',
        details: `Proof type must be one of: ${validProofTypes.join(', ')}`
      });
    }
    
    // Build path to verification key
    const circuitName = `${proofType}Proof`;
    const vkeyPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${circuitName}.vkey.json`);
    
    // Verify that verification key exists
    if (!fs.existsSync(vkeyPath)) {
      return res.status(500).json({
        error: 'Verification key file not found',
        errorType: 'CIRCUIT_ERROR',
        details: { vkeyPath }
      });
    }
    
    try {
      // Read verification key
      const vkeyJson = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
      
      // Verify proof
      console.log(`Verifying proof for type ${proofType}`);
      const verified = await snarkjsWrapper.verify(vkeyJson, publicSignals, proof);
      
      return res.status(200).json({
        success: true,
        verified,
        proofType
      });
    } catch (zkError) {
      console.error('ZK proof verification error:', zkError);
      return res.status(400).json({
        error: 'ZK proof verification failed',
        errorType: 'ZK_ERROR',
        message: zkError.message,
        details: {
          proofType,
          vkeyPath
        }
      });
    }
  } catch (error) {
    return handleApiError ? 
      handleApiError(error, res) : 
      res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message 
      });
  }
}