/**
 * Zero-Knowledge Circuit Input Preparation
 * 
 * Handles preparation and validation of inputs for zero-knowledge circuits.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module prepares the information needed for our privacy-protecting verification system.
 * Think of it like preparing ingredients for a recipe - we need to make sure we have all
 * the right information, in the correct format, before we can create a zero-knowledge proof.
 * This module checks that all required data is present and properly formatted to prevent
 * errors during the proof generation process.
 * 
 * Business value: Ensures that users provide all necessary information for creating
 * valid proofs, preventing wasted computational resources and user frustration from
 * failed proof attempts.
 */

import { ethers } from 'ethers';
import { ZK_PROOF_TYPES } from '../../config/constants';
import { toFieldElement } from './zkUtils.js';

/**
 * Converts an Ethereum address to array of bytes
 * @param {string} address - Ethereum address
 * @returns {Array<number>} Array of byte values (0-255)
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
 * Generates inputs for the ZK circuit based on proof type
 * @param {Object} params - Parameters for input generation
 * @param {string} params.walletAddress - Wallet address
 * @param {string} params.amount - Amount for verification
 * @param {number} params.proofType - Proof type from ZK_PROOF_TYPES
 * @param {Object} params.privateData - Additional private data
 * @returns {Object} Inputs for the ZK circuit
 */
export const generateInputs = async (params) => {
  const { walletAddress, amount, proofType, privateData = {} } = params;

  // Validate inputs
  if (!walletAddress) throw new Error('Wallet address is required');
  if (!amount) throw new Error('Amount is required');
  if (proofType === undefined) throw new Error('Proof type is required');

  // Convert address to bytes for the circuit
  const addressBytes = addressToBytes(walletAddress);

  // Convert amount to a numeric value
  // In a real implementation, this would handle different token decimals
  let numericAmount;
  try {
    // If amount is in wei (string), convert to numeric
    numericAmount = ethers.BigNumber.from(amount).toString();
  } catch (e) {
    // If conversion fails, assume it's already a number/string
    numericAmount = amount.toString();
  }

  // Calculate address hash (simplified version)
  // In a real implementation, this would use a proper hash function
  const addressHash = ethers.utils.keccak256(walletAddress);

  // Generate circuit-specific inputs
  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      return {
        // Private inputs (only known to the prover)
        privateAmount: numericAmount,
        privateAddress: addressBytes,

        // Public inputs (shared with verifier)
        publicAmount: numericAmount,
        publicAddressHash: addressHash
      };

    case ZK_PROOF_TYPES.THRESHOLD:
      return {
        // Private inputs
        privateAmount: numericAmount,
        privateAddress: addressBytes,

        // Public inputs
        thresholdAmount: numericAmount,
        publicAddressHash: addressHash
      };

    case ZK_PROOF_TYPES.MAXIMUM:
      return {
        // Private inputs
        privateAmount: numericAmount,
        privateAddress: addressBytes,

        // Public inputs
        maximumAmount: numericAmount,
        publicAddressHash: addressHash
      };

    default:
      throw new Error(`Invalid proof type: ${proofType}`);
  }
};

/**
 * Extract public inputs from circuit inputs
 * @param {Object} inputs - Full circuit inputs
 * @param {number} proofType - Proof type from ZK_PROOF_TYPES
 * @returns {Object} Only the public inputs
 */
