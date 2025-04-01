/**
 * Temporary Wallet Manager Module
 * 
 * This module provides the interface between the UI components and the underlying
 * wallet derivation functions. It manages the lifecycle of temporary wallets used
 * for privacy-preserving proofs.
 * 
 * Key Features:
 * - Creates temporary wallets for proof generation
 * - Manages wallet lifecycle (create → use → archive)
 * - Handles MATIC distribution for transaction fees
 * - Provides wallet listing and selection functionality
 */

import { ethers } from 'ethers';
import {
    createWalletForProof,
    listTemporaryWallets,
    archiveWallet,
    getDerivedWallet
} from './bip44';

// Provider for Polygon Amoy testnet
const POLYGON_AMOY_RPC = 'https://rpc-amoy.polygon.technology';

/**
 * Checks if a temporary wallet has sufficient MATIC for transaction fees
 * 
 * @param {string} address - Wallet address to check
 * @returns {Promise<{hasEnough: boolean, balance: string}>} Result object with balance information
 */
export const checkWalletBalance = async (address) => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(POLYGON_AMOY_RPC);
        const balance = await provider.getBalance(address);

        // Convert balance to a more readable format
        const balanceInMatic = ethers.utils.formatEther(balance);

        // Minimum MATIC needed for a transaction (0.01 MATIC)
        const minimumMatic = '0.01';

        return {
            hasEnough: parseFloat(balanceInMatic) >= parseFloat(minimumMatic),
            balance: balanceInMatic
        };
    } catch (error) {
        console.error('Error checking wallet balance:', error);
        throw new Error('Failed to check wallet balance');
    }
};

/**
 * Transfers MATIC to a temporary wallet for transaction fees
 * 
 * @param {string} toAddress - Recipient temporary wallet address
 * @param {string} fromAddress - Source wallet address (user's main wallet)
 * @param {string} amount - Amount of MATIC to transfer (defaults to 0.01)
 * @returns {Promise<string>} Transaction hash
 */
export const fundTemporaryWallet = async (toAddress, fromAddress, amount = '0.01') => {
    try {
        // We need the user to sign this transaction from their main wallet
        // This requires a browser wallet provider (MetaMask, etc.)
        if (!window.ethereum) {
            throw new Error('No Ethereum provider found. Please install MetaMask or similar.');
        }

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner(fromAddress);

        // Create transaction object
        const tx = {
            to: toAddress,
            value: ethers.utils.parseEther(amount)
        };

        // Send the transaction
        const transaction = await signer.sendTransaction(tx);

        // Wait for transaction to be mined
        await transaction.wait();

        return transaction.hash;
    } catch (error) {
        console.error('Error funding temporary wallet:', error);
        throw new Error('Failed to fund temporary wallet: ' + error.message);
    }
};

/**
 * Creates a new temporary wallet for proof generation and funds it with MATIC
 * 
 * @param {string} purpose - Purpose identifier for this wallet
 * @param {string} fromAddress - Source wallet address for funding
 * @param {boolean} autoFund - Whether to automatically fund the wallet
 * @param {boolean} autoArchive - Whether to automatically archive after use
 * @returns {Promise<Object>} Created wallet information
 */
