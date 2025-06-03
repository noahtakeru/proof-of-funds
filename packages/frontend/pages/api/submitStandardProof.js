/**
 * API endpoint for submitting standard proofs to the blockchain
 * 
 * This endpoint handles the API response for standard proofs:
 * 1. Receives and validates proof data 
 * 2. Verifies if the signature matches the provided wallet address
 * 3. Returns transaction data for client-side submission
 * 
 * Unlike ZK proofs, standard proofs are submitted directly from the user's wallet
 * This API endpoint just validates and returns the necessary data
 */

import { ethers } from 'ethers';
import getConfig from 'next/config';
import { getRpcUrl, getNetworkConfig } from '../../lib/networkConfig';
import rateLimiter from '../../lib/rateLimit';
import { validateApiRequest, validators } from '../../utils/apiValidator';
import { handleApiError } from '../../utils/apiErrorHandler';
import { CONTRACT_ADDRESS } from '@proof-of-funds/common/config/constants';

// Get Next.js runtime configs
const { serverRuntimeConfig } = getConfig();

// Get network configuration
const networkConfig = getNetworkConfig();

// Get RPC URL based on environment
const POLYGON_RPC_URL = getRpcUrl();

// Get contract address with fallbacks
function getProofContractAddress() {
  // Try environment variables first
  const envAddress = serverRuntimeConfig.PROOF_CONTRACT_ADDRESS || 
                    process.env.PROOF_CONTRACT_ADDRESS || 
                    process.env.NEXT_PUBLIC_PROOF_CONTRACT_ADDRESS;
  
  if (envAddress) {
    console.log('Using contract address from environment:', envAddress);
    return envAddress;
  }

  // Use deployed contract address from constants
  if (CONTRACT_ADDRESS) {
    console.log('Using contract address from deployment:', CONTRACT_ADDRESS);
    return CONTRACT_ADDRESS;
  }

  throw new Error('No contract address found. Please deploy the contract or set environment variables.');
}

// Rate limiter configuration - limit to 5 per minute per IP
const applyRateLimit = rateLimiter(5);