export const extractPublicInputs = (inputs, proofType) => {
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
<<<<<<< Updated upstream
 * Verify that inputs are valid for a specific circuit
 * Validates that all required parameters are present and properly formatted for the specific
 * proof type before passing to the circuit. This helps prevent errors during proof generation.
 * 
 * @param {Object} inputs - Circuit inputs
 * @param {number} proofType - Proof type from ZK_PROOF_TYPES
=======
 * Validates that all required inputs for the given proof type are present
 * 
 * @param {Object} inputs - The input values for the circuit
 * @param {string} proofType - Type of proof being generated
>>>>>>> Stashed changes
 * @returns {boolean} Whether inputs are valid
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function is like a checklist before an important procedure. It verifies that
 * we have all the necessary information before attempting to generate a proof. If any
 * required information is missing, the function will fail and provide helpful error
 * messages explaining what's missing. This prevents wasted time and resources on
 * proof generation attempts that would inevitably fail.
 * 
 * When validation fails, the system provides specific error messages about which
 * fields are missing. This helps users quickly understand what information they
 * need to provide.
 */
export const validateInputs = (inputs, proofType) => {
<<<<<<< Updated upstream
  try {
    // Check if inputs object exists
    if (!inputs) {
      console.error('Validation failed: inputs object is null or undefined');
      return false;
    }

    // Check if proofType is valid
    if (proofType === undefined) {
      console.error('Validation failed: proofType is undefined');
      return false;
    }

    // Validate common fields that all proof types need
    const hasCommonFields = (
      inputs.privateAddress !== undefined &&
      Array.isArray(inputs.privateAddress) &&
      inputs.publicAddressHash !== undefined
    );

    if (!hasCommonFields) {
      console.error('Validation failed: missing common fields');
      return false;
    }

    // Validate proof-specific fields
    switch (proofType) {
      case ZK_PROOF_TYPES.STANDARD:
        // Standard proof requires exact amount fields
        if (inputs.privateAmount === undefined) {
          console.error('Validation failed: standard proof requires privateAmount');
          return false;
        }
        if (inputs.publicAmount === undefined) {
          console.error('Validation failed: standard proof requires publicAmount');
          return false;
        }
        return true;

      case ZK_PROOF_TYPES.THRESHOLD:
        // Threshold proof requires amount and threshold
        if (inputs.privateAmount === undefined) {
          console.error('Validation failed: threshold proof requires privateAmount');
          return false;
        }
        if (inputs.thresholdAmount === undefined) {
          console.error('Validation failed: threshold proof requires thresholdAmount');
          return false;
        }
        return true;

      case ZK_PROOF_TYPES.MAXIMUM:
        // Maximum proof requires amount and maximum
        if (inputs.privateAmount === undefined) {
          console.error('Validation failed: maximum proof requires privateAmount');
          return false;
        }
        if (inputs.maximumAmount === undefined) {
          console.error('Validation failed: maximum proof requires maximumAmount');
          return false;
        }
        return true;

      default:
        console.error(`Validation failed: unknown proof type: ${proofType}`);
        return false;
    }
  } catch (error) {
    console.error('Error during input validation:', error);
=======
  if (!inputs || typeof inputs !== 'object') {
    console.error('Invalid inputs: Must provide an object with input values');
>>>>>>> Stashed changes
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

    case ZK_PROOF_TYPES.ZK:
      if (inputs.salt === undefined) {
        console.error('Missing required field for ZK proof: salt - A random salt value must be provided');
        return false;
      }
      if (inputs.balance === undefined) {
        console.error('Missing required field for ZK proof: balance - The account balance must be provided');
        return false;
      }
      if (inputs.commitment === undefined) {
        console.error('Missing required field for ZK proof: commitment - A commitment value must be provided');
        return false;
      }
      break;
  }

  return true;
};

/**
 * Prepares circuit inputs by converting values to the appropriate format
 * 
 * @param {Object} inputs - Raw input values
 * @param {string} proofType - Type of proof to generate
 * @returns {Promise<Object>} Formatted circuit inputs
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function converts our regular values into the special format needed by the
 * zero-knowledge system. It's like translating a document from English to a specialized
 * technical language. This translation is necessary because zero-knowledge circuits
 * work with a specific numerical format that's different from regular JavaScript numbers.
 * Without this conversion, the circuit would reject our inputs or produce invalid results.
 */
export const prepareCircuitInputs = async (inputs, proofType) => {
  // Validate inputs first
  if (!validateInputs(inputs, proofType)) {
    throw new Error('Invalid inputs for circuit');
  }

  // Prepare basic inputs common to all proof types
  const circuitInputs = {
    accountAddress: inputs.accountAddress,
    tokenSymbol: inputs.tokenSymbol,
    tokenDecimals: await toFieldElement(inputs.tokenDecimals),
  };

  // Prepare specific inputs based on proof type
  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      circuitInputs.amount = await toFieldElement(inputs.amount);
      circuitInputs.balance = await toFieldElement(inputs.balance);

      // The amount must be less than or equal to the balance
      if (BigInt(inputs.amount) > BigInt(inputs.balance)) {
        throw new Error('Amount cannot exceed balance');
      }
      break;

    case ZK_PROOF_TYPES.THRESHOLD:
      circuitInputs.threshold = await toFieldElement(inputs.threshold);
      circuitInputs.balance = await toFieldElement(inputs.balance);

      // Balance must be greater than or equal to threshold for a valid proof
      if (BigInt(inputs.balance) < BigInt(inputs.threshold)) {
        throw new Error('Balance is below the threshold amount');
      }
      break;

    case ZK_PROOF_TYPES.MAXIMUM:
      circuitInputs.maximum = await toFieldElement(inputs.maximum);
      circuitInputs.balance = await toFieldElement(inputs.balance);

      // Balance must be less than or equal to maximum for a valid proof
      if (BigInt(inputs.balance) > BigInt(inputs.maximum)) {
        throw new Error('Balance exceeds the maximum amount');
      }
      break;

    case ZK_PROOF_TYPES.ZK:
      circuitInputs.salt = await toFieldElement(inputs.salt);
      circuitInputs.balance = await toFieldElement(inputs.balance);
      circuitInputs.commitment = await toFieldElement(inputs.commitment);
      break;
  }

  // Add metadata for tracking
  circuitInputs._meta = {
    proofType,
    timestamp: Date.now()
  };

  return circuitInputs;
};

/**
 * Normalizes balance value based on token decimals
 * 
 * @param {string|number} balance - Raw balance value
 * @param {number} decimals - Token decimals
 * @returns {string} Normalized balance
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function adjusts balance values to account for different token decimal places.
 * It's like converting between currencies with different denominations. For example,
 * some tokens might count in whole units while others might count in millionths.
 * This normalization ensures we're always working with the correct numerical scale,
 * which is crucial for accurate proof generation.
 */
export const normalizeBalance = (balance, decimals) => {
  if (typeof balance !== 'string' && typeof balance !== 'number') {
    throw new Error('Balance must be a string or number');
  }

  if (typeof decimals !== 'number' || decimals < 0 || decimals > 18) {
    throw new Error('Decimals must be a number between 0 and 18');
  }

  // Convert to string and remove any decimal point
  const balanceStr = balance.toString();
  let integerValue = balanceStr;
  let fractionalPart = '';

  if (balanceStr.includes('.')) {
    const parts = balanceStr.split('.');
    integerValue = parts[0];
    fractionalPart = parts[1];
  }

  // Pad or truncate fractional part based on decimals
  if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.substring(0, decimals);
  } else {
    fractionalPart = fractionalPart.padEnd(decimals, '0');
  }

  // Remove leading zeros from integer part
  integerValue = integerValue.replace(/^0+/, '') || '0';

  // Combine integer and fractional parts
  return integerValue + fractionalPart;
};

