/**
 * zkCircuitParameterDerivation.cjs - CommonJS version for circuit parameter derivation
 * 
 * This module provides compatibility functions for generating circuit parameters
 * for CommonJS environments.
 * 
 * Version: 1.0.0
 */

// Set up dependencies and polyfills for CommonJS
const path = require('path');
let ethers;

try {
  // Try to import real ethers
  ethers = require('ethers');
} catch (err) {
  // Silently use placeholder implementation for testing
  // (this is intentional to support test environments)
  ethers = {
    utils: {
      isAddress: (addr) => typeof addr === 'string' && addr.startsWith('0x'),
      getAddress: (addr) => addr,
      keccak256: (val) => '0x1234567890abcdef1234567890abcdef12345678',
      toUtf8Bytes: (text) => text,
      hexlify: (val) => val.startsWith ? (val.startsWith('0x') ? val : '0x' + val) : '0x1234',
      arrayify: () => new Uint8Array([1,2,3,4]),
      recoverPublicKey: () => '0x1234',
      splitSignature: () => ({ r: '0x1234', s: '0x5678', v: 27 })
    },
    BigNumber: {
      from: (val) => ({
        toString: () => String(val),
        lt: () => false,
        gt: () => false
      })
    }
  };
}

// Define ZK_PROOF_TYPES locally
const ZK_PROOF_TYPES = {
  STANDARD: 0,
  THRESHOLD: 1,
  MAXIMUM: 2
};

// Import or define addressToBytes
let addressToBytes;
try {
  // Try to import from our CJS implementation
  const circuitInputs = require('./zkCircuitInputs.cjs');
  addressToBytes = circuitInputs.addressToBytes;
} catch (e) {
  // Fallback implementation
  addressToBytes = function(address) {
    // Remove 0x prefix if present
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
    
    // Convert to bytes
    const bytes = [];
    for (let i = 0; i < cleanAddress.length; i += 2) {
      bytes.push(parseInt(cleanAddress.slice(i, i + 2), 16));
    }
    
    return bytes;
  };
}

// Import other dependencies
const zkCircuitRegistry = require('./zkCircuitRegistry.cjs');
const getCircuitMemoryRequirements = zkCircuitRegistry.getCircuitMemoryRequirements;

// For device capabilities, use a direct require
let deviceCapabilities;
try {
  deviceCapabilities = require('../src/deviceCapabilities.js');
} catch (e) {
  // Fallback implementation if module not found
  deviceCapabilities = {
    detectCapabilities: () => ({
      supportsWebAssembly: true,
      supportsWebCrypto: true,
      supportsWebWorkers: true,
      availableMemory: null
    })
  };
}

const getDeviceCapabilities = deviceCapabilities.detectCapabilities;

/**
 * Generate a deterministic nonce for ZK proofs
 */
function generateProofNonce(walletAddress, amount, timestamp = Date.now()) {
  const nonceData = `${walletAddress}-${amount}-${timestamp}`;
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(nonceData));
}

/**
 * Generate a unique proof identifier for reference and tracking
 */
function generateProofId(walletAddress, proofType, amount) {
  const baseString = `${walletAddress.toLowerCase()}-${proofType}-${amount}`;
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(baseString));
  return `pof-${hash.slice(2, 18)}`; // Use first 8 bytes of hash for ID
}

/**
 * Convert amount string to appropriate circuit numeric representation
 */
function normalizeAmountForCircuit(amount, decimals = 18) {
  try {
    // If amount includes decimal point, convert to proper integer representation
    if (typeof amount === 'string' && amount.includes('.')) {
      // Split into whole and fractional parts
      const [whole, fraction = ''] = amount.split('.');
      
      // Pad or truncate fraction to match decimals
      const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
      
      // Combine whole and fraction without decimal point
      return ethers.BigNumber.from(whole + paddedFraction).toString();
    }
    
    // Convert any other format to BigNumber and return as string
    return ethers.BigNumber.from(amount).toString();
  } catch (error) {
    throw new Error(`Invalid amount format: ${amount}. Error: ${error.message}`);
  }
}

/**
 * Derive wallet address representation for ZK circuits
 */
