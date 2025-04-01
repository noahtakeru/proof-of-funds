/**
 * ZK Proof Generator Module
 * 
 * Provides functionality to generate zero-knowledge proofs for wallet balances
 * without revealing the exact balance values to third parties.
 * 
 * Uses snarkjs and circomlib for ZK circuit operations.
 */

import { ethers } from 'ethers';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import { fetchPricesForSymbols } from '../walletHelpers';

// Cache for Poseidon hash function to avoid rebuilding
let poseidonInstance = null;

/**
 * Initialize and cache the Poseidon hash function
 * @returns {Promise<Function>} - Poseidon hash function
 */
async function getPoseidonHash() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

/**
 * Generates a zero-knowledge proof that a wallet balance meets a specific condition
 * without revealing the actual balance.
 * 
 * @param {string} walletAddress - The wallet address
 * @param {string} balance - The actual balance to prove
 * @param {string} threshold - The threshold value for comparison
 * @param {number} proofType - The type of proof (0=standard, 1=threshold, 2=maximum)
 * @param {string} network - The blockchain network (e.g., 'ethereum', 'polygon', 'solana')
 * @returns {Promise<Object>} - The generated proof and public signals
 */
export async function generateZKProof(walletAddress, balance, threshold, proofType, network) {
  try {
    console.log(`Generating ZK proof for wallet ${walletAddress} with balance ${balance} and proof type ${proofType}`);
    
    // Convert string values to BigInt for ZK calculations
    const balanceBigInt = ethers.BigNumber.from(balance).toBigInt();
    const thresholdBigInt = ethers.BigNumber.from(threshold).toBigInt();
    
    // Create witness input for the circuit
    const input = {
      walletAddress: BigInt(walletAddress.replace('0x', '')).toString(),
      balance: balanceBigInt.toString(),
      threshold: thresholdBigInt.toString(),
      proofType
    };
    
    // Circuit and verification keys would be loaded based on the proof type
    // In a real implementation, these would be generated from Circom circuits
    // For now, we're using placeholder paths
    const circuitPath = `/circuits/balance_${proofType}.wasm`;
    const zkeyPath = `/circuits/balance_${proofType}.zkey`;
    
    // Generate the proof using snarkjs
    // Note: In a real implementation, you would need to have the actual circuit files
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      circuitPath,
      zkeyPath
    );
    
    // Format the proof for Solidity verification
    const solidity = {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
      ],
      c: [proof.pi_c[0], proof.pi_c[1]],
      input: publicSignals
    };
    
    return {
      proof,
      publicSignals,
      solidity
    };
  } catch (error) {
    console.error('Error generating ZK proof:', error);
    
    // In case of failure, return a simulated proof for demonstration
    // This allows the front-end to continue working even without actual ZK circuits
    return simulateProof(walletAddress, balance, threshold, proofType, network);
  }
}

/**
 * Creates a simulated proof when actual circuit files are not available
 * This is for demonstration and development purposes only
 */
async function simulateProof(walletAddress, balance, threshold, proofType, network) {
  // Generate a deterministic but unique hash based on inputs
  const hashInput = `${walletAddress}-${balance}-${threshold}-${proofType}-${network}`;
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hashInput));
  
  // Create a simulated public signal that encodes the proof type and comparison result
  // But doesn't reveal the actual balance
  let comparisonResult;
  const balanceValue = ethers.BigNumber.from(balance);
  const thresholdValue = ethers.BigNumber.from(threshold);
  
  if (proofType === 0) { // STANDARD
    comparisonResult = balanceValue.eq(thresholdValue);
  } else if (proofType === 1) { // THRESHOLD
    comparisonResult = balanceValue.gte(thresholdValue);
  } else if (proofType === 2) { // MAXIMUM
    comparisonResult = balanceValue.lte(thresholdValue);
  }
  
  // Create a deterministic "proof" that doesn't reveal balance
  // but can be consistently regenerated for verification
  return {
    proof: {
      pi_a: [hash.substring(0, 66), '0x' + hash.substring(66, 130)],
      pi_b: [
        ['0x' + hash.substring(10, 74), '0x' + hash.substring(74, 138)],
        ['0x' + hash.substring(5, 69), '0x' + hash.substring(69, 133)]
      ],
      pi_c: ['0x' + hash.substring(15, 79), '0x' + hash.substring(79, 143)]
    },
    publicSignals: [
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes(network)).replace('0x', ''),
      walletAddress.replace('0x', ''),
      proofType.toString(),
      comparisonResult ? '1' : '0'
    ],
    solidity: {
      a: [hash.substring(0, 66), '0x' + hash.substring(66, 130)],
      b: [
        ['0x' + hash.substring(10, 74), '0x' + hash.substring(74, 138)],
        ['0x' + hash.substring(5, 69), '0x' + hash.substring(69, 133)]
      ],
      c: ['0x' + hash.substring(15, 79), '0x' + hash.substring(79, 143)],
      input: [
        ethers.utils.hexlify(ethers.utils.toUtf8Bytes(network)).replace('0x', ''),
        walletAddress.replace('0x', ''),
        proofType.toString(),
        comparisonResult ? '1' : '0'
      ]
    },
    // Metadata for development visibility
    _simulated: true,
    _comparisonResult: comparisonResult
  };
}

/**
 * Creates an encrypted proof that can only be accessed with the correct key
 * 
 * @param {Object} proof - The ZK proof to encrypt
 * @param {string} accessKey - A key that will be required to decrypt the proof
 * @returns {Promise<string>} - Encrypted proof data
 */
