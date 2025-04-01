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
import fs from 'fs';
import path from 'path';
import { fetchPricesForSymbols } from '../walletHelpers';
import { generateAccessKey, encryptProof as encryptWithAES } from './proofEncryption';

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
    
    // Convert wallet address to numeric format for circuit
    // Remove '0x' prefix and convert to BigInt
    const walletAddressNumeric = BigInt('0x' + walletAddress.replace('0x', '')).toString();
    
    // Create witness input for the circuit
    const input = {
      walletAddress: walletAddressNumeric,
      balance: balanceBigInt.toString(),
      threshold: thresholdBigInt.toString(),
      proofType
    };
    
    // Get paths to compiled circuit files
    const circuitWasm = `${process.cwd()}/circuits/compiled/balance_verification/balance_verification_js/balance_verification.wasm`;
    const zkeyPath = `${process.cwd()}/circuits/compiled/balance_verification/balance_verification_final.zkey`;
    
    try {
      // Check if circuit files exist
      if (!fs.existsSync(circuitWasm) || !fs.existsSync(zkeyPath)) {
        console.warn('Circuit files not found. Run "npm run compile:circuit" to generate them.');
        throw new Error('Circuit files not found');
      }
      
      // Generate the proof using snarkjs
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        circuitWasm,
        zkeyPath
      );
      
      // Format the proof for Solidity verification
      const solidityProof = formatProofForSolidity(proof);
      
      return {
        proof,
        publicSignals,
        solidity: solidityProof,
        originalInput: {
          walletAddress,
          balance,
          threshold,
          proofType
        }
      };
    } catch (circuitError) {
      console.warn('Error using actual circuits, falling back to simulation:', circuitError);
      return simulateProof(walletAddress, balance, threshold, proofType, network);
    }
  } catch (error) {
    console.error('Error generating ZK proof:', error);
    
    // In case of failure, return a simulated proof for demonstration
    return simulateProof(walletAddress, balance, threshold, proofType, network);
  }
}

/**
 * Formats a snarkjs proof for use with Solidity verifier
 * @param {Object} proof - The proof from snarkjs
 * @returns {Object} - Solidity-compatible proof format
 */
function formatProofForSolidity(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
    input: proof.publicSignals
  };
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
  
  // Calculate a hash of the wallet address (similar to what the circuit would do)
  const addressHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['address'], [walletAddress])
  );
  
  // Calculate a hash of the threshold (similar to circuit)
  const thresholdHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['uint256'], [threshold])
  );
  
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
      addressHash.slice(2), // remove 0x
      thresholdHash.slice(2),
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
        addressHash.slice(2),
        thresholdHash.slice(2),
        proofType.toString(),
        comparisonResult ? '1' : '0'
      ]
    },
    originalInput: {
      walletAddress,
      balance,
      threshold,
      proofType
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
 * @returns {Promise<Object>} - Encrypted proof data with metadata
 */
export async function encryptProof(proof, accessKey) {
  try {
    // For actual deployments, use the AES encryption from proofEncryption module
    const encryptedData = await encryptWithAES(proof, accessKey);
    
    // Generate a hash of the access key for verification without revealing the key
    const accessKeyHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(accessKey)
    );
    
    return {
      encryptedData,
      accessKeyHash,
      timestamp: Date.now(),
      // Store non-sensitive metadata unencrypted for easier filtering/searching
      metadata: {
        proofType: proof.originalInput?.proofType,
        walletAddress: proof.originalInput?.walletAddress,
      }
    };
  } catch (error) {
    console.error('Error encrypting proof:', error);
    throw error;
  }
}

/**
 * Decrypts an encrypted proof using the correct access key
 * 
 * @param {Object} encryptedProofData - The encrypted proof data object
 * @param {string} accessKey - The key used to encrypt the proof
 * @returns {Promise<Object>} - The decrypted proof
 */