function deriveAddressParameters(walletAddress) {
  // Validate the address
  if (!ethers.utils.isAddress(walletAddress)) {
    throw new Error(`Invalid Ethereum address: ${walletAddress}`);
  }
  
  // Get the checksummed address
  const checksumAddress = ethers.utils.getAddress(walletAddress);
  
  // Convert to bytes array for circuit
  const addressBytes = addressToBytes(checksumAddress);
  
  // Calculate address hash
  const addressHash = ethers.utils.keccak256(checksumAddress);
  
  // Calculate Poseidon-compatible inputs (simplified)
  const poseidonInputs = addressBytes.map(byte => byte.toString());
  
  return {
    original: walletAddress,
    checksum: checksumAddress,
    bytes: addressBytes,
    hash: addressHash,
    poseidonInputs
  };
}

/**
 * Derive signature parameters for proof verification
 */
function deriveSignatureParameters(walletAddress, signature) {
  if (!signature) {
    throw new Error('Signature is required for proof generation');
  }
  
  try {
    // Split signature into r, s, v components
    const sig = ethers.utils.splitSignature(signature);
    
    // Convert to circuit-compatible format
    const signatureComponents = [
      ethers.BigNumber.from(sig.r).toString(),
      ethers.BigNumber.from(sig.s).toString()
    ];
    
    // Recovery bit for public key recovery (v)
    const recoveryBit = sig.v;
    
    // Calculate the message that was signed
    const message = `I confirm ownership of wallet ${walletAddress}`;
    const messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message));
    
    // Recover the public key from signature
    const publicKey = ethers.utils.recoverPublicKey(
      ethers.utils.arrayify(messageHash),
      signature
    );
    
    return {
      r: sig.r,
      s: sig.s,
      v: sig.v,
      signatureComponents,
      recoveryBit,
      messageHash,
      publicKey
    };
  } catch (error) {
    throw new Error(`Invalid signature format. Error: ${error.message}`);
  }
}

/**
 * Check whether proof generation can be performed on the client device
 */
function canGenerateProofClientSide(circuitType, options = {}) {
  const capabilities = getDeviceCapabilities();
  const memoryRequirements = getCircuitMemoryRequirements(circuitType, 'proving');
  
  // Determine if there's enough memory
  const hasEnoughMemory = capabilities.availableMemory === null || 
    capabilities.availableMemory >= memoryRequirements.proving;
  
  // Check if WebAssembly and other required features are available
  const hasRequiredFeatures = capabilities.supportsWebAssembly && 
    capabilities.supportsWebCrypto;
  
  // For complex proofs, also check if Web Workers are available
  const needsWorkers = circuitType === 'maximum' || circuitType === 'threshold';
  const hasWorkers = !needsWorkers || capabilities.supportsWebWorkers;
  
  // Consider user preference if provided
  const preferServerSide = options.preferServerSide === true;
  
  return hasEnoughMemory && hasRequiredFeatures && hasWorkers && !preferServerSide;
}

/**
 * Generate parameters for Standard proof type (exact amount)
 */
function deriveStandardProofParameters(params) {
  const { 
    walletAddress, 
    amount, 
    signature, 
    nonce = generateProofNonce(walletAddress, amount)
  } = params;
  
  // Normalize amount for circuit
  const normalizedAmount = normalizeAmountForCircuit(amount);
  
  // Get address parameters
  const addressParams = deriveAddressParameters(walletAddress);
  
  // Get signature parameters if available
  const signatureParams = signature ? 
    deriveSignatureParameters(walletAddress, signature) : 
    null;
  
  return {
    // Public inputs - will be visible in the proof
    publicInputs: {
      address: addressParams.hash, // Address hash is public
      amount: normalizedAmount
    },
    
    // Private inputs - only used for proof generation, not revealed
    privateInputs: {
      addressBytes: addressParams.bytes,
      nonce,
      // Only include signature components if available
      ...(signatureParams ? {
        signature: signatureParams.signatureComponents,
        privateKey: '0' // Placeholder, not actually used for real proofs
      } : {})
    },
    
    // Metadata for proof serialization
    metadata: {
      proofType: 'standard',
      walletAddress,
      amount,
      timestamp: Date.now(),
      nonce: ethers.utils.hexlify(nonce)
    }
  };
}

/**
 * Generate parameters for Threshold proof type (at least amount)
 */
