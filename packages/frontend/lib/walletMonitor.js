/**
 * Service wallet balance monitor
 * 
 * This module provides functionality to monitor the balance of service wallets
 * and trigger alerts when the balance falls below a threshold.
 */

import { ethers } from 'ethers';
import { getRpcUrl, getNetworkConfig } from './networkConfig';

// Configuration
const MIN_SAFE_BALANCE = {
  // In MATIC - adjusted for development mode
  amoy: process.env.NODE_ENV === 'development' ? 
    ethers.utils.parseEther('0.1') :    // 0.1 MATIC for Amoy in development
    ethers.utils.parseEther('1.0'),     // 1 MATIC for Amoy in production
  mainnet: ethers.utils.parseEther('5.0')  // 5 MATIC for Polygon mainnet
};

// State for logging alerts (to prevent spam)
let lastAlertTimestamp = 0;
const ALERT_COOLDOWN = 3600000; // 1 hour in milliseconds

/**
 * Check if the service wallet has sufficient balance
 * @param {string} network - Network identifier ('amoy' or 'mainnet')
 * @returns {Promise<Object>} - Balance status
 */
export async function checkServiceWalletBalance(network = 'amoy') {
  try {
    // Get network configuration
    const networkConfig = getNetworkConfig();
    const isMainnet = networkConfig.chainId === 137;
    const actualNetwork = isMainnet ? 'mainnet' : 'amoy';
    
    // Select the appropriate service wallet based on network
    const SERVICE_WALLET_PRIVATE_KEY = isMainnet 
      ? process.env.SERVICE_WALLET_PRIVATE_KEY_MAINNET 
      : process.env.SERVICE_WALLET_PRIVATE_KEY_AMOY || process.env.SERVICE_WALLET_PRIVATE_KEY;
    
    if (!SERVICE_WALLET_PRIVATE_KEY) {
      throw new Error(`Service wallet private key not configured for ${actualNetwork}`);
    }
    
    // Connect to the network
    const provider = new ethers.providers.JsonRpcProvider(getRpcUrl());
    
    // Create wallet instance (but don't expose private key)
    const wallet = new ethers.Wallet(SERVICE_WALLET_PRIVATE_KEY, provider);
    const walletAddress = wallet.address;
    
    // Check balance
    const balance = await provider.getBalance(walletAddress);
    const minSafeBalance = MIN_SAFE_BALANCE[actualNetwork];
    const formattedBalance = ethers.utils.formatEther(balance);
    
    // Check if balance is below threshold
    const balanceStatus = {
      address: walletAddress,
      balance: formattedBalance,
      network: actualNetwork,
      timestamp: new Date().toISOString(),
      isSufficient: balance.gte(minSafeBalance),
      minSafeBalance: ethers.utils.formatEther(minSafeBalance),
    };
    
    // Log alert if balance is too low (with cooldown)
    if (!balanceStatus.isSufficient && Date.now() - lastAlertTimestamp > ALERT_COOLDOWN) {
      console.error(`[ALERT] Service wallet balance low: ${formattedBalance} MATIC on ${actualNetwork}`);
      console.error(`[ALERT] Service wallet address: ${walletAddress}`);
      console.error(`[ALERT] Minimum required: ${ethers.utils.formatEther(minSafeBalance)} MATIC`);
      console.error(`[ALERT] Please fund the service wallet to continue operations`);
      
      // Update last alert timestamp
      lastAlertTimestamp = Date.now();
    }
    
    return balanceStatus;
  } catch (error) {
    console.error('Error checking service wallet balance:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Verify service wallet has sufficient balance before transaction
 * @param {ethers.Wallet} serviceWallet - The service wallet instance
 * @param {string} network - Network identifier
 * @param {BigNumber} requiredAmount - Amount needed for the transaction
 * @returns {Promise<boolean>} - Whether the wallet has sufficient balance
 */
export async function verifyWalletBalanceForTransaction(serviceWallet, network, requiredAmount) {
  try {
    // Get wallet balance
    const balance = await serviceWallet.getBalance();
    
    // Get minimum safe balance
    const networkKey = network.chainId === 137 ? 'mainnet' : 'amoy';
    const minSafeBalance = MIN_SAFE_BALANCE[networkKey];
    
    // Calculate total required (transaction + safe minimum)
    const totalRequired = requiredAmount.add(minSafeBalance);
    
    // Check if balance is sufficient
    const isSufficient = balance.gte(totalRequired);
    
    if (!isSufficient) {
      console.error(`[CRITICAL] Service wallet has insufficient balance for transaction`);
      console.error(`[CRITICAL] Service wallet address: ${serviceWallet.address}`);
      console.error(`[CRITICAL] Current balance: ${ethers.utils.formatEther(balance)} MATIC`);
      console.error(`[CRITICAL] Required for transaction: ${ethers.utils.formatEther(requiredAmount)} MATIC`);
      console.error(`[CRITICAL] Minimum safe balance: ${ethers.utils.formatEther(minSafeBalance)} MATIC`);
      console.error(`[CRITICAL] Total required: ${ethers.utils.formatEther(totalRequired)} MATIC`);
    }
    
    return isSufficient;
  } catch (error) {
    console.error('Error verifying wallet balance for transaction:', error);
    return false;
  }
}