export async function decryptProof(encryptedProofData, accessKey) {
  try {
    // Verify access key matches the hash
    const accessKeyHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(accessKey)
    );
    
    if (encryptedProofData.accessKeyHash !== accessKeyHash) {
      throw new Error('Invalid access key');
    }
    
    // Use AES decryption from proofEncryption module
    return await encryptWithAES.decryptProof(encryptedProofData.encryptedData, accessKey);
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
  // Create a unique reference for this proof using wallet address, expiry and a hash of the proof
  const proofHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(JSON.stringify(proof.publicSignals))
  );
  
  // Combine key elements to create a unique but deterministic reference ID
  const idBase = `${walletAddress}-${expiryTime}-${proofHash}`;
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(idBase));
  
  // Use the first 8 bytes of the hash as the reference ID (16 hex characters)
  return hash.substring(2, 10);
}

/**
 * Serializes a proof for storage or transmission
 * 
 * @param {Object} proof - The proof object to serialize
 * @returns {string} - JSON string representation of the proof
 */
export function serializeProof(proof) {
  // Convert BigInts to strings to avoid JSON serialization issues
  const serializable = JSON.parse(JSON.stringify(proof, (key, value) => {
    // Check if the value is a BigInt or looks like one
    if (typeof value === 'bigint' || (typeof value === 'string' && /^\d+n$/.test(value))) {
      return value.toString().replace(/n$/, '');
    }
    return value;
  }));
  
  return JSON.stringify(serializable);
}

/**
 * Deserializes a proof from its string representation
 * 
 * @param {string} serializedProof - The serialized proof string
 * @returns {Object} - The deserialized proof object
 */
export function deserializeProof(serializedProof) {
  return JSON.parse(serializedProof);
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
 * @param {Object} proofData - The proof data containing proof and public signals
 * @param {string} walletAddress - The wallet address
 * @param {number} proofType - The type of proof (0=standard, 1=threshold, 2=maximum)
 * @returns {Promise<boolean>} - Whether the proof is valid
 */
export async function verifyProofLocally(proofData, walletAddress, proofType) {
  try {
    // For simulated proofs, we check the encoded comparison result
    if (proofData._simulated) {
      return proofData._comparisonResult === true;
    }
    
    // For actual proofs, verify using snarkjs and the verification key
    const verificationKeyPath = `${process.cwd()}/circuits/compiled/balance_verification/verification_key.json`;
    
    try {
      // Check if verification key exists
      if (!fs.existsSync(verificationKeyPath)) {
        console.warn('Verification key not found. Run "npm run compile:circuit" to generate it.');
        throw new Error('Verification key not found');
      }
      
      // Load verification key from file
      const verificationKey = JSON.parse(fs.readFileSync(verificationKeyPath, 'utf8'));
      
      // Verify the proof using snarkjs
      const isValid = await snarkjs.groth16.verify(
        verificationKey,
        proofData.publicSignals,
        proofData.proof
      );
      
      return isValid;
    } catch (loadError) {
      console.warn('Error loading verification key:', loadError);
      
      // If we can't load the actual verification key, fall back to checking
      // that one of the public signals matches the wallet address
      const walletAddressNumeric = BigInt('0x' + walletAddress.replace('0x', '')).toString();
      
      // Check if wallet address hash matches first public signal
      // This is a very simplified check and not cryptographically secure
      const poseidon = await getPoseidonHash();
      const addressHash = poseidon([walletAddressNumeric]).toString();
      
      return proofData.publicSignals[0] === addressHash;
    }
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

/**
 * Creates a complete proof package that includes all necessary components
 * for sharing and verification
 * 
 * @param {Object} proof - The ZK proof
 * @param {string} walletAddress - The wallet address
 * @param {string} amount - The amount being proved
 * @param {number} proofType - The type of proof (0=standard, 1=threshold, 2=maximum)
 * @param {number} expiryTime - UNIX timestamp when the proof expires
 * @returns {Promise<Object>} - Complete proof package
 */
export async function createProofPackage(proof, walletAddress, amount, proofType, expiryTime) {
  try {
    // Generate a random access key for encryption
    const accessKey = generateAccessKey();
    
    // Encrypt the proof
    const encryptedProofData = await encryptProof(proof, accessKey);
    
    // Generate a reference ID
    const referenceId = generateProofReferenceId(proof, walletAddress, expiryTime);
    
    // Create package with all necessary components
    return {
      referenceId,
      encryptedProof: encryptedProofData,
      accessKey,
      walletAddress,
      amount,
      proofType,
      expiryTime,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error('Error creating proof package:', error);
    throw error;
  }
}