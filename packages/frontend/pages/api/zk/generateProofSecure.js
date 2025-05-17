/**
 * Secure proof generation endpoint
 * This endpoint generates ZK proofs using secure key management
 */

const path = require('path');
const fs = require('fs').promises;
const { handleApiError } = require('../../../utils/apiErrorHandler');

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
        details: `Must be one of: ${validProofTypes.join(', ')}`
      });
    }

    // For now, use local files until cloud storage is fully configured
    // Get the circuit files
    const circuitDir = path.join(process.cwd(), 'circuits', proofType);
    const wasmPath = path.join(circuitDir, `${proofType}Proof_js`, `${proofType}Proof.wasm`);
    const zkeyPath = path.join(circuitDir, `${proofType}Proof.zkey`);
    const vkeyPath = path.join(circuitDir, `${proofType}Proof.vkey.json`);
    
    // Check if files exist
    try {
      await fs.access(wasmPath);
      await fs.access(zkeyPath);
      await fs.access(vkeyPath);
    } catch (error) {
      console.error(`Circuit files not found for ${proofType}:`, error);
      return res.status(500).json({ 
        error: 'Circuit files not found',
        details: `Missing circuit files for ${proofType} proof type`
      });
    }
    
    // Load snarkjs
    const snarkjs = require('snarkjs');
    
    // Generate the proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );
    
    // Load verification key
    const vKey = JSON.parse(await fs.readFile(vkeyPath, 'utf8'));
    
    // Verify the proof
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    res.status(200).json({
      success: true,
      proof,
      publicSignals,
      verified,
      proofType
    });
  } catch (error) {
    console.error('Error generating proof:', error);
    return handleApiError(error, res);
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};