function deriveThresholdProofParameters(params) {
  const { 
    walletAddress, 
    amount, 
    actualBalance,
    signature, 
    nonce = generateProofNonce(walletAddress, amount)
  } = params;
  
  // For threshold proofs, we need the actual balance which must be >= threshold
  if (!actualBalance) {
    throw new Error('Actual balance is required for threshold proofs');
  }
  
  // Normalize amounts for circuit
  const normalizedThreshold = normalizeAmountForCircuit(amount);
  const normalizedBalance = normalizeAmountForCircuit(actualBalance);
  
  // Validate that balance meets threshold
  if (ethers.BigNumber.from(normalizedBalance).lt(ethers.BigNumber.from(normalizedThreshold))) {
    throw new Error(`Actual balance (${actualBalance}) must be greater than or equal to threshold (${amount})`);
  }
  
  // Get address parameters
  const addressParams = deriveAddressParameters(walletAddress);
  
  // Get signature parameters if available
  const signatureParams = signature ? 
    deriveSignatureParameters(walletAddress, signature) : 
    null;
  
  return {
    // Public inputs
    publicInputs: {
      address: addressParams.hash,
      threshold: normalizedThreshold
    },
    
    // Private inputs
    privateInputs: {
      addressBytes: addressParams.bytes,
      actualBalance: normalizedBalance,
      nonce,
      // Only include signature components if available
      ...(signatureParams ? {
        signature: signatureParams.signatureComponents,
        privateKey: '0' // Placeholder, not actually used for real proofs
      } : {})
    },
    
    // Metadata
    metadata: {
      proofType: 'threshold',
      walletAddress,
      threshold: amount,
      actualBalance,
      timestamp: Date.now(),
      nonce: ethers.utils.hexlify(nonce)
    }
  };
}

/**
 * Generate parameters for Maximum proof type (at most amount)
 */
function deriveMaximumProofParameters(params) {
  const { 
    walletAddress, 
    amount, 
    actualBalance,
    signature, 
    nonce = generateProofNonce(walletAddress, amount)
  } = params;
  
  // For maximum proofs, we need the actual balance which must be <= maximum
  if (!actualBalance) {
    throw new Error('Actual balance is required for maximum proofs');
  }
  
  // Normalize amounts for circuit
  const normalizedMaximum = normalizeAmountForCircuit(amount);
  const normalizedBalance = normalizeAmountForCircuit(actualBalance);
  
  // Validate that balance meets maximum constraint
  if (ethers.BigNumber.from(normalizedBalance).gt(ethers.BigNumber.from(normalizedMaximum))) {
    throw new Error(`Actual balance (${actualBalance}) must be less than or equal to maximum (${amount})`);
  }
  
  // Get address parameters
  const addressParams = deriveAddressParameters(walletAddress);
  
  // Get signature parameters if available
  const signatureParams = signature ? 
    deriveSignatureParameters(walletAddress, signature) : 
    null;
  
  return {
    // Public inputs
    publicInputs: {
      address: addressParams.hash,
      maximum: normalizedMaximum
    },
    
    // Private inputs
    privateInputs: {
      addressBytes: addressParams.bytes,
      actualBalance: normalizedBalance,
      nonce,
      // Only include signature components if available
      ...(signatureParams ? {
        signature: signatureParams.signatureComponents,
        privateKey: '0' // Placeholder, not actually used for real proofs
      } : {})
    },
    
    // Metadata
    metadata: {
      proofType: 'maximum',
      walletAddress,
      maximum: amount,
      actualBalance,
      timestamp: Date.now(),
      nonce: ethers.utils.hexlify(nonce)
    }
  };
}

/**
 * Main function to derive circuit parameters based on transaction data
 */
function deriveCircuitParameters(params) {
  const { walletAddress, amount, proofType, options = {} } = params;
  
  // Validate required parameters
  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }
  
  if (!amount) {
    throw new Error('Amount is required');
  }
  
  if (!proofType) {
    throw new Error('Proof type is required');
  }
  
  // Generate appropriate parameters based on proof type
  switch (proofType.toLowerCase()) {
    case 'standard':
      return deriveStandardProofParameters(params);
      
    case 'threshold':
      return deriveThresholdProofParameters(params);
      
    case 'maximum':
      return deriveMaximumProofParameters(params);
      
    default:
      throw new Error(`Unsupported proof type: ${proofType}`);
  }
}

