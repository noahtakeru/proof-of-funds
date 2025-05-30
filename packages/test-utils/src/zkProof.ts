/**
 * Zero-Knowledge Proof Testing Utilities
 * 
 * Provides tools for ZK proof generation and verification in tests
 */
import path from 'path';
import fs from 'fs';
import { ethers } from 'ethers';

// Sample inputs for different proof types
export const sampleProofInputs = {
  standard: {
    balance: "1000000000000000000", // 1 ETH in wei
    threshold: "1000000000000000000", // 1 ETH in wei
    userAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
  },
  threshold: {
    totalBalance: "5000000000000000000", // 5 ETH in wei
    threshold: "1000000000000000000", // 1 ETH in wei
    userAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    networkId: 1
  },
  maximum: {
    maxBalance: "1000000000000000000", // 1 ETH in wei
    threshold: "5000000000000000000", // 5 ETH in wei
    userAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    networks: [1, 137, 56, 43114] // Ethereum, Polygon, BSC, Avalanche
  }
};

/**
 * Generate a ZK proof for testing
 * 
 * @param proofType Type of proof to generate
 * @param input Input for the proof (defaults to sample input)
 * @returns Generated proof and public signals
 */
export async function generateTestProof(
  proofType: 'standard' | 'threshold' | 'maximum',
  input: any = sampleProofInputs[proofType]
): Promise<{
  proof: any;
  publicSignals: any;
}> {
  try {
    // Import snarkjs dynamically
    const snarkjs = require('snarkjs');
    
    // Build circuit paths
    const circuitName = `${proofType}Proof`;
    const wasmPath = path.join(process.cwd(), `../../circuits/${proofType}/${circuitName}_js/${circuitName}.wasm`);
    const zkeyPath = path.join(process.cwd(), `../../circuits/${proofType}/${circuitName}.zkey`);
    
    // Check if circuit files exist
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
      throw new Error(`Circuit files not found: ${wasmPath} or ${zkeyPath}`);
    }
    
    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );
    
    return { proof, publicSignals };
  } catch (error) {
    console.error('Failed to generate test proof:', error);
    throw new Error(`Failed to generate test proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify a ZK proof for testing
 * 
 * @param proofType Type of proof to verify
 * @param proof Proof to verify
 * @param publicSignals Public signals from proof generation
 * @returns True if proof is valid, false otherwise
 */
export async function verifyTestProof(
  proofType: 'standard' | 'threshold' | 'maximum',
  proof: any,
  publicSignals: any
): Promise<boolean> {
  try {
    // Import snarkjs dynamically
    const snarkjs = require('snarkjs');
    
    // Build verification key path
    const circuitName = `${proofType}Proof`;
    const vkeyPath = path.join(process.cwd(), `../../circuits/${proofType}/${circuitName}.vkey.json`);
    
    // Check if verification key exists
    if (!fs.existsSync(vkeyPath)) {
      throw new Error(`Verification key not found: ${vkeyPath}`);
    }
    
    // Load verification key
    const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    
    // Verify proof
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    
    return isValid;
  } catch (error) {
    console.error('Failed to verify test proof:', error);
    throw new Error(`Failed to verify test proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a test wallet signature
 * 
 * @param message Message to sign
 * @returns Wallet address and signature
 */
export async function generateTestSignature(message: string): Promise<{
  address: string;
  signature: string;
}> {
  // Create a random wallet
  const wallet = ethers.Wallet.createRandom();
  
  // Sign the message
  const signature = await wallet.signMessage(message);
  
  return {
    address: wallet.address,
    signature
  };
}

/**
 * Create a complete test ZK proof with encryption
 * 
 * @param proofType Type of proof to generate
 * @returns Complete test proof data
 */
export async function createCompleteTestZkProof(
  proofType: 'standard' | 'threshold' | 'maximum' = 'standard'
): Promise<{
  input: any;
  proof: any;
  publicSignals: any;
  encryptionKey: Buffer;
  encryptedData: string;
  referenceId: string;
}> {
  // Import crypto utilities dynamically
  const { generateEncryptionKey, encryptData } = require('@proof-of-funds/backend/dist/utils/crypto');
  const { v4: uuidv4 } = require('uuid');
  
  // Use sample input for the specified proof type
  const input = sampleProofInputs[proofType];
  
  // Generate proof
  const { proof, publicSignals } = await generateTestProof(proofType, input);
  
  // Generate encryption key
  const encryptionKey = generateEncryptionKey();
  
  // Generate reference ID
  const referenceId = `ref-${uuidv4()}`;
  
  // Create proof data
  const proofData = {
    proof,
    publicSignals,
    input,
    proofType,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  };
  
  // Encrypt proof data
  const encryptedData = encryptData(proofData, encryptionKey);
  
  return {
    input,
    proof,
    publicSignals,
    encryptionKey,
    encryptedData,
    referenceId
  };
}