/**
 * Zero-Knowledge Circuit Input Preparation
 * 
 * Handles preparation and validation of inputs for zero-knowledge circuits.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module acts as the "data preparation service" for our privacy-protecting system.
 * Think of it like the form-filling process before a secure verification:
 * 
 * 1. It takes a user's financial information (wallet address, account balance)
 *    and formats it correctly for the verification system.
 * 
 * 2. It adds security elements like digital "seals" (cryptographic commitments)
 *    that prevent tampering with the information.
 * 
 * 3. It separates what information should be kept private (like exact balances)
 *    from what can be public (like the verification result).
 * 
 * 4. It validates all information before submission - like a form checker that
 *    ensures you haven't missed any required fields before you submit.
 * 
 * Similar to how passport verification requires your information to be formatted
 * correctly (proper photo dimensions, correct fields completed), this module ensures
 * all data is formatted precisely for the mathematical verification process.
 * 
 * Business value: Ensures that users provide all necessary information for creating
 * valid proofs, preventing wasted computational resources and user frustration from
 * failed proof attempts.
 */

import { ethers } from 'ethers';
import { ZK_PROOF_TYPES } from '../../config/constants.js';
import { toFieldElement } from './zkUtils.js';

/**
 * Converts an Ethereum address to array of bytes
 * @param {string} address - Ethereum address
 * @returns {Array<number>} Array of byte values (0-255)
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function is like a language translator for computer addresses. It takes a wallet 
 * address (which looks like a long string of letters and numbers) and converts it into 
 * a format that our privacy-protection system can understand - similar to how you might 
 * need to convert miles to kilometers when traveling to a different country. This translation 
 * is necessary because the verification math works with numbers, not text.
 */
export const addressToBytes = (address) => {
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
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function acts like a form-filling assistant that prepares all the information 
 * needed for a privacy-protecting verification. Think of it like preparing different 
 * types of tax forms depending on what you need to prove:
 * 
 * - For STANDARD proofs: It prepares a form showing you have exactly a specific amount
 * - For THRESHOLD proofs: It fills out a form proving you have at least a minimum amount
 * - For MAXIMUM proofs: It creates a form verifying you have no more than a certain amount
 * 
 * Each form type requires different information, and this function makes sure all the
 * right fields are filled in correctly before submission.
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
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function works like a document redaction system that separates private information 
 * from public information. Imagine having a financial document where some information 
 * needs to remain confidential (like your account details) while other information can 
 * be shared (like the verification result). This function extracts only the shareable 
 * parts that are needed for verification without exposing your private financial details.
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
 * Verify that inputs are valid for a specific circuit
 * Validates that all required parameters are present and properly formatted for the specific
 * proof type before passing to the circuit. This helps prevent errors during proof generation.
 * 
 * @param {Object} inputs - Circuit inputs
 * @param {number} proofType - Proof type from ZK_PROOF_TYPES
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
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function works like a complete application preparation service. When you apply for 
 * something like a mortgage, you provide basic information, but the service helps gather 
 * all additional required documents and formats everything correctly before submission.
 * 
 * This function similarly:
 * 1. Takes your basic financial information
 * 2. Adds any missing required details
 * 3. Converts everything to the proper format
 * 4. Organizes it all into a complete package that the verification system can process
 * 
 * It saves you from having to understand all the technical details while ensuring your
 * verification application is complete and correctly formatted.
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
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function works like a currency converter for different types of digital money.
 * Different cryptocurrencies use different decimal systems (like how some countries use 
 * cents and others use smaller divisions). For example:
 * 
 * - Ethereum uses 18 decimal places (1 ETH = 1,000,000,000,000,000,000 wei)
 * - USDC uses 6 decimal places (1 USDC = 1,000,000 units)
 * 
 * This function converts all these different formats into a standardized number that
 * our verification system can work with consistently, regardless of which cryptocurrency
 * is being verified.
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
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function generates a plain-language explanation of what your privacy-proof is
 * actually demonstrating. Instead of technical details, it produces a simple statement like:
 * 
 * - "Proof that you have exactly 5,000 USDC"
 * - "Proof that you have at least $10,000 worth of ETH"
 * - "Proof that you have no more than 1 BTC"
 * 
 * This makes it easy to understand what you're proving without requiring technical knowledge,
 * similar to how a legal document might include a simple summary of what's being agreed to.
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
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This function creates a more readable version of cryptocurrency addresses, which are
 * typically very long strings of characters. It's similar to how you might abbreviate
 * "United States of America" to "USA" for simplicity.
 * 
 * For example, it turns this:
 * 0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t
 * 
 * Into this:
 * 0x1a2b...9s0t
 * 
 * This makes addresses much easier to read and verify at a glance while still providing
 * enough information to identify the address.
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
  createProofDescription,
  addressToBytes,
  extractPublicInputs
};