export const createAndFundWallet = async (purpose, fromAddress, autoFund = true, autoArchive = true) => {
    try {
        // Create a new temporary wallet
        const walletInfo = await createWalletForProof(purpose, autoArchive);

        // Fund the wallet if requested
        if (autoFund) {
            await fundTemporaryWallet(walletInfo.address, fromAddress);
            // Wait for 2 seconds to allow the balance to update
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return walletInfo;
    } catch (error) {
        console.error('Error creating and funding wallet:', error);
        throw new Error('Failed to create and fund temporary wallet: ' + error.message);
    }
};

/**
 * Signs a message using a temporary wallet
 * 
 * @param {string} address - Temporary wallet address
 * @param {string} message - Message to sign
 * @returns {Promise<string>} Signature
 */
export const signWithTemporaryWallet = async (address, message) => {
    try {
        // Get the wallet information including private key
        const walletInfo = getDerivedWallet(address);

        if (!walletInfo || !walletInfo.privateKey) {
            throw new Error('Could not retrieve temporary wallet private key');
        }

        // Create wallet instance from private key
        const wallet = new ethers.Wallet(walletInfo.privateKey);

        // Sign the message
        const signature = await wallet.signMessage(message);

        return signature;
    } catch (error) {
        console.error('Error signing with temporary wallet:', error);
        throw new Error('Failed to sign message with temporary wallet: ' + error.message);
    }
};

/**
 * Submits a transaction using a temporary wallet
 * 
 * @param {string} address - Temporary wallet address
 * @param {string} contractAddress - Smart contract address
 * @param {Array} abi - Contract ABI
 * @param {string} functionName - Function to call
 * @param {Array} args - Function arguments
 * @returns {Promise<string>} Transaction hash
 */
export const sendTransactionWithTemporaryWallet = async (
    address,
    contractAddress,
    abi,
    functionName,
    args
) => {
    try {
        // Get the wallet information including private key
        const walletInfo = getDerivedWallet(address);

        if (!walletInfo || !walletInfo.privateKey) {
            throw new Error('Could not retrieve temporary wallet private key');
        }

        // Create provider and wallet
        const provider = new ethers.providers.JsonRpcProvider(POLYGON_AMOY_RPC);
        const wallet = new ethers.Wallet(walletInfo.privateKey, provider);

        // Create contract instance
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        // Submit transaction
        const tx = await contract[functionName](...args);

        // Wait for transaction to be mined
        const receipt = await tx.wait();

        // If auto-archive is enabled, archive the wallet after successful transaction
        if (walletInfo.autoArchive) {
            await archiveWallet(address);
        }

        return receipt.transactionHash;
    } catch (error) {
        console.error('Error sending transaction with temporary wallet:', error);
        throw new Error('Failed to submit transaction: ' + error.message);
    }
};

/**
 * Gets a list of active temporary wallets with their balances
 * 
 * @returns {Promise<Array>} Array of wallet objects with balance information
 */
export const getTemporaryWalletsWithBalances = async () => {
    try {
        // Get list of active wallets
        const wallets = listTemporaryWallets('active');

        // Check balance for each wallet
        const walletsWithBalances = await Promise.all(
            wallets.map(async (wallet) => {
                try {
                    const balanceInfo = await checkWalletBalance(wallet.address);
                    return {
                        ...wallet,
                        balance: balanceInfo.balance,
                        hasEnoughFunds: balanceInfo.hasEnough
                    };
                } catch (error) {
                    return {
                        ...wallet,
                        balance: '0',
                        hasEnoughFunds: false,
                        error: error.message
                    };
                }
            })
        );

        return walletsWithBalances;
    } catch (error) {
        console.error('Error getting wallets with balances:', error);
        return [];
    }
};

/**
 * Recycles all unused temporary wallets
 * Archives any wallet that hasn't been used within the specified time period
 * 
 * @param {number} unusedThresholdHours - Number of hours after which to recycle unused wallets
 * @returns {Promise<number>} Number of wallets recycled
 */
export const recycleUnusedWallets = async (unusedThresholdHours = 24) => {
    try {
        // Get all active wallets
        const wallets = listTemporaryWallets('active');

        // Calculate cutoff time
        const cutoffTime = Date.now() - (unusedThresholdHours * 60 * 60 * 1000);

        let recycledCount = 0;

        // Archive wallets older than the cutoff time
        for (const wallet of wallets) {
            if (wallet.createdAt < cutoffTime) {
                const success = await archiveWallet(wallet.address);
                if (success) {
                    recycledCount++;
                }
            }
        }

        return recycledCount;
    } catch (error) {
        console.error('Error recycling unused wallets:', error);
        return 0;
    }
};

export default {
    createAndFundWallet,
    checkWalletBalance,
    fundTemporaryWallet,
    signWithTemporaryWallet,
    sendTransactionWithTemporaryWallet,
    getTemporaryWalletsWithBalances,
    recycleUnusedWallets
}; 