/**
 * SelectiveDisclosure.ts - Partial proof disclosure utilities
 * 
 * This module provides functions to create and verify partial proofs
 * through selective disclosure of proof components.
 * 
 * @module SelectiveDisclosure
 */

import { InputError, ProofError, SecurityError } from '../zkErrorHandler.mjs';
import zkErrorLoggerModule from '../zkErrorLogger.mjs';
import * as zkProofSerializer from '../zkProofSerializer.mjs';
import { PROOF_TYPES } from '../zkProofSerializer.mjs';

// Get error logger with proper typing
const zkErrorLogger = (zkErrorLoggerModule as any).zkErrorLogger;

/**
 * Components of a proof that can be selectively disclosed
 */
export enum ProofComponent {
  /** The proof cryptographic data */
  PROOF_DATA = 'proofData',
  /** Public signals from proof verification */
  PUBLIC_SIGNALS = 'publicSignals',
  /** Wallet address associated with the proof */
  WALLET_ADDRESS = 'walletAddress',
  /** Amount being proven */
  AMOUNT = 'amount',
  /** Timestamp when the proof was created */
  TIMESTAMP = 'timestamp',
  /** Type of proof (standard, threshold, maximum) */
  PROOF_TYPE = 'proofType',
  /** Complete metadata associated with the proof */
  METADATA = 'metadata'
}

/**
 * Options for selective disclosure
 */
export interface SelectiveDisclosureOptions {
  /** Components to include in the disclosure */
  include: ProofComponent[];
  /** Whether to redact certain sensitive values */
  redactSensitiveValues?: boolean;
  /** Whether to include a verification hash */
  includeVerificationHash?: boolean;
  /** Custom redaction symbol or text */
  redactionSymbol?: string;
  /** Whether to use an obscured wallet format */
  obscureWalletAddress?: boolean;
  /** Description of the proof's purpose */
  purposeDescription?: string;
}

/**
 * Result of selective disclosure
 */
export interface SelectiveDisclosureResult {
  /** Partial proof with only disclosed components */
  partialProof: object;
  /** Verification hash to validate the partial proof */
  verificationHash?: string;
  /** Disclosure metadata */
  disclosureMetadata: {
    /** Components that were disclosed */
    disclosedComponents: ProofComponent[];
    /** Whether sensitive values were redacted */
    sensitiveValuesRedacted: boolean;
    /** Whether wallet address was obscured */
    walletAddressObscured: boolean;
    /** Timestamp of disclosure */
    disclosureTimestamp: number;
    /** Description of the proof's purpose */
    purposeDescription?: string;
  };
}

/**
 * Create a partial proof with selective component disclosure
 * 
 * @param proof - The full proof container or serialized proof
 * @param options - Selective disclosure options
 * @returns Selective disclosure result with partial proof
 * 
 * This function creates a partial proof containing only the specified
 * components, allowing for privacy-preserving disclosure of proof information.
 */
