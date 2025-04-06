/**
 * Zero-Knowledge Proof Utility Functions
 * 
 * Provides helper functions for working with zero-knowledge proofs,
 * including serialization, hash generation, and value conversion.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module contains a toolbox of helper functions for our privacy system.
 * Think of it like a specialized workshop with all the necessary tools to:
 * 
 * 1. FORMAT DATA: Convert regular numbers and values into the special formats
 *    needed by the zero-knowledge system (like translating between languages).
 * 
 * 2. PROCESS ARRAYS: Prepare and standardize data arrays to ensure they're
 *    exactly the right size and format (like cutting fabric to exact measurements).
 * 
 * 3. PACKAGE PROOFS: Convert complex mathematical proofs into formats that
 *    can be easily stored or transmitted (like packaging a fragile item for shipping).
 * 
 * 4. SECURITY CHECKS: Generate cryptographic hashes that help verify the
 *    integrity of data (like creating tamper-evident seals).
 * 
 * Business value: Makes the complex cryptography work reliably behind the scenes,
 * prevents errors in proof processing, and enables privacy-preserving operations to
 * function consistently across different parts of the application.
 */

// Import dependencies
import { getEthers } from '../ethersUtils.js';
import pkg from 'js-sha3';
const { keccak256 } = pkg;
// Use SHA3-256 since SHA-256 is not available
const sha256 = pkg.sha3_256;

/**
 * Converts a number to the field element representation used in zk circuits
 * 
 * @param {number|string|BigInt} value - The number to convert
 * @returns {string} Field element representation
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function converts regular numbers into the special format required by our
 * zero-knowledge system. It's like converting dollars to a specific foreign currency
 * before traveling - without this conversion, our privacy system wouldn't be able to
 * perform calculations properly. Accurate number formatting is essential for generating
 * valid proofs.
 */
export const toFieldElement = async (value) => {
  // Ensure we're working with a BigInt
  let bigIntValue;

  if (typeof value === 'bigint') {
    bigIntValue = value;
  } else if (typeof value === 'number' || typeof value === 'string') {
    bigIntValue = BigInt(value);
  } else {
    throw new Error('Invalid value type for field element conversion');
  }

  // Get field size from ethers
  const { ethers } = await getEthers();

  // Use modulo to ensure value is within field
  const SNARK_FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const fieldElement = ((bigIntValue % SNARK_FIELD_SIZE) + SNARK_FIELD_SIZE) % SNARK_FIELD_SIZE;

  return fieldElement.toString();
};

/**
 * Pads an array to the specified length with the provided padding value
 * 
 * @param {Array} arr - Array to pad
 * @param {number} length - Target length
 * @param {any} padValue - Value to use for padding
 * @returns {Array} Padded array
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function ensures data arrays are the exact size our system expects.
 * It's like making sure a form has all fields filled out, even if some need
 * to be marked "N/A". Without proper padding, our zero-knowledge system might
 * reject the input data or produce incorrect results. This standardization
 * is essential for reliable proof generation.
 */
export const padArray = (arr, length, padValue = 0) => {
  if (arr.length >= length) return arr.slice(0, length);

  return [...arr, ...Array(length - arr.length).fill(padValue)];
};

/**
 * Serializes a ZK proof for transmission or storage
 * 
 * @param {Object} proof - The ZK proof object
 * @param {Array} publicSignals - Public signals array
 * @returns {Object} Serialized proof with stringified components
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function packages a zero-knowledge proof into a format that can be easily
 * transmitted or stored. It's like putting a complex 3D object into a flat shipping box - 
 * converting a complex mathematical object into a standard format that can be sent
 * over the internet or stored in a database. This ensures proofs can be shared
 * between different parts of our system while maintaining their integrity.
 */
export const serializeZKProof = (proof, publicSignals) => {
  // Validate inputs
  if (!proof || typeof proof !== 'object') {
    throw new Error('Invalid proof object provided for serialization');
  }

  if (!Array.isArray(publicSignals)) {
    throw new Error('Public signals must be an array');
  }

  // Convert proof components to strings
  const serializedProof = {
    pi_a: Array.isArray(proof.pi_a) ? proof.pi_a.map(x => x.toString()) : [],
    pi_b: Array.isArray(proof.pi_b) ? proof.pi_b.map(arr => arr.map(x => x.toString())) : [],
    pi_c: Array.isArray(proof.pi_c) ? proof.pi_c.map(x => x.toString()) : [],
    protocol: proof.protocol || 'groth16'
  };

  // Convert signals to strings
  const serializedSignals = publicSignals.map(x => x.toString());

  // Return serialized data
  return {
    proof: serializedProof,
    publicSignals: serializedSignals
  };
};