// Define the handler function
async function handler(req, res) {
  console.log('=== API REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('Has signature:', !!req.body?.signature);
  console.log('Has walletAddress:', !!req.body?.walletAddress);

  // Apply rate limiting
  const rateLimitResult = applyRateLimit(req, res);
  if (!rateLimitResult) {
    // If rate limit is exceeded, response has already been sent
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Define validation specification
    const validationSpec = {
      required: ['proofHash', 'expiryTime', 'walletAddress', 'signature'],
      fields: {
        proofHash: [validators.isString],
        expiryTime: [(value) => {
          if (typeof value !== 'number' && (typeof value === 'string' && isNaN(Number(value)))) {
            return {
              isValid: false,
              error: 'invalid_number',
              message: 'The field must be a number'
            };
          }
          return { isValid: true };
        }],
        proofType: [(value) => {
          if (![0, 1, 2].includes(Number(value))) {
            return {
              isValid: false,
              error: 'invalid_value',
              message: 'The field must be one of: 0, 1, 2'
            };
          }
          return { isValid: true };
        }],
        threshold: [validators.isString],
        signatureMessage: [validators.isString],
        signature: [validators.isString],
        walletAddress: [validators.isString],
        transactionWallet: [(value) => {
          // transactionWallet is optional but if provided must be a valid address
          if (value && !ethers.utils.isAddress(value)) {
            return {
              isValid: false,
              error: 'invalid_address',
              message: 'The transaction wallet address must be a valid Ethereum address'
            };
          }
          return { isValid: true };
        }],
        contractAddress: [(value) => {
          if (value && !ethers.utils.isAddress(value)) {
            return {
              isValid: false,
              error: 'invalid_address',
              message: 'The contract address must be a valid Ethereum address'
            };
          }
          return { isValid: true };
        }]
      }
    };

    // Validate request inputs
    const validation = validateApiRequest(req.body, validationSpec);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid input parameters',
        details: validation.errors
      });
    }
    
    // Extract validated data
    const {
      proofHash,
      expiryTime,
      proofType = 0, // Default to standard proof
      threshold = '0', // Default to 0 for standard proof
      signatureMessage = '',
      signature,
      walletAddress, // The wallet that created the signature
      transactionWallet, // The wallet to use for the transaction (may be different from walletAddress)
      contractAddress: requestContractAddress // Get contract address from request
    } = req.body;

    // Determine which contract address to use with dynamic resolution
    let contractAddress;
    if (requestContractAddress) {
      // Use contract address from request if provided
      contractAddress = requestContractAddress;
      console.log('Using contract address from request:', contractAddress);
    } else {
      // Use contract address resolution
      try {
        contractAddress = getProofContractAddress();
        console.log('Using resolved contract address:', contractAddress);
      } catch (error) {
        console.error('CRITICAL: Contract address resolution failed:', error.message);
        return res.status(500).json({
          error: 'Contract address resolution failed',
          message: error.message,
          detail: 'Unable to resolve contract address. Please deploy the contract or set environment variables.',
          requestInfo: {
            hasContractAddress: !!requestContractAddress,
            deployedAddress: CONTRACT_ADDRESS
          }
        });
      }
    }
    
    // Validate address format
    if (!ethers.utils.isAddress(contractAddress)) {
      console.error(`Invalid contract address format: ${contractAddress}`);
      return res.status(500).json({
        error: 'Invalid contract address',
        message: 'Contract address format is invalid',
        detail: 'Contract address must be a valid Ethereum address'
      });
    }

    // Initialize provider to verify signature (use v5 syntax)
    console.log(`Using RPC URL: ${POLYGON_RPC_URL}`);
    const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
    
    // Verify we're on the correct network
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
    
    // Verify that signature is valid - this is mandatory for security
    let recoveredAddress;
    try {
      if (!signatureMessage || !signature) {
        console.error('Signature or message missing');
        return res.status(400).json({
          error: 'Missing signature data',
          message: 'Signature and message are required',
          detail: 'Ensure both signatureMessage and signature are provided'
        });
      }
      
      // Debug logging to see what we're receiving
      console.log('=== SIGNATURE VERIFICATION DEBUG ===');
      console.log('walletAddress:', walletAddress);
      console.log('signatureMessage length:', signatureMessage.length);
      console.log('signature length:', signature.length);
      console.log('signature format:', signature.startsWith('0x') ? 'hex with 0x' : 'hex without 0x');
      
      // Use ethers v5 syntax (API may be using v5)
      const msgHash = ethers.utils.hashMessage(signatureMessage);
      console.log('msgHash:', msgHash);
      
      recoveredAddress = ethers.utils.recoverAddress(msgHash, signature);
      console.log('recoveredAddress:', recoveredAddress);
      console.log('expectedAddress:', walletAddress);
      console.log('addresses match:', recoveredAddress.toLowerCase() === walletAddress.toLowerCase());
      
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        console.error(`Signature verification failed: recovered ${recoveredAddress}, expected ${walletAddress}`);
        return res.status(400).json({
          error: 'Invalid signature',
          message: 'The provided signature does not match the wallet address',
          detail: 'Ensure the signature is valid and matches the wallet address',
          debug: {
            recoveredAddress,
            expectedAddress: walletAddress,
            signatureLength: signature.length,
            messageLength: signatureMessage.length
          }
        });
      }
      
      console.log(`✓ Signature verified for address: ${walletAddress}`);
    } catch (sigError) {
      console.error('Error verifying signature:', sigError);
      return res.status(400).json({
        error: 'Signature verification failed',
        message: 'Could not verify signature',
        detail: sigError.message
      });
    }

    // Use the correct contract ABI from the deployed contract
    const contractABI = [
      {
        'inputs': [
          { 'internalType': 'enum ProofOfFunds.ProofType', 'name': '_proofType', 'type': 'uint8' },
          { 'internalType': 'bytes32', 'name': '_proofHash', 'type': 'bytes32' },
          { 'internalType': 'uint256', 'name': '_expiryTime', 'type': 'uint256' },
          { 'internalType': 'uint256', 'name': '_thresholdAmount', 'type': 'uint256' },
          { 'internalType': 'string', 'name': '_signatureMessage', 'type': 'string' },
          { 'internalType': 'bytes', 'name': '_signature', 'type': 'bytes' }
        ],
        'name': 'submitProof',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'
      }
    ];

    // Verify contract exists and get basic info
    const contractInfo = {};
    try {
      const contractCode = await provider.getCode(contractAddress);
      if (contractCode === '0x') {
        console.error(`Contract not found at address: ${contractAddress}`);
        return res.status(500).json({
          error: 'Contract not found',
          message: 'No contract code found at the specified address',
          detail: `Contract address ${contractAddress} does not contain any code`
        });
      }
      
      contractInfo.codeLength = contractCode.length;
      contractInfo.exists = true;
      console.log(`✓ Contract verified at ${contractAddress} (code length: ${contractCode.length})`);
    } catch (contractError) {
      console.error('Error verifying contract:', contractError);
      contractInfo.exists = false;
      contractInfo.error = contractError.message;
    }

    // Get current gas price for estimation (use v5 syntax)
    const gasPrice = await provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(15).div(10); // 1.5x for Polygon
    
    // Remove fake gas estimation - let the frontend handle this properly
    // The frontend will do real gas estimation with the actual user's wallet
    // This is more accurate and follows security assessment rules (no fake implementations)
    console.log('API validated inputs successfully - gas estimation will be done client-side with real wallet');

    // Return the transaction data for the client to submit
    return res.status(200).json({
      success: true,
      // Return data needed for the frontend to submit the transaction
      transactionData: {
        contractAddress: contractAddress,
        contractABI: contractABI,
        proofType: proofType,
        proofHash: proofHash,
        expiryTime: expiryTime,
        threshold: threshold,
        signatureMessage: signatureMessage || '',
        walletAddress: walletAddress, // The wallet that created the signature
        transactionWallet: transactionWallet || walletAddress, // The wallet to use for the transaction, fallback to signature wallet
        signature: signature,
        estimatedGasPrice: ethers.utils.formatUnits(adjustedGasPrice, 'gwei')
      },
      // Network info
      network: {
        chainId: network.chainId,
        name: network.name,
        testnet: network.chainId !== 137
      },
      // Configuration info for debugging
      config: {
        contractAddressFrom: requestContractAddress ? 'request' : 'environment',
        rpcUrlFrom: 'environment',
        networkName: network.name,
        contractInfo: contractInfo,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    console.error('Error stack:', error.stack);
    
    // Use a consistent error response format
    return res.status(500).json({
      error: 'SYSTEM_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV !== 'production' ? {
        stack: error.stack,
        fullError: error.toString()
      } : {}
    });
  }
}

// Export the handler directly
export default handler;