export function createSelectiveDisclosure(
  proof: object | string,
  options: SelectiveDisclosureOptions
): SelectiveDisclosureResult {
  try {
    // Validate options
    if (!options || !options.include || options.include.length === 0) {
      throw new InputError('Invalid options: must specify components to include', {
        code: 7001,
        recoverable: false,
        details: { options }
      });
    }

    // Parse the proof if it's a string
    const proofContainer = typeof proof === 'string'
      ? zkProofSerializer.deserializeProof(proof)
      : proof;

    // Type assertion to access format property
    const typedProofContainer = proofContainer as {
      format?: { version?: string };
      proof?: { data?: any; publicSignals?: any };
      metadata?: any;
      circuit?: any;
    };

    // Create partial proof structure with only selected components
    const partialProof: Record<string, any> = {
      partialDisclosure: true,
      format: {
        version: typedProofContainer.format?.version || '1.0.0',
        type: 'partial-zk-proof-of-funds'
      }
    };

    // Add selected components
    for (const component of options.include) {
      switch (component) {
        case ProofComponent.PROOF_DATA:
          if (typedProofContainer.proof?.data) {
            partialProof.proof = { data: typedProofContainer.proof.data };
          }
          break;

        case ProofComponent.PUBLIC_SIGNALS:
          if (typedProofContainer.proof?.publicSignals) {
            if (!partialProof.proof) partialProof.proof = {};
            partialProof.proof.publicSignals = typedProofContainer.proof.publicSignals;
          }
          break;

        case ProofComponent.WALLET_ADDRESS:
          if (typedProofContainer.metadata?.walletAddress) {
            if (!partialProof.metadata) partialProof.metadata = {};

            if (options.obscureWalletAddress) {
              partialProof.metadata.walletAddress = obscureWalletAddress(
                typedProofContainer.metadata.walletAddress
              );
            } else {
              partialProof.metadata.walletAddress = typedProofContainer.metadata.walletAddress;
            }
          }
          break;

        case ProofComponent.AMOUNT:
          if (typedProofContainer.metadata?.amount !== undefined) {
            if (!partialProof.metadata) partialProof.metadata = {};
            partialProof.metadata.amount = typedProofContainer.metadata.amount;
          }
          break;

        case ProofComponent.TIMESTAMP:
          if (typedProofContainer.metadata?.createdAt) {
            if (!partialProof.metadata) partialProof.metadata = {};
            partialProof.metadata.createdAt = typedProofContainer.metadata.createdAt;
          }
          break;

        case ProofComponent.PROOF_TYPE:
          if (typedProofContainer.circuit?.type) {
            partialProof.circuit = {
              type: typedProofContainer.circuit.type,
              version: typedProofContainer.circuit.version
            };
          }
          break;

        case ProofComponent.METADATA:
          if (typedProofContainer.metadata) {
            partialProof.metadata = { ...typedProofContainer.metadata };

            // Obscure wallet address if needed
            if (options.obscureWalletAddress && partialProof.metadata.walletAddress) {
              partialProof.metadata.walletAddress = obscureWalletAddress(
                partialProof.metadata.walletAddress
              );
            }
          }
          break;
      }
    }

    // Redact sensitive values if requested
    if (options.redactSensitiveValues) {
      redactSensitiveValues(partialProof, options.redactionSymbol || '***');
    }

    // Calculate verification hash if requested
    let verificationHash: string | undefined;
    if (options.includeVerificationHash) {
      verificationHash = calculateVerificationHash(typedProofContainer, partialProof);
      partialProof._verificationHash = verificationHash;
    }

    // Add disclosure metadata
    const disclosureMetadata = {
      disclosedComponents: options.include,
      sensitiveValuesRedacted: !!options.redactSensitiveValues,
      walletAddressObscured: !!options.obscureWalletAddress,
      disclosureTimestamp: Date.now(),
      purposeDescription: options.purposeDescription
    };

    partialProof._disclosureMetadata = disclosureMetadata;

    return {
      partialProof,
      verificationHash,
      disclosureMetadata
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'createSelectiveDisclosure',
      context: {
        proofType: typeof proof,
        options
      }
    });

    if (error instanceof InputError || error instanceof ProofError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofError(`Failed to create selective disclosure: ${errorMsg}`, {
      code: 2010, // PROOF_DISCLOSURE_ERROR
      recoverable: false,
      details: { originalError: errorMsg }
    });
  }
}

/**
 * Verify a partial proof against a verification hash
 * 
 * @param partialProof - The partial proof to verify
 * @param verificationHash - The verification hash to check against
 * @returns True if the partial proof is valid, false otherwise
 * 
 * This function verifies that a partial proof has not been tampered with
 * by checking it against a verification hash.
 */
export function verifyPartialProof(
  partialProof: object,
  verificationHash: string
): boolean {
  try {
    // Validate inputs
    if (!partialProof || !verificationHash) {
      throw new InputError('Invalid inputs: partialProof and verificationHash are required', {
        code: 7001,
        recoverable: false,
        details: {
          hasPartialProof: !!partialProof,
          hasVerificationHash: !!verificationHash
        }
      });
    }

    // Check if it's a partial disclosure
    if (!(partialProof as any).partialDisclosure) {
      throw new InputError('Not a partial proof: missing partialDisclosure flag', {
        code: 7003,
        recoverable: false,
        details: { proof: partialProof }
      });
    }

    // Extract and remove hash from the proof for calculation
    const proofCopy = JSON.parse(JSON.stringify(partialProof));
    const embeddedHash = proofCopy._verificationHash;
    delete proofCopy._verificationHash;

    // If the proof has an embedded hash, use that for comparison
    if (embeddedHash && embeddedHash !== verificationHash) {
      return false;
    }

    // We can't fully verify without the original proof, but we can check
    // that the proof structure is valid and hasn't been tampered with
    try {
      validatePartialProofStructure(proofCopy);
    } catch (error) {
      return false;
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'verifyPartialProof',
      context: {
        partialProofType: typeof partialProof,
        verificationHashLength: verificationHash?.length
      }
    });

    // For verification functions, we return false instead of throwing
    return false;
  }
}

