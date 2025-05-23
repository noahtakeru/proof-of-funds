/**
 * API endpoint for reading ZK proofs from the blockchain
 * 
 * This endpoint retrieves a ZK proof from the smart contract by address
 * and formats the response in a user-friendly way
 */

import { ethers } from 'ethers';
import { getRpcUrl } from '../../../lib/networkConfig';

// ZK Verifier contract address
const ZK_VERIFIER_ADDRESS = process.env.ZK_VERIFIER_ADDRESS || '0x9E98DdFD14e47295a9e900a3dF332EcF6a9587B5';

// Simplified ABI for the ZK Verifier contract (just the methods we need)
const ZK_VERIFIER_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_user", "type": "address" }
    ],
    "name": "getZKProof",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "user", "type": "address" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
          { "internalType": "uint256", "name": "expiryTime", "type": "uint256" },
          { "internalType": "bytes", "name": "publicSignals", "type": "bytes" },
          { "internalType": "bytes", "name": "proof", "type": "bytes" },
          { "internalType": "enum ZKVerifier.ZKProofType", "name": "proofType", "type": "uint8" },
          { "internalType": "bool", "name": "isRevoked", "type": "bool" },
          { "internalType": "string", "name": "signatureMessage", "type": "string" },
          { "internalType": "bytes", "name": "signature", "type": "bytes" }
        ],
        "internalType": "struct ZKVerifier.ZKProof",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Map proof types to human-readable strings
const PROOF_TYPES = {
  0: 'Standard',
  1: 'Threshold',
  2: 'Maximum'
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address } = req.query;

    // Validate the address
    if (!address || !ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // Connect to the network
    const rpcUrl = getRpcUrl();
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Connect to the contract
    const contract = new ethers.Contract(ZK_VERIFIER_ADDRESS, ZK_VERIFIER_ABI, provider);
    
    // Retrieve the proof
    const zkProof = await contract.getZKProof(address);
    
    // Check if proof exists
    if (zkProof.user === ethers.constants.AddressZero) {
      return res.status(404).json({ error: 'No proof found for this address' });
    }
    
    // Format dates
    const submissionDate = new Date(zkProof.timestamp.toNumber() * 1000).toISOString();
    const expiryDate = zkProof.expiryTime.toNumber() > 0 
      ? new Date(zkProof.expiryTime.toNumber() * 1000).toISOString()
      : 'Never';
      
    // Format proof status
    const status = zkProof.isRevoked 
      ? 'Revoked' 
      : (zkProof.expiryTime.toNumber() > 0 && Date.now() > zkProof.expiryTime.toNumber() * 1000)
        ? 'Expired' 
        : 'Valid';
    
    // Decode the cryptographic proof data from blockchain storage
    let cryptographicProof = null;
    let publicSignals = null;
    
    try {
      if (zkProof.proof && zkProof.proof !== '0x') {
        // Decode the ABI-encoded proof array
        const decodedProofArray = ethers.utils.defaultAbiCoder.decode(['uint256[]'], zkProof.proof)[0];
        
        // Convert to Groth16 proof format (pi_a, pi_b, pi_c)
        if (decodedProofArray.length >= 8) {
          cryptographicProof = {
            pi_a: [decodedProofArray[0].toString(), decodedProofArray[1].toString()],
            pi_b: [
              [decodedProofArray[2].toString(), decodedProofArray[3].toString()],
              [decodedProofArray[4].toString(), decodedProofArray[5].toString()]
            ],
            pi_c: [decodedProofArray[6].toString(), decodedProofArray[7].toString()],
            protocol: "groth16",
            curve: "bn128"
          };
        }
      }
      
      if (zkProof.publicSignals && zkProof.publicSignals !== '0x') {
        // Decode the ABI-encoded public signals array
        const decodedSignalsArray = ethers.utils.defaultAbiCoder.decode(['uint256[]'], zkProof.publicSignals)[0];
        publicSignals = decodedSignalsArray.map(signal => signal.toString());
      }
    } catch (decodeError) {
      console.error('Error decoding proof data:', decodeError);
      // Continue with metadata only if decoding fails
    }
    
    // Return formatted proof data with cryptographic components
    return res.status(200).json({
      user: zkProof.user,
      submissionDate,
      expiryDate,
      proofType: PROOF_TYPES[zkProof.proofType] || 'Unknown',
      proofTypeNumber: zkProof.proofType,
      status,
      signatureMessage: zkProof.signatureMessage,
      isRevoked: zkProof.isRevoked,
      // Add the decoded cryptographic proof components
      cryptographicProof,
      publicSignals,
      // Include raw data for debugging if needed
      rawProof: zkProof.proof,
      rawPublicSignals: zkProof.publicSignals
    });

  } catch (error) {
    console.error('Error reading proof:', error);
    return res.status(500).json({
      error: 'Failed to read proof',
      message: error.message
    });
  }
}