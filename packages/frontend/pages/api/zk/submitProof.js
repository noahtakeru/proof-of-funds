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

// Get network configuration
const networkConfig = getNetworkConfig();

// Select the appropriate service wallet based on network
const SERVICE_WALLET_PRIVATE_KEY = networkConfig.chainId === 137 
  ? process.env.SERVICE_WALLET_PRIVATE_KEY_MAINNET 
  : process.env.SERVICE_WALLET_PRIVATE_KEY_AMOY || process.env.SERVICE_WALLET_PRIVATE_KEY;

// Get RPC URL based on environment (Amoy for dev, configurable for prod)
const POLYGON_RPC_URL = getRpcUrl();
const ZK_VERIFIER_ADDRESS = process.env.ZK_VERIFIER_ADDRESS || '0xYourContractAddress';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      proof,
      publicSignals,
      expiryTime,
      proofType,
      signatureMessage,
      signature,
      tempWalletPrivateKey,
      tempWalletAddress
    } = req.body;

    // Validate inputs
    if (!proof || !publicSignals || !tempWalletPrivateKey || !tempWalletAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

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
    const finalGasPrice = adjustedGasPrice.gt(minGasPrice) ? adjustedGasPrice : minGasPrice;
    
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
      
      const fundingTx = await serviceWallet.sendTransaction({
        to: tempWalletAddress,
        value: fundingAmount,
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
    console.error('Error submitting proof:', error);
    return res.status(500).json({
      error: 'Failed to submit proof',
      message: error.message,
      details: error.reason || error.data
    });
  }
}