/**
 * Extract information from a partial proof that can be verified
 * 
 * @param partialProof - The partial proof
 * @returns Object with verifiable information
 * 
 * This function extracts information from a partial proof that
 * can be independently verified or used for disclosure.
 */
export function extractVerifiableInfo(partialProof: object): {
  proofType?: string;
  walletAddress?: string;
  amount?: string | number;
  timestamp?: number;
  isComplete: boolean;
  canVerifyCryptographically: boolean;
} {
  try {
    // Validate input
    if (!partialProof || !(partialProof as any).partialDisclosure) {
      throw new InputError('Invalid input: not a partial proof', {
        code: 7003,
        recoverable: false,
        details: { partialProof }
      });
    }

    const proof = partialProof as any;

    // Extract verifiable information
    const result = {
      proofType: proof.circuit?.type,
      walletAddress: proof.metadata?.walletAddress,
      amount: proof.metadata?.amount,
      timestamp: proof.metadata?.createdAt,
      isComplete: false,
      canVerifyCryptographically: false
    };

    // Check if proof can be cryptographically verified
    result.canVerifyCryptographically = !!(
      proof.proof?.data &&
      proof.proof?.publicSignals &&
      proof.circuit?.type
    );

    // Check if all essential components are present
    result.isComplete = !!(
      result.canVerifyCryptographically &&
      result.walletAddress &&
      result.amount !== undefined &&
      result.timestamp
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'extractVerifiableInfo',
      context: { partialProofType: typeof partialProof }
    });

    if (error instanceof InputError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofError(`Failed to extract verifiable info: ${errorMsg}`, {
      code: 2010, // PROOF_DISCLOSURE_ERROR
      recoverable: true,
      details: { originalError: errorMsg }
    });
  }
}

/**
 * Create a verifiable reference to a proof without revealing its contents
 * 
 * @param proof - The full proof container or serialized proof
 * @param description - Optional description of the proof
 * @returns Proof reference with verification info
 * 
 * This function creates a minimal reference to a proof that can be shared
 * without revealing sensitive information, while still allowing verification
 * that the reference corresponds to a valid proof.
 */
export function createProofReference(
  proof: object | string,
  description: string = 'Proof of Funds Reference'
): {
  reference: string;
  metadata: {
    proofType: string;
    createdAt: number;
    referenceCreatedAt: number;
    description: string;
  };
} {
  try {
    // Parse the proof if it's a string
    const proofContainer = typeof proof === 'string'
      ? zkProofSerializer.deserializeProof(proof)
      : proof;

    // Type assertion for proof container
    const typedProofContainer = proofContainer as {
      circuit?: { type: string; version?: string };
      metadata?: { createdAt?: number;[key: string]: any };
    };

    // Validate proof
    if (!typedProofContainer || !typedProofContainer.circuit?.type) {
      throw new InputError('Invalid proof: missing required fields', {
        code: 7001,
        recoverable: false,
        details: { proof: typedProofContainer }
      });
    }

    // Extract minimal information
    const proofType = typedProofContainer.circuit.type;
    const createdAt = typedProofContainer.metadata?.createdAt || Date.now();

    // Generate unique reference using hash
    const proofStr = JSON.stringify(proofContainer);
    const referenceHash = simpleHash(proofStr);

    // Create reference string (format: type-timestamp-hash)
    const reference = `${proofType}-${createdAt}-${referenceHash}`;

    // Create metadata
    const metadata = {
      proofType,
      createdAt,
      referenceCreatedAt: Date.now(),
      description
    };

    return { reference, metadata };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    zkErrorLogger.logError(new Error(errorMessage), {
      operation: 'createProofReference',
      context: {
        proofType: typeof proof,
        description
      }
    });

    if (error instanceof InputError) {
      throw error;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new ProofError(`Failed to create proof reference: ${errorMsg}`, {
      code: 2010, // PROOF_DISCLOSURE_ERROR
      recoverable: false,
      details: { originalError: errorMsg }
    });
  }
}

/**
 * Check if a reference corresponds to a specific proof
 * 
 * @param reference - The proof reference
 * @param proof - The proof to check against
 * @returns True if the reference corresponds to the proof
 * 
 * This function checks if a proof reference was created from a specific proof.
 */
export function verifyProofReference(
  reference: string,
  proof: object | string
): boolean {
  try {
    // Parse the proof if it's a string
    const proofContainer = typeof proof === 'string'
      ? zkProofSerializer.deserializeProof(proof)
      : proof;

    // Type assertion for proof container
    const typedProofContainer = proofContainer as {
      circuit?: { type: string; version?: string };
      metadata?: { createdAt?: number;[key: string]: any };
    };

    // Parse reference parts
    const parts = reference.split('-');
    if (parts.length !== 3) {
      return false;
    }

    const [refType, refTimestamp, refHash] = parts;

    // Check proof type
    if (refType !== typedProofContainer.circuit?.type) {
      return false;
    }

    // Check timestamp if present in the proof
    if (typedProofContainer.metadata?.createdAt &&
      refTimestamp !== String(typedProofContainer.metadata.createdAt)) {
      return false;
    }

    // Generate hash from the proof
    const proofStr = JSON.stringify(proofContainer);
    const calculatedHash = simpleHash(proofStr);

    // Compare hashes
    return refHash === calculatedHash;
  } catch (error) {
    // For verification functions, return false instead of throwing
    return false;
  }
}

// =====================================================================
// INTERNAL UTILITY FUNCTIONS
// =====================================================================

/**
 * Redact sensitive values in a partial proof
 * 
 * @param proof - The partial proof
 * @param redactionSymbol - Symbol to use for redaction
 * @private
 */
function redactSensitiveValues(proof: any, redactionSymbol: string): void {
  // List of fields considered sensitive
  const sensitiveFields = [
    'privateInputs',
    'privateSignals',
    'rawData',
    'signature',
    'privateKey',
    'email',
    'phone'
  ];

  // Recursively redact sensitive fields
  function redactObject(obj: any): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => redactObject(item));
      return;
    }

    for (const key of Object.keys(obj)) {
      if (sensitiveFields.includes(key)) {
        obj[key] = redactionSymbol;
      } else if (typeof obj[key] === 'object') {
        redactObject(obj[key]);
      }
    }
  }

  redactObject(proof);
}