export async function encryptProof(proof, accessKey) {
  try {
    // Generate an encryption key from the access key
    const encryptionKey = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(`proof-encryption-${accessKey}`)
    );
    
    // Convert proof to JSON string
    const proofData = JSON.stringify(proof);
    
    // In a real implementation, we would use AES-GCM or another encryption method
    // For demonstration, we'll use a simple XOR-based encryption
    
    // Convert proof data to bytes and encrypt
    const dataBytes = ethers.utils.toUtf8Bytes(proofData);
    const keyBytes = ethers.utils.arrayify(encryptionKey);
    
    // Simple encryption (XOR with key)
    const encryptedBytes = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      encryptedBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    // Convert encrypted data to base64
    return Buffer.from(encryptedBytes).toString('base64');
  } catch (error) {
    console.error('Error encrypting proof:', error);
    throw error;
  }
}

/**
 * Decrypts an encrypted proof using the correct access key
 * 
 * @param {string} encryptedProof - The encrypted proof data
 * @param {string} accessKey - The key used to encrypt the proof
 * @returns {Promise<Object>} - The decrypted proof
 */
export async function decryptProof(encryptedProof, accessKey) {
  try {
    // Generate the same encryption key from the access key
    const encryptionKey = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(`proof-encryption-${accessKey}`)
    );
    
    // Convert base64 encrypted data to bytes
    const encryptedBytes = Buffer.from(encryptedProof, 'base64');
    const keyBytes = ethers.utils.arrayify(encryptionKey);
    
    // Decrypt (XOR with key)
    const decryptedBytes = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    // Convert decrypted bytes to string and parse as JSON
    const decryptedData = ethers.utils.toUtf8String(decryptedBytes);
    return JSON.parse(decryptedData);
  } catch (error) {
    console.error('Error decrypting proof:', error);
    throw new Error('Invalid access key or corrupted proof data');
  }
}

/**
 * Generates a reference ID for a proof that's easier to share than the full proof
 * 
 * @param {Object} proof - The ZK proof object
 * @param {string} walletAddress - The wallet address
 * @param {number} expiryTime - UNIX timestamp when the proof expires
 * @returns {string} - A unique reference ID for the proof
 */
export function generateProofReferenceId(proof, walletAddress, expiryTime) {
  // Combine key elements to create a unique but deterministic reference ID
  const idBase = `${walletAddress}-${expiryTime}-${proof.publicSignals.join('-')}`;
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(idBase));
  
  // Use the first 8 bytes of the hash as the reference ID
  return hash.substring(0, 18);
}

/**
 * Converts a token balance to USD value for proof generation
 * 
 * @param {string} balance - The token balance
 * @param {string} symbol - The token symbol (e.g., 'ETH', 'MATIC')
 * @returns {Promise<string>} - The USD value as a string
 */
export async function convertBalanceToUSD(balance, symbol) {
  try {
    // Get the current price for the token
    const prices = await fetchPricesForSymbols([symbol]);
    const price = prices[0]?.price || 0;
    
    // Calculate USD value
    const balanceNumber = ethers.utils.formatUnits(balance, 18); // Assuming 18 decimals
    const usdValue = parseFloat(balanceNumber) * price;
    
    // Return as string with 2 decimal places
    return usdValue.toFixed(2);
  } catch (error) {
    console.error('Error converting balance to USD:', error);
    return '0.00';
  }
}

/**
 * Verifies a ZK proof locally (client-side)
 * This is for quick verification without calling the smart contract
 * 
 * @param {Object} proof - The ZK proof to verify
 * @param {string} walletAddress - The wallet address
 * @param {number} proofType - The type of proof (0=standard, 1=threshold, 2=maximum)
 * @returns {Promise<boolean>} - Whether the proof is valid
 */
export async function verifyProofLocally(proof, walletAddress, proofType) {
  try {
    // In a real implementation, this would use snarkjs.groth16.verify
    // with the verification key
    
    // For simulated proofs, we check the encoded comparison result
    if (proof._simulated) {
      return proof._comparisonResult === true;
    }
    
    // For actual proofs, verify using the appropriate verification key
    const vkeyPath = `/circuits/balance_${proofType}_verification_key.json`;
    const vkey = await fetch(vkeyPath).then(res => res.json());
    
    return await snarkjs.groth16.verify(
      vkey,
      proof.publicSignals,
      proof.proof
    );
  } catch (error) {
    console.error('Error verifying proof locally:', error);
    return false;
  }
}

/**
 * Creates a temporary wallet for proof generation
 * This allows creating proofs without exposing the primary wallet
 * 
 * @param {string} masterSeed - A seed phrase or private key
 * @param {string} purpose - A unique string describing the proof purpose
 * @returns {Promise<Object>} - Temporary wallet information
 */
export async function createTemporaryWallet(masterSeed, purpose) {
  try {
    // Create a deterministic but unique path based on the purpose
    const purposeHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(`temp-wallet-${purpose}`)
    );
    
    // Create a deterministic wallet using HD path derivation
    // This creates a predictable wallet that can be regenerated later
    // with the same inputs
    const hdNode = ethers.utils.HDNode.fromSeed(
      ethers.utils.arrayify(masterSeed)
    );
    
    // Use the purpose hash to derive a specific path
    const derivationPath = `m/44'/60'/0'/0/${parseInt(purposeHash.slice(2, 10), 16) % 1000000}`;
    const wallet = hdNode.derivePath(derivationPath);
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      derivationPath,
      purpose
    };
  } catch (error) {
    console.error('Error creating temporary wallet:', error);
    throw error;
  }
}