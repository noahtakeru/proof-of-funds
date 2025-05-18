/**
 * API endpoint for submitting ZK proofs to the blockchain using temporary wallets
 * 
 * This endpoint handles the complete privacy-preserving flow:
 * 1. Receives proof data and temporary wallet info
 * 2. Funds the temporary wallet with MATIC if needed
 * 3. Submits the proof transaction from the temporary wallet
 * 4. Returns the transaction hash
 */

import { ethers } from 'ethers';
import { getRpcUrl, getNetworkConfig } from '../../../lib/networkConfig';
import rateLimiter from '../../../lib/rateLimit';
import { verifyWalletBalanceForTransaction } from '../../../lib/walletMonitor';
import { validateApiRequest, validators } from '../../../utils/apiValidator';
import { handleApiError } from '../../../utils/apiErrorHandler';

// Get network configuration
const networkConfig = getNetworkConfig();

// Select the appropriate service wallet based on network
const SERVICE_WALLET_PRIVATE_KEY = networkConfig.chainId === 137 
  ? process.env.SERVICE_WALLET_PRIVATE_KEY_MAINNET 
  : process.env.SERVICE_WALLET_PRIVATE_KEY_AMOY || process.env.SERVICE_WALLET_PRIVATE_KEY;

// Get RPC URL based on environment (Amoy for dev, configurable for prod)
const POLYGON_RPC_URL = getRpcUrl();
const ZK_VERIFIER_ADDRESS = process.env.ZK_VERIFIER_ADDRESS || '0xYourContractAddress';

// Gas price limits to protect against high gas costs
// For Amoy testnet (can be higher due to test environment)
const MAX_GAS_PRICE_AMOY = ethers.utils.parseUnits('300', 'gwei');
// For Polygon mainnet (need to be more conservative)
const MAX_GAS_PRICE_MAINNET = ethers.utils.parseUnits('150', 'gwei');

// Rate limiter configuration
// Limit ZK proof submissions to 5 per minute per IP address
const applyRateLimit = rateLimiter(5);