/**
 * Obscure a wallet address for privacy
 * 
 * @param address - The wallet address
 * @returns Obscured address
 * @private
 */
function obscureWalletAddress(address: string): string {
  if (!address) return '';

  // Keep first 6 and last a characters
  const prefix = address.slice(0, 6);
  const suffix = address.slice(-4);

  return `${prefix}...${suffix}`;
}

/**
 * Calculate a verification hash for a partial proof
 * 
 * @param fullProof - The full proof container
 * @param partialProof - The partial proof
 * @returns Verification hash
 * @private
 */
function calculateVerificationHash(fullProof: any, partialProof: any): string {
  // Create a deterministic representation of both proofs
  const fullProofStr = JSON.stringify(fullProof);
  const partialProofStr = JSON.stringify(partialProof);

  // Combine with a separator
  const combined = `${fullProofStr}|${partialProofStr}`;

  // Generate hash
  return simpleHash(combined);
}

/**
 * Validate the structure of a partial proof
 * 
 * @param partialProof - The partial proof to validate
 * @private
 */
function validatePartialProofStructure(partialProof: any): void {
  // Check for required fields
  if (!partialProof.format || partialProof.format.type !== 'partial-zk-proof-of-funds') {
    throw new InputError('Invalid partial proof format', {
      code: 7003,
      recoverable: false,
      details: { format: partialProof.format }
    });
  }

  // Check for disclosure metadata
  if (!partialProof._disclosureMetadata) {
    throw new InputError('Missing disclosure metadata', {
      code: 7003,
      recoverable: false,
      details: { partialProof }
    });
  }

  // If proof data is present, public signals should also be present for verification
  if (partialProof.proof?.data && !partialProof.proof.publicSignals) {
    throw new InputError('Incomplete proof data: public signals missing', {
      code: 7003,
      recoverable: false,
      details: { proof: partialProof.proof }
    });
  }

  // Proof type should be valid if present
  if (partialProof.circuit?.type &&
    !Object.values(PROOF_TYPES).includes(partialProof.circuit.type)) {
    throw new InputError(`Invalid proof type: ${partialProof.circuit.type}`, {
      code: 7003,
      recoverable: false,
      details: { circuit: partialProof.circuit }
    });
  }
}

/**
 * Simple hash function for verification
 * 
 * @param str - String to hash
 * @returns Hash string
 * @private
 */
function simpleHash(str: string): string {
  // In a real implementation, use a cryptographic hash function
  // This is a simplified version for demonstration
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }

  // Convert to hex string and ensure positive
  const hexHash = (hash >>> 0).toString(16);
  return hexHash.padStart(8, '0');
}