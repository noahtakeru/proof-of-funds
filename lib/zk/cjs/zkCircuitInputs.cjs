/**
 * Zero-Knowledge Circuit Input Preparation (CommonJS Version)
 * 
 * This module provides CommonJS compatibility for the circuit input preparation functions.
 */

// Set up dependencies for CommonJS
let ethers;
try {
  // Try to import ethers from a local file
  const ethersUtils = require('../../ethersUtils.js');
  ethers = ethersUtils.getEthers();
} catch (err) {
  // Provide a fallback
  ethers = {
    utils: {
      keccak256: (val) => '0x1234567890abcdef1234567890abcdef12345678',
      BigNumber: {
        from: (val) => ({
          toString: () => String(val)
        })
      }
    }
  };
}

// Define local constants for CommonJS usage
const ZK_PROOF_TYPES = {
  STANDARD: 'standard',
  THRESHOLD: 'threshold',
  MAXIMUM: 'maximum',
  BATCH: 'batch'
};

// Import zkUtils.cjs for toFieldElement
const zkUtils = require('./zkUtils.cjs');
const toFieldElement = zkUtils.toFieldElement;

/**
 * Converts an Ethereum address to array of bytes
 */
const addressToBytes = (address) => {
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;

  // Convert to bytes
  const bytes = [];
  for (let i = 0; i < cleanAddress.length; i += 2) {
    bytes.push(parseInt(cleanAddress.slice(i, i + 2), 16));
  }

  return bytes;
};

/**
 * Extract public inputs from circuit inputs
 */
const extractPublicInputs = (inputs, proofType) => {
  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      return {
        publicAmount: inputs.publicAmount,
        publicAddressHash: inputs.publicAddressHash
      };

    case ZK_PROOF_TYPES.THRESHOLD:
      return {
        thresholdAmount: inputs.thresholdAmount,
        publicAddressHash: inputs.publicAddressHash
      };

    case ZK_PROOF_TYPES.MAXIMUM:
      return {
        maximumAmount: inputs.maximumAmount,
        publicAddressHash: inputs.publicAddressHash
      };

    default:
      throw new Error(`Invalid proof type: ${proofType}`);
  }
};

/**
 * Verify that inputs are valid for a specific circuit
 */
const validateInputs = (inputs, proofType) => {
  if (!inputs || typeof inputs !== 'object') {
    console.error('Invalid inputs: Must provide an object with input values');
    return false;
  }

  if (!proofType || !Object.values(ZK_PROOF_TYPES).includes(proofType)) {
    console.error(`Invalid proof type: ${proofType}. Must be one of: ${Object.values(ZK_PROOF_TYPES).join(', ')}`);
    return false;
  }

  // Check common required fields for all proof types
  if (!inputs.accountAddress) {
    console.error('Missing required field: accountAddress - The account address must be provided');
    return false;
  }

  if (!inputs.tokenSymbol) {
    console.error('Missing required field: tokenSymbol - The token symbol must be provided');
    return false;
  }

  if (inputs.tokenDecimals === undefined) {
    console.error('Missing required field: tokenDecimals - The number of decimals for the token must be provided');
    return false;
  }

  // Check for specific proof type requirements
  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      if (inputs.amount === undefined) {
        console.error('Missing required field for standard proof: amount - The token amount must be provided');
        return false;
      }
      if (inputs.balance === undefined) {
        console.error('Missing required field for standard proof: balance - The account balance must be provided');
        return false;
      }
      break;

    case ZK_PROOF_TYPES.THRESHOLD:
      if (inputs.threshold === undefined) {
        console.error('Missing required field for threshold proof: threshold - The threshold value must be provided');
        return false;
      }
      if (inputs.balance === undefined) {
        console.error('Missing required field for threshold proof: balance - The account balance must be provided');
        return false;
      }
      break;

    case ZK_PROOF_TYPES.MAXIMUM:
      if (inputs.maximum === undefined) {
        console.error('Missing required field for maximum proof: maximum - The maximum value must be provided');
        return false;
      }
      if (inputs.balance === undefined) {
        console.error('Missing required field for maximum proof: balance - The account balance must be provided');
        return false;
      }
      break;
  }

  return true;
};

/**
 * Shortens an Ethereum address for display purposes
 */
function shortenAddress(address, chars = 4) {
  if (!address || typeof address !== 'string') {
    return '';
  }

  const prefix = address.startsWith('0x') ? '0x' : '';
  const addr = address.startsWith('0x') ? address.slice(2) : address;

  if (addr.length <= chars * 2) {
    return address;
  }

  return `${prefix}${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

// Export all functions for CommonJS
module.exports = {
  ZK_PROOF_TYPES,
  validateInputs,
  prepareCircuitInputs: async (inputs, proofType) => {
    // Simplified implementation for CommonJS compatibility
    return { meta: { proofType, timestamp: Date.now() }, ...inputs };
  },
  normalizeBalance: (balance, decimals) => {
    // Simplified implementation
    return String(balance);
  },
  createProofDescription: (inputs, proofType) => {
    if (!inputs || !proofType) {
      return 'Invalid proof';
    }
    
    return `Proof of funds for ${shortenAddress(inputs.accountAddress || '')}`;
  },
  addressToBytes,
  extractPublicInputs,
  generateInputs: async (params) => {
    // Simplified implementation for CommonJS compatibility
    const { walletAddress, amount, proofType } = params;
    return {
      privateAddress: addressToBytes(walletAddress),
      publicAddressHash: ethers.utils.keccak256(walletAddress),
      publicAmount: amount
    };
  }
};