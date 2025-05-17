/**
 * Secure proof generation endpoint using Google Cloud Storage
 * This replaces public zkey file access with secure cloud storage
 */

const ZKeyStorageManager = require('../../../utils/zkeyStorageManager');
const path = require('path');
const { handleApiError } = require('../../../utils/apiErrorHandler');

export default async function handler(req, res) {
  console.log('=== generateProofCloudStorage API called ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body));
  
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
    
    console.log(`Generating ${proofType} proof with Cloud Storage...`);
    console.log('Environment check:');
    console.log('- GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID);
    console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log('- Current directory:', process.cwd());
    
    // Initialize storage manager with proper environment
    let storageManager;
    try {
      storageManager = new ZKeyStorageManager();
      console.log('Storage manager initialized successfully');
    } catch (initError) {
      console.error('Failed to initialize storage manager:', initError);
      return res.status(503).json({ 
        error: 'Storage initialization failed',
        details: initError.message,
        stack: process.env.NODE_ENV === 'development' ? initError.stack : undefined
      });
    }
    
    try {
      // Get zkey from Cloud Storage
      console.log(`Attempting to download ${proofType}.zkey from Cloud Storage...`);
      const zkeyData = await storageManager.getZKey(proofType);
      console.log(`Successfully downloaded ${proofType}.zkey (${zkeyData.length} bytes)`);
      
      // Get the circuit WASM file - use absolute path from root
      const wasmPath = path.join(
        '/Users/karpel/Desktop/GitHub/proof-of-funds',
        'circuits',
        proofType,
        `${proofType}Proof_js`,
        `${proofType}Proof.wasm`
      );
      
      // Log the path for debugging
      console.log(`Looking for WASM file at: ${wasmPath}`);
      
      // Load snarkjs
      const snarkjs = require('snarkjs');
      
      // Extract only the fields needed by the circuit
      const circuitInput = {
        balance: input.balance,
        threshold: input.threshold,
        userAddress: input.userAddress
      };
      
      console.log('Circuit input:', JSON.stringify(circuitInput));
      
      // Generate the proof
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInput,
        wasmPath,
        zkeyData  // Use the buffer directly from Cloud Storage
      );
      
      // Get verification key - use absolute path from root
      const vkeyPath = path.join(
        '/Users/karpel/Desktop/GitHub/proof-of-funds',
        'circuits',
        proofType,
        `${proofType}Proof.vkey.json`
      );
      
      console.log(`Looking for vkey file at: ${vkeyPath}`);
      
      const fs = require('fs');
      const vKeyData = fs.readFileSync(vkeyPath, 'utf8');
      const vKey = JSON.parse(vKeyData);
      
      // Verify the proof
      const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      
      console.log(`✅ ${proofType} proof generated and verified: ${verified}`);
      
      res.status(200).json({
        success: true,
        proof,
        publicSignals,
        verified,
        proofType
      });
    } catch (storageError) {
      console.error('Cloud Storage Error:', storageError);
      // Return proper error for missing keys
      return res.status(503).json({ 
        error: 'Cloud storage not accessible',
        details: storageError.message,
        solution: 'Ensure zkey files are uploaded to Google Cloud Storage'
      });
    }
  } catch (error) {
    console.error('=== Error in generateProofCloudStorage ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
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