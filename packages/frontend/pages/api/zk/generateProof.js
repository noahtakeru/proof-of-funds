/**
 * API endpoint for generating ZK proofs
 * 
 * This handles the server-side generation of Zero-Knowledge proofs using real ZK circuits.
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
    
    // Build paths to circuit files
    const circuitName = `${proofType}Proof`;
    const wasmPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${circuitName}.wasm`);
    const zkeyPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${circuitName}.zkey`);
    
    // Verify that circuit files exist
    if (!fs.existsSync(wasmPath)) {
      return res.status(500).json({
        error: 'Circuit WASM file not found',
        errorType: 'CIRCUIT_ERROR',
        details: { wasmPath }
      });
    }
    
    if (!fs.existsSync(zkeyPath)) {
      return res.status(500).json({
        error: 'Circuit zkey file not found',
        errorType: 'CIRCUIT_ERROR',
        details: { zkeyPath }
      });
    }
    
    try {
      // Generate proof
      console.log(`Generating proof for type ${proofType} with input:`, input);
      const { proof, publicSignals } = await snarkjsWrapper.fullProve(input, wasmPath, zkeyPath);
      
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
          zkeyPath,
          inputKeys: Object.keys(input)
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