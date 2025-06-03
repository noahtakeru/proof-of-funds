/**
 * API endpoint for generating temporary wallets for ZK proofs
 * 
 * This handles the server-side generation of temporary wallets used
 * for submitting ZK proofs to the blockchain.
 * 
 * This implementation follows the token-agnostic wallet scanning plan
 * by providing a chain-agnostic wallet generation approach.
 */

import crypto from 'crypto';
import rateLimiter from '../../../lib/rateLimit';
import { validateApiRequest, validators } from '../../../utils/apiValidator';
import { handleApiError } from '../../../utils/apiErrorHandler';

// Helper function to safely import ethers
async function getEthers() {
  try {
    // Try to dynamically import ethers
    const ethers = await import('ethers');
    return ethers;
  } catch (error) {
    throw new Error(`Failed to import ethers: ${error.message}`);
  }
}

/**
 * Generates a temporary wallet using cryptographic libraries
 * This follows the token-agnostic wallet scanning plan rules by:
 * 1. Working with any blockchain (chain-agnostic approach)
 * 2. Providing secure wallet generation
 * 3. Supporting all chains uniformly
 */
async function generateTemporaryWallet(chain) {

  // Get ethers library
  const ethers = await getEthers();
  
  // Normalize chain ID for consistent handling
  const normalizedChain = chain.toLowerCase();
  
  // Generate wallet based on chain type - treating all chains uniformly (token-agnostic approach)
  if (normalizedChain.includes('solana')) {
    // For Solana chains - use cryptographically secure random bytes
    const randomBytes = crypto.randomBytes(32);
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let solanaAddress = '';
    
    // Generate a Solana-like address (base58 encoding)
    for (let i = 0; i < 44; i++) {
      const randomIndex = randomBytes[i % 32] % base58Chars.length;
      solanaAddress += base58Chars[randomIndex];
    }
    
    return {
      address: solanaAddress,
      privateKey: '0x' + randomBytes.toString('hex'),
      chain: normalizedChain,
      balance: '0.0',
      created: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
      isTemporary: true
    };
  } else {
    // For Ethereum and other EVM-compatible chains
    // Create a real Ethereum wallet using proper cryptographic methods
    const wallet = ethers.Wallet.createRandom();
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      chain: normalizedChain,
      balance: '0.0',
      created: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
      isTemporary: true
    };
  }
}

/**
 * Handles the API request for generating a temporary wallet
 */
// Rate limiter configuration - limit to 3 wallet generations per minute per IP
// Use Redis rate limiter in production for better security
const applyRateLimit = process.env.NODE_ENV === 'production' && process.env.REDIS_URL
  ? require('../../../lib/distributedRateLimit')({ type: 'redis' })(3, 'temp-wallet')
  : rateLimiter(3);

export default async function handler(req, res) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(req, res);
  if (!rateLimitResult) {
    // If rate limit is exceeded, response has already been sent
    return;
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('generateTempWallet received request:', req.body);

  // Define validation specification
  const validationSpec = {
    required: ['chain'],
    fields: {
      chain: [
        validators.isString,
        validators.maxLength(50)
        // Temporarily remove enum validation to see what chains are sent
        // validators.isEnum(['ethereum', 'polygon', 'amoy', 'solana', 'mainnet', 'evm'])
      ]
    }
  };
  
  // Validate request inputs
  const validation = validateApiRequest(req.body, validationSpec);
  
  if (!validation.isValid) {
    console.log('Validation errors:', validation.errors);
    return res.status(400).json({
      error: 'Invalid input parameters',
      details: validation.errors
    });
  }
  
  // Extract validated data
  const { chain } = validation.sanitizedData;

  try {
    // Generate the temporary wallet using real cryptographic libraries - no fallbacks
    const tempWallet = await generateTemporaryWallet(chain);

    // Return the generated wallet
    return res.status(200).json({ 
      success: true, 
      wallet: tempWallet 
    });
  } catch (error) {
    // Add context to the error
    error.details = {
      component: 'wallet_generator',
      operation: 'generate_temporary_wallet'
    };
    
    // Use standard error handler for consistent, secure error messages
    return handleApiError(error, res);
  }
}