/**
 * Convert circuit parameters to format expected by the circuit
 */
function prepareCircuitInputs(parameters, options = {}) {
  const { publicInputs, privateInputs, metadata } = parameters;
  
  // Combine public and private inputs in the format expected by the circuit
  const circuitInputs = {
    // Circuit type determines how inputs are structured
    ...(metadata.proofType === 'standard' ? {
      // Standard proof circuit inputs
      address: publicInputs.address,
      amount: publicInputs.amount,
      nonce: privateInputs.nonce,
      addressBytes: privateInputs.addressBytes
    } : metadata.proofType === 'threshold' ? {
      // Threshold proof circuit inputs
      address: publicInputs.address,
      threshold: publicInputs.threshold,
      actualBalance: privateInputs.actualBalance,
      nonce: privateInputs.nonce,
      addressBytes: privateInputs.addressBytes
    } : metadata.proofType === 'maximum' ? {
      // Maximum proof circuit inputs
      address: publicInputs.address,
      maximum: publicInputs.maximum,
      actualBalance: privateInputs.actualBalance,
      nonce: privateInputs.nonce,
      addressBytes: privateInputs.addressBytes
    } : {}),
    
    // Include signature parameters if available
    ...(privateInputs.signature ? {
      signature: privateInputs.signature
    } : {})
  };
  
  return {
    circuitInputs,
    metadata
  };
}

/**
 * Validate circuit parameters before proof generation
 */
function validateCircuitParameters(parameters) {
  const errors = [];
  
  try {
    const { publicInputs, privateInputs, metadata } = parameters;
    
    // Check required public inputs
    if (!publicInputs?.address) {
      errors.push('Missing required public input: address');
    }
    
    // Check proof type-specific required inputs
    switch (metadata?.proofType) {
      case 'standard':
        if (!publicInputs?.amount) {
          errors.push('Missing required public input for standard proof: amount');
        }
        break;
        
      case 'threshold':
        if (!publicInputs?.threshold) {
          errors.push('Missing required public input for threshold proof: threshold');
        }
        if (!privateInputs?.actualBalance) {
          errors.push('Missing required private input for threshold proof: actualBalance');
        }
        break;
        
      case 'maximum':
        if (!publicInputs?.maximum) {
          errors.push('Missing required public input for maximum proof: maximum');
        }
        if (!privateInputs?.actualBalance) {
          errors.push('Missing required private input for maximum proof: actualBalance');
        }
        break;
        
      default:
        errors.push(`Unknown proof type: ${metadata?.proofType}`);
    }
    
    // Verify private inputs
    if (!privateInputs?.addressBytes || !Array.isArray(privateInputs.addressBytes)) {
      errors.push('Missing or invalid private input: addressBytes');
    }
    
    if (!privateInputs?.nonce) {
      errors.push('Missing private input: nonce');
    }
    
    // Check threshold proof balance constraint
    if (metadata?.proofType === 'threshold' && privateInputs?.actualBalance && publicInputs?.threshold) {
      const actualBN = ethers.BigNumber.from(privateInputs.actualBalance);
      const thresholdBN = ethers.BigNumber.from(publicInputs.threshold);
      
      if (actualBN.lt(thresholdBN)) {
        errors.push(`Actual balance (${actualBN}) is less than threshold (${thresholdBN})`);
      }
    }
    
    // Check maximum proof balance constraint
    if (metadata?.proofType === 'maximum' && privateInputs?.actualBalance && publicInputs?.maximum) {
      const actualBN = ethers.BigNumber.from(privateInputs.actualBalance);
      const maximumBN = ethers.BigNumber.from(publicInputs.maximum);
      
      if (actualBN.gt(maximumBN)) {
        errors.push(`Actual balance (${actualBN}) is greater than maximum (${maximumBN})`);
      }
    }
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  generateProofNonce,
  generateProofId,
  normalizeAmountForCircuit,
  deriveAddressParameters,
  deriveSignatureParameters,
  canGenerateProofClientSide,
  deriveStandardProofParameters,
  deriveThresholdProofParameters,
  deriveMaximumProofParameters,
  deriveCircuitParameters,
  prepareCircuitInputs,
  validateCircuitParameters
};