/**
 * Deserializes a ZK proof from its string format
 * 
 * @param {Object} serializedProof - The serialized proof object
 * @param {Array} serializedPublicSignals - Serialized public signals array
 * @returns {Object} The deserialized proof and signals
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function converts a proof from its transmission format back into the
 * mathematical object our system can work with. It's like unpacking that 3D object
 * from its shipping box. Without proper deserialization, we couldn't verify proofs
 * that have been sent over the network or retrieved from storage. This ensures
 * received proofs can be properly processed by our verification system.
 */
export const deserializeZKProof = (serializedProof, serializedPublicSignals) => {
  // Validate inputs
  if (!serializedProof || typeof serializedProof !== 'object') {
    throw new Error('Invalid serialized proof provided');
  }

  if (!Array.isArray(serializedPublicSignals)) {
    throw new Error('Serialized public signals must be an array');
  }

  // Convert proof components to BigInts
  const proof = {
    pi_a: Array.isArray(serializedProof.pi_a) ? serializedProof.pi_a.map(x => BigInt(x)) : [],
    pi_b: Array.isArray(serializedProof.pi_b) ? serializedProof.pi_b.map(arr => arr.map(x => BigInt(x))) : [],
    pi_c: Array.isArray(serializedProof.pi_c) ? serializedProof.pi_c.map(x => BigInt(x)) : [],
    protocol: serializedProof.protocol || 'groth16'
  };

  // Convert signals to BigInts
  const publicSignals = serializedPublicSignals.map(x => BigInt(x));

  // Return deserialized data
  return {
    proof,
    publicSignals
  };
};

/**
 * Generates a hash of a ZK proof for verification purposes
 * 
 * @param {Object} proof - The ZK proof object
 * @param {Array} publicSignals - Public signals array
 * @returns {string} Hex-encoded hash of the proof
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This creates a unique digital fingerprint of a zero-knowledge proof. It's like
 * creating a tamper-evident seal for a document. This fingerprint allows us to
 * quickly verify if a proof has been altered and enables efficient proof lookup
 * without exposing the underlying sensitive data. This is essential for proof
 * verification and management in our system.
 */
export const generateZKProofHash = (proof, publicSignals) => {
  try {
    // Serialize the proof and signals for consistent hashing
    const serialized = JSON.stringify(serializeZKProof(proof, publicSignals));

    // Generate SHA3-256 hash
    return '0x' + sha256(serialized);
  } catch (error) {
    throw new Error(`Failed to generate proof hash: ${error.message}`);
  }
};

/**
 * Converts a buffer or hex string to a field element array
 * 
 * @param {Buffer|string} buffer - The buffer or hex string to convert
 * @returns {Array<string>} Array of field elements
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function converts raw binary data into the specialized number format
 * our zero-knowledge system needs. It's like translating text from one language
 * to another so it can be understood by the recipient. This conversion is crucial
 * when working with data like cryptographic hashes or signatures that need to be
 * included in zero-knowledge proofs.
 */
export const bufferToFieldArray = async (buffer) => {
  // Convert hex string to buffer if needed
  if (typeof buffer === 'string') {
    // Remove '0x' prefix if present
    const hexString = buffer.startsWith('0x') ? buffer.slice(2) : buffer;

    // Ensure even length
    const paddedHex = hexString.length % 2 === 0 ? hexString : '0' + hexString;

    // Create buffer from hex
    buffer = Buffer.from(paddedHex, 'hex');
  }

  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Input must be a buffer or hex string');
  }

  // Convert each 31-byte chunk to a field element
  const elements = [];
  for (let i = 0; i < buffer.length; i += 31) {
    const chunk = buffer.slice(i, i + 31);
    const hex = '0x' + chunk.toString('hex');
    const fieldElement = await toFieldElement(hex);
    elements.push(fieldElement);
  }

  return elements;
};