/**
 * Creates a proof description for metadata and user interface
 * 
 * @param {Object} inputs - Proof inputs
 * @param {string} proofType - Type of proof
 * @returns {string} Human-readable description
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function creates a user-friendly description of what a proof is demonstrating.
 * It's like generating a readable summary of a legal document. Instead of showing
 * complex cryptographic data, it provides a clear statement like "Proof that account
 * has at least 1000 USDC". This helps users understand what they're verifying and
 * makes the system more transparent despite its cryptographic complexity.
 */
export const createProofDescription = (inputs, proofType) => {
  if (!inputs || !proofType) {
    return 'Invalid proof';
  }

  switch (proofType) {
    case ZK_PROOF_TYPES.STANDARD:
      return `Proof that account ${shortenAddress(inputs.accountAddress)} has exactly ${inputs.amount} ${inputs.tokenSymbol}`;

    case ZK_PROOF_TYPES.THRESHOLD:
      return `Proof that account ${shortenAddress(inputs.accountAddress)} has at least ${inputs.threshold} ${inputs.tokenSymbol}`;

    case ZK_PROOF_TYPES.MAXIMUM:
      return `Proof that account ${shortenAddress(inputs.accountAddress)} has at most ${inputs.maximum} ${inputs.tokenSymbol}`;

    case ZK_PROOF_TYPES.ZK:
      return `Zero-knowledge proof of balance for account ${shortenAddress(inputs.accountAddress)} in ${inputs.tokenSymbol}`;

    default:
      return `Proof of funds for account ${shortenAddress(inputs.accountAddress)} in ${inputs.tokenSymbol}`;
  }
};

/**
 * Shortens an Ethereum address for display purposes
 * 
 * @param {string} address - Ethereum address
 * @param {number} [chars=4] - Number of characters to show at start/end
 * @returns {string} Shortened address
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function creates a more readable version of a blockchain address.
 * It's like showing "J*** S****" instead of "John Smith" - providing enough
 * information to identify something without showing the entire thing.
 * This improves usability by making addresses more readable and manageable
 * in user interfaces while still allowing users to verify they're looking
 * at the correct account.
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

export default {
  ZK_PROOF_TYPES,
  validateInputs,
  prepareCircuitInputs,
  normalizeBalance,
  createProofDescription
};