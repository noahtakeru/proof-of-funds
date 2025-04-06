/**
 * Integration Test Vectors
 * 
 * This module provides test vectors for integration testing with real
 * cryptographic operations and real wallet data.
 */

import { ethers } from 'ethers';

/**
 * Converts an Ethereum address to bytes array for circuit input
 * @param {string} address - Ethereum address
 * @returns {Array<number>} Address as bytes array
 */
function addressToBytes(address) {
  // Remove 0x prefix
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  
  // Convert to bytes array
  const bytes = [];
  for (let i = 0; i < cleanAddress.length; i += 2) {
    bytes.push(parseInt(cleanAddress.slice(i, i + 2), 16));
  }
  
  return bytes;
}

/**
 * Get test wallets with their address in bytes format
 * @returns {Array<Object>} Array of test wallet objects
 */
export function getTestWallets() {
  // These are test wallets that should never be used in production
  const wallets = [
    {
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      privateKey: '0x0123456789012345678901234567890123456789012345678901234567890123',
      balance: '2000000000000000000' // 2 ETH
    },
    {
      address: '0x2e8f4f9e9982039ea2eecbedf9e0c16cc44fcb0d',
      privateKey: '0x1111111111111111111111111111111111111111111111111111111111111111',
      balance: '500000000000000000' // 0.5 ETH
    },
    {
      address: '0x9a3dbe2c3be118fc78a526f2c5182b272b192d0b',
      privateKey: '0x2222222222222222222222222222222222222222222222222222222222222222',
      balance: '10000000000000000000' // 10 ETH
    }
  ];
  
  // Add address bytes to each wallet
  return wallets.map(wallet => ({
    ...wallet,
    addressBytes: addressToBytes(wallet.address)
  }));
}

/**
 * Generate standard proof test vectors for real testing
 * @returns {Array<Object>} Test vectors for standard proof
 */
export function getStandardProofVectors() {
  const wallets = getTestWallets();
  
  return [
    // Valid standard proof - exact match of 1 ETH
    {
      walletAddress: wallets[0].address,
      addressBytes: wallets[0].addressBytes,
      amount: '1000000000000000000', // 1 ETH
      expectedResult: true,
      description: 'Standard proof with exact amount match'
    },
    // Wallet has sufficient balance but amount doesn't match
    {
      walletAddress: wallets[0].address,
      addressBytes: wallets[0].addressBytes,
      amount: '1500000000000000000', // 1.5 ETH (wallet has 2 ETH)
      expectedResult: false,
      description: 'Standard proof with mismatched amount (valid wallet)'
    },
    // Wallet doesn't have sufficient balance
    {
      walletAddress: wallets[1].address,
      addressBytes: wallets[1].addressBytes,
      amount: '1000000000000000000', // 1 ETH (wallet has only 0.5 ETH)
      expectedResult: false,
      description: 'Standard proof with insufficient balance'
    }
  ];
}

/**
 * Generate threshold proof test vectors for real testing
 * @returns {Array<Object>} Test vectors for threshold proof
 */
export function getThresholdProofVectors() {
  const wallets = getTestWallets();
  
  return [
    // Valid threshold proof - wallet has more than threshold
    {
      walletAddress: wallets[0].address,
      addressBytes: wallets[0].addressBytes,
      amount: '1500000000000000000', // 1.5 ETH threshold (wallet has 2 ETH)
      actualBalance: '2000000000000000000', // 2 ETH
      expectedResult: true,
      description: 'Threshold proof with wallet having more than threshold'
    },
    // Valid threshold proof - wallet has exactly threshold
    {
      walletAddress: wallets[0].address,
      addressBytes: wallets[0].addressBytes,
      amount: '2000000000000000000', // 2 ETH threshold (wallet has 2 ETH)
      actualBalance: '2000000000000000000', // 2 ETH
      expectedResult: true,
      description: 'Threshold proof with wallet having exactly threshold'
    },
    // Invalid threshold proof - wallet has less than threshold
    {
      walletAddress: wallets[1].address,
      addressBytes: wallets[1].addressBytes,
      amount: '1000000000000000000', // 1 ETH threshold (wallet has 0.5 ETH)
      actualBalance: '500000000000000000', // 0.5 ETH
      expectedResult: false,
      description: 'Threshold proof with wallet having less than threshold'
    }
  ];
}

/**
 * Generate maximum proof test vectors for real testing
 * @returns {Array<Object>} Test vectors for maximum proof
 */
export function getMaximumProofVectors() {
  const wallets = getTestWallets();
  
  return [
    // Valid maximum proof - wallet has less than maximum
    {
      walletAddress: wallets[1].address,
      addressBytes: wallets[1].addressBytes,
      amount: '1000000000000000000', // 1 ETH maximum (wallet has 0.5 ETH)
      actualBalance: '500000000000000000', // 0.5 ETH
      expectedResult: true,
      description: 'Maximum proof with wallet having less than maximum'
    },
    // Valid maximum proof - wallet has exactly maximum
    {
      walletAddress: wallets[0].address,
      addressBytes: wallets[0].addressBytes,
      amount: '2000000000000000000', // 2 ETH maximum (wallet has 2 ETH)
      actualBalance: '2000000000000000000', // 2 ETH
      expectedResult: true,
      description: 'Maximum proof with wallet having exactly maximum'
    },
    // Invalid maximum proof - wallet has more than maximum
    {
      walletAddress: wallets[2].address,
      addressBytes: wallets[2].addressBytes,
      amount: '5000000000000000000', // 5 ETH maximum (wallet has 10 ETH)
      actualBalance: '10000000000000000000', // 10 ETH
      expectedResult: false,
      description: 'Maximum proof with wallet having more than maximum'
    }
  ];
}

export default {
  getTestWallets,
  getStandardProofVectors,
  getThresholdProofVectors,
  getMaximumProofVectors,
  addressToBytes
};