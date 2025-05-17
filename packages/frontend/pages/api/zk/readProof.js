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
    
    // Return formatted proof data
    return res.status(200).json({
      user: zkProof.user,
      submissionDate,
      expiryDate,
      proofType: PROOF_TYPES[zkProof.proofType] || 'Unknown',
      status,
      signatureMessage: zkProof.signatureMessage,
      isRevoked: zkProof.isRevoked,
    });

  } catch (error) {
    console.error('Error reading proof:', error);
    return res.status(500).json({
      error: 'Failed to read proof',
      message: error.message
    });
  }
}