// Define the handler function - no auth required for ZK proofs which use temporary wallets
async function handler(req, res) {
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
      required: ['proof', 'publicSignals', 'tempWalletPrivateKey', 'tempWalletAddress'],
      fields: {
        proof: [validators.isArray],
        publicSignals: [validators.isArray],
        expiryTime: [validators.isPositiveNumber],
        proofType: [validators.isEnum([0, 1, 2])], // 0: Standard, 1: Threshold, 2: Maximum
        signatureMessage: [validators.isString, validators.maxLength(1000)],
        signature: [validators.isString],
        tempWalletPrivateKey: [validators.isString, validators.isHexString],
        tempWalletAddress: [validators.isAddress]
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
      proof,
      publicSignals,
      expiryTime,
      proofType,
      signatureMessage,
      signature,
      tempWalletPrivateKey,
      tempWalletAddress
    } = validation.sanitizedData;

    // Initialize provider
    console.log(`Using RPC URL: ${POLYGON_RPC_URL}`);
    const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
    
    // Verify we're on the correct network
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
    
    if (network.chainId === 80002) {
      console.log('✓ Connected to Polygon Amoy testnet');
    } else if (network.chainId === 137) {
      console.log('✓ Connected to Polygon mainnet');
    } else {
      console.warn(`Warning: Connected to unexpected network with chainId ${network.chainId}`);
    }

    // Create wallet instances
    const serviceWallet = new ethers.Wallet(SERVICE_WALLET_PRIVATE_KEY, provider);
    const tempWallet = new ethers.Wallet(tempWalletPrivateKey, provider);
    
    console.log(`Service wallet address: ${serviceWallet.address}`);
    console.log(`Using service wallet for ${network.chainId === 80002 ? 'Amoy testnet' : 'Polygon mainnet'}`);

    // Check temporary wallet balance
    const tempWalletBalance = await provider.getBalance(tempWalletAddress);
    console.log(`Temp wallet balance: ${ethers.utils.formatEther(tempWalletBalance)} MATIC`);

    // Prepare contract interface for gas estimation
    const contractABI = [
      {
        "inputs": [
          { "internalType": "bytes", "name": "_proof", "type": "bytes" },
          { "internalType": "bytes", "name": "_publicSignals", "type": "bytes" },
          { "internalType": "uint256", "name": "_expiryTime", "type": "uint256" },
          { "internalType": "enum ZKVerifier.ZKProofType", "name": "_proofType", "type": "uint8" },
          { "internalType": "string", "name": "_signatureMessage", "type": "string" },
          { "internalType": "bytes", "name": "_signature", "type": "bytes" }
        ],
        "name": "submitZKProof",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];

    const contract = new ethers.Contract(ZK_VERIFIER_ADDRESS, contractABI, tempWallet);

    // Encode proof data
    const encodedProof = ethers.utils.defaultAbiCoder.encode(
      ['uint256[]'],
      [proof]
    );

    const encodedPublicSignals = ethers.utils.defaultAbiCoder.encode(
      ['uint256[]'],
      [publicSignals]
    );

    // Get current gas price and estimate gas for the actual transaction
    const gasPrice = await provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(2); // Double for Amoy network
    const minGasPrice = ethers.utils.parseUnits('30', 'gwei');
    
    // Apply maximum gas price limit based on network
    const maxGasPrice = network.chainId === 137 ? MAX_GAS_PRICE_MAINNET : MAX_GAS_PRICE_AMOY;
    
    // Determine final gas price (within min/max bounds)
    let finalGasPrice;
    if (adjustedGasPrice.lt(minGasPrice)) {
      finalGasPrice = minGasPrice;
    } else if (adjustedGasPrice.gt(maxGasPrice)) {
      finalGasPrice = maxGasPrice;
      console.warn(`Gas price capped at ${ethers.utils.formatUnits(maxGasPrice, 'gwei')} gwei due to exceeding maximum`);
    } else {
      finalGasPrice = adjustedGasPrice;
    }
    
    console.log(`Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
    console.log(`Adjusted gas price: ${ethers.utils.formatUnits(finalGasPrice, 'gwei')} gwei`);
    
    // Estimate gas for the actual transaction
    const gasEstimate = await contract.estimateGas.submitZKProof(
      encodedProof,
      encodedPublicSignals,
      expiryTime,
      proofType,
      signatureMessage,
      signature
    );
    
    // Calculate required amount: gas estimate * gas price + small buffer
    const gasLimit = gasEstimate.mul(110).div(100); // 10% buffer for gas limit
    const requiredAmount = gasLimit.mul(finalGasPrice);
    const requiredWithBuffer = requiredAmount.mul(110).div(100); // 10% additional buffer for price fluctuation
    
    console.log(`Estimated gas: ${gasEstimate.toString()}`);
    console.log(`Gas price: ${ethers.utils.formatUnits(finalGasPrice, 'gwei')} gwei`);
    console.log(`Required amount: ${ethers.utils.formatEther(requiredAmount)} MATIC`);
    console.log(`Required with buffer: ${ethers.utils.formatEther(requiredWithBuffer)} MATIC`);

    // Fund temporary wallet if needed
    if (tempWalletBalance.lt(requiredWithBuffer)) {
      const fundingAmount = requiredWithBuffer.sub(tempWalletBalance);
      console.log(`Funding temporary wallet with ${ethers.utils.formatEther(fundingAmount)} MATIC...`);
      
      // Add safety check to prevent excessive funding
      const MAX_FUNDING_AMOUNT = ethers.utils.parseEther('0.5'); // Maximum funding of 0.5 MATIC
      const safeAmount = fundingAmount.gt(MAX_FUNDING_AMOUNT) ? MAX_FUNDING_AMOUNT : fundingAmount;
      
      if (fundingAmount.gt(MAX_FUNDING_AMOUNT)) {
        console.warn(`Funding amount capped at ${ethers.utils.formatEther(MAX_FUNDING_AMOUNT)} MATIC for security`);
      }
      
      // Verify service wallet has sufficient balance before sending transaction
      const hasEnoughBalance = await verifyWalletBalanceForTransaction(
        serviceWallet, 
        network, 
        safeAmount.add(ethers.utils.parseEther('0.01')) // Add 0.01 MATIC for gas
      );
      
      if (!hasEnoughBalance) {
        return res.status(500).json({
          error: 'Service wallet has insufficient balance',
          message: 'The service wallet does not have enough funds to complete this transaction',
          detail: 'Please contact support to resolve this issue'
        });
      }
      
      const fundingTx = await serviceWallet.sendTransaction({
        to: tempWalletAddress,
        value: safeAmount,
        gasPrice: finalGasPrice
      });
      await fundingTx.wait();
      console.log(`Funded temp wallet with ${ethers.utils.formatEther(fundingAmount)} MATIC`);
    } else {
      console.log('Temporary wallet has sufficient balance');
    }

    // Validate contract address
    console.log('ZK_VERIFIER_ADDRESS:', ZK_VERIFIER_ADDRESS);
    
    if (!ZK_VERIFIER_ADDRESS || ZK_VERIFIER_ADDRESS === '0xYourContractAddressHere') {
      throw new Error('ZK Verifier contract address not configured. Please deploy the contract and update ZK_VERIFIER_ADDRESS in .env');
    }
    
    // Validate address format
    if (!ethers.utils.isAddress(ZK_VERIFIER_ADDRESS)) {
      throw new Error(`Invalid contract address format: ${ZK_VERIFIER_ADDRESS}`);
    }

    // Submit transaction with proper gas settings
    const tx = await contract.submitZKProof(
      encodedProof,
      encodedPublicSignals,
      expiryTime,
      proofType,
      signatureMessage,
      signature,
      { 
        gasLimit,
        gasPrice: finalGasPrice
      }
    );

    console.log('Transaction submitted:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);

    return res.status(200).json({
      success: true,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

  } catch (error) {
    // Use standard error handler for consistent, secure error messages
    return handleApiError(error, res);
  }
}

// Export the handler directly - no auth required for ZK proofs
// ZK proofs use temporary wallets for privacy
export default handler;