/**
 * Normalizes an Ethereum address to a checksummed format
 * 
 * @param {string} address - Ethereum address to normalize
 * @returns {string} Normalized address
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This ensures Ethereum addresses are formatted correctly with proper capitalization.
 * It's like standardizing a postal address format to ensure mail gets delivered correctly.
 * Properly formatted addresses help prevent errors when interacting with the blockchain,
 * reducing the risk of funds being sent to incorrect addresses due to formatting issues.
 */
export const normalizeAddress = async (address) => {
  if (!address || typeof address !== 'string') {
    throw new Error('Invalid address');
  }

  // Ensure address has 0x prefix
  const prefixedAddress = address.startsWith('0x') ? address : '0x' + address;

  try {
    // Use ethers to format as checksum address
    const { ethers } = await getEthers();
    return ethers.utils.getAddress(prefixedAddress);
  } catch (error) {
    throw new Error(`Invalid Ethereum address: ${error.message}`);
  }
};

/**
 * Stringifies a BigInt value for JSON compatibility
 * 
 * @param {any} obj - Object that may contain BigInt values
 * @returns {any} Object with BigInt values converted to strings
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function allows us to safely convert very large numbers into a format that
 * can be stored and transmitted. It's like having a special camera that can capture
 * objects too large for normal cameras to handle. This is critical for our system
 * because zero-knowledge proofs use extremely large numbers that regular JavaScript
 * can't handle in JSON format without this conversion.
 */
export const stringifyBigInts = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(stringifyBigInts);
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      result[key] = stringifyBigInts(obj[key]);
    }
    return result;
  }

  return obj;
};

/**
 * Parses stringified BigInt values back to BigInt type
 * 
 * @param {any} obj - Object with stringified BigInt values
 * @returns {any} Object with restored BigInt values
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function converts stored large numbers back into their computational form.
 * It's like translating written music back into actual sound. After retrieving proof
 * data from storage or receiving it over a network, this function converts the string
 * representation of large numbers back into actual BigInt values that our verification
 * system can perform calculations with.
 */
export const parseBigInts = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string' && /^[0-9]+$/.test(obj)) {
    return BigInt(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(parseBigInts);
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      result[key] = parseBigInts(obj[key]);
    }
    return result;
  }

  return obj;
};

/**
 * Formats a number to a user-friendly string with appropriate units
 * 
 * @param {number|string|BigInt} value - Value to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted value
 * 
 * ---------- BUSINESS CONTEXT ----------
 * This function makes numbers more readable for users. It's like displaying
 * "1.5 GB" instead of "1,500,000,000 bytes" - converting raw values into
 * user-friendly formats with appropriate units. This improves the user experience
 * by presenting financial information in familiar formats that are easier to
 * understand at a glance.
 */
export const formatNumber = (value, options = {}) => {
  const {
    precision = 2,
    currency = false,
    compact = false
  } = options;

  let numValue;
  try {
    // Convert to number
    numValue = typeof value === 'bigint' ? Number(value) : Number(value);
  } catch (e) {
    return String(value); // Return original value if conversion fails
  }

  if (isNaN(numValue)) {
    return String(value);
  }

  // Format based on options
  if (currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    }).format(numValue);
  }

  if (compact && Math.abs(numValue) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      minimumFractionDigits: precision > 1 ? 1 : 0,
      maximumFractionDigits: precision > 1 ? 1 : 0
    }).format(numValue);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  }).format(numValue);
};

// Export all utility functions
// Mock functions for testing
export const generateZKProof = async (input, circuit) => {
  // Mock implementation for tests
  return {
    proof: {
      pi_a: ['1', '2', '3'],
      pi_b: [['4', '5'], ['6', '7']],
      pi_c: ['8', '9', '10']
    },
    publicSignals: ['11', '12', '13']
  };
};

export const verifyZKProof = async (proof, publicSignals, verificationKey) => {
  // Mock implementation for tests
  return true;
};

export default {
  toFieldElement,
  padArray,
  serializeZKProof,
  deserializeZKProof,
  generateZKProofHash,
  bufferToFieldArray,
  normalizeAddress,
  stringifyBigInts,
  parseBigInts,
  formatNumber,
  generateZKProof,
  verifyZKProof
};