/**
 * Secure proof generation endpoint using Google Cloud Secret Manager
 * This replaces the public zkey file access with secure cloud storage
 */

import ZKeyManager from '@proof-of-funds/backend/utils/zkeyManager';
import path from 'path';
import { handleApiError } from '../../../utils/apiErrorHandler';

const zkeyManager = new ZKeyManager();

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { proofType, input } = req.body;
    
    if (!proofType || !input) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'proofType and input are required'
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
    
    // Build path to WASM file (these can remain public)
    const circuitName = `${proofType}Proof`;
    const wasmPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${circuitName}.wasm`);
    
    try {
      // Generate proof using secure zkey from Google Cloud
      const { proof, publicSignals } = await zkeyManager.generateProof(
        proofType,
        input,
        wasmPath
      );
      
      return res.status(200).json({
        success: true,
        proofType,
        proof,
        publicSignals
      });
    } catch (zkError) {
      console.error('ZK proof generation error:', zkError);
      return res.status(400).json({
        error: 'ZK proof generation failed',
        errorType: 'ZK_ERROR',
        message: zkError.message,
        details: {
          proofType,
          wasmPath,
          inputKeys: Object.keys(input)
        }
      });
    }
  } catch (error) {
    return handleApiError(error, res);
  }
}