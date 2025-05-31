/**
 * Verification Result Formatter Service
 * 
 * This service standardizes the output format of proof verification results
 * across different proof types. It provides consistent formatting for both
 * successful and failed verifications, including detailed verification data.
 */

import { BigNumber } from 'ethers';

/**
 * Supported proof types
 */
export type ProofType = 'standard' | 'threshold' | 'maximum' | 'balance' | 'transaction' | 'custom';

/**
 * Verification status
 */
export type VerificationStatus = 'success' | 'failure' | 'error' | 'pending';

/**
 * Common verification result structure
 */
export interface VerificationResult {
  status: VerificationStatus;
  proofType: ProofType;
  timestamp: number;         // Unix timestamp when verification was performed
  verificationTime?: number; // Time taken to verify in milliseconds
  verified: boolean;         // Whether the proof was successfully verified
  
  // Data specifics (varies by proof type)
  data: {
    wallet?: string;         // The wallet address being verified
    amount?: BigNumber;      // The amount being verified (for threshold/standard/maximum proofs)
    tokenSymbol?: string;    // Symbol of the token (ETH, USDC, etc.)
    transactionHash?: string; // Transaction hash (for transaction proofs)
    thresholdAmount?: BigNumber; // Minimum amount (for threshold proofs)
    maximumAmount?: BigNumber; // Maximum amount (for maximum proofs)
    balanceDate?: number;    // Date of balance (for balance proofs)
    publicInputs?: string[]; // ZK proof public inputs
    circuit?: string;        // Circuit name or identifier
    chainId?: number;        // Chain ID the proof refers to
    [key: string]: any;      // Additional custom data fields
  };
  
  // Metadata (additional information)
  metadata: {
    version: string;         // Formatter version
    expiryTime?: number;     // Expiration time (unix timestamp)
    proofHash?: string;      // Hash of the proof data
    createdBy?: string;      // Who/what created the proof
    verifiedBy?: string;     // Who/what verified the proof
    [key: string]: any;      // Additional metadata fields
  };
  
  // Error information (only present if status is 'error' or 'failure')
  error?: {
    code: string;            // Error code
    message: string;         // Human-readable error message
    details?: any;           // Additional error details
    errorType?: string;      // Type of error (e.g., 'ZK_ERROR', 'VALIDATION_ERROR')
  };
}

/**
 * Verification Result Formatter
 */
export class VerificationResultFormatter {
  private readonly version = '1.0.0';
  
  /**
   * Format a successful verification result
   * 
   * @param proofType Type of proof that was verified
   * @param data Proof-specific data
   * @param metadata Additional metadata
   * @param verificationTime Time taken to verify in milliseconds
   * @returns Formatted verification result
   */
  formatSuccess(
    proofType: ProofType,
    data: Record<string, any>,
    metadata: Record<string, any> = {},
    verificationTime?: number
  ): VerificationResult {
    const now = Date.now();
    return {
      status: 'success',
      proofType,
      timestamp: Math.floor(now / 1000),
      verified: true,
      verificationTime,
      data,
      metadata: {
        ...metadata,
        version: this.version,
      }
    };
  }
  
  /**
   * Format a failed verification result
   * 
   * @param proofType Type of proof that failed verification
   * @param errorCode Error code
   * @param errorMessage Human-readable error message
   * @param data Proof-specific data
   * @param errorDetails Additional error details
   * @param metadata Additional metadata
   * @param verificationTime Time taken to verify in milliseconds
   * @returns Formatted verification result
   */
  formatFailure(
    proofType: ProofType,
    errorCode: string,
    errorMessage: string,
    data: Record<string, any> = {},
    errorDetails: Record<string, any> = {},
    metadata: Record<string, any> = {},
    verificationTime?: number
  ): VerificationResult {
    const now = Date.now();
    return {
      status: 'failure',
      proofType,
      timestamp: Math.floor(now / 1000),
      verified: false,
      verificationTime,
      data,
      metadata: {
        ...metadata,
        version: this.version,
      },
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
        errorType: errorCode.split('_')[0]
      }
    };
  }
  
  /**
   * Format an error result (when verification couldn't be completed)
   * 
   * @param proofType Type of proof that encountered an error
   * @param errorCode Error code
   * @param errorMessage Human-readable error message
   * @param errorDetails Additional error details
   * @param metadata Additional metadata
   * @returns Formatted verification result
   */
  formatError(
    proofType: ProofType,
    errorCode: string,
    errorMessage: string,
    errorDetails: Record<string, any> = {},
    metadata: Record<string, any> = {}
  ): VerificationResult {
    const now = Date.now();
    return {
      status: 'error',
      proofType,
      timestamp: Math.floor(now / 1000),
      verified: false,
      data: {},
      metadata: {
        ...metadata,
        version: this.version,
      },
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
        errorType: errorCode.split('_')[0]
      }
    };
  }
  
  /**
   * Format a pending verification result
   * 
   * @param proofType Type of proof pending verification
   * @param data Proof-specific data
   * @param metadata Additional metadata
   * @returns Formatted verification result
   */
  formatPending(
    proofType: ProofType,
    data: Record<string, any> = {},
    metadata: Record<string, any> = {}
  ): VerificationResult {
    const now = Date.now();
    return {
      status: 'pending',
      proofType,
      timestamp: Math.floor(now / 1000),
      verified: false,
      data,
      metadata: {
        ...metadata,
        version: this.version,
      }
    };
  }
  
  /**
   * Prepares verification result for UI display
   * Formats dates and other values for human readability
   * 
   * @param result Verification result to format for display
   * @returns UI-friendly verification result
   */
  formatForUI(result: VerificationResult): Record<string, any> {
    // Create formatted dates for timestamp and expiry
    const formattedDate = (timestamp: number): string => {
      return new Date(timestamp * 1000).toLocaleString();
    };
    
    // Format verification time
    const formatVerificationTime = (ms?: number): string => {
      if (!ms) return 'Unknown';
      if (ms < 1000) return `${ms.toFixed(0)}ms`;
      return `${(ms / 1000).toFixed(2)}s`;
    };
    
    // Get descriptive name for proof type
    const getProofTypeName = (type: string): string => {
      switch(type.toLowerCase()) {
        case 'standard': return 'Standard (Exact Amount)';
        case 'threshold': return 'Threshold (Minimum Amount)';
        case 'maximum': return 'Maximum (Maximum Amount)';
        case 'balance': return 'Balance Proof';
        case 'transaction': return 'Transaction Proof';
        default: return type.charAt(0).toUpperCase() + type.slice(1);
      }
    };
    
    // Format for UI display
    return {
      verified: result.verified,
      status: result.status,
      proofType: getProofTypeName(result.proofType),
      timestamp: formattedDate(result.timestamp),
      expiryTime: result.metadata.expiryTime ? formattedDate(result.metadata.expiryTime) : undefined,
      verificationTime: formatVerificationTime(result.verificationTime),
      
      // Format data fields for display
      proofDetails: {
        user: result.data.wallet,
        thresholdAmount: result.data.amount?.toString() || result.data.thresholdAmount?.toString(),
        tokenSymbol: result.data.tokenSymbol,
        txHash: result.data.transactionHash,
        proofHash: result.metadata.proofHash,
        // Add any custom data fields here
        ...Object.entries(result.data).reduce((acc, [key, value]) => {
          if (!['wallet', 'amount', 'tokenSymbol', 'transactionHash', 'thresholdAmount', 'maximumAmount'].includes(key)) {
            acc[key] = value?.toString() || value;
          }
          return acc;
        }, {} as Record<string, any>)
      },
      
      // Include error information if present
      errorMessage: result.error?.message,
      errorCode: result.error?.code,
      errorDetails: result.error?.details
    };
  }
  
  /**
   * Converts a legacy verification result to the new standard format
   * 
   * @param legacyResult Old format verification result
   * @returns Standardized verification result
   */
  convertLegacyResult(legacyResult: any): VerificationResult {
    // Extract data from legacy format
    const {
      verified,
      proofType = 'standard',
      proofDetails,
      verificationTime,
      error,
      errorMessage,
      errorType,
      publicSignals,
      vkeyPath,
    } = legacyResult;
    
    if (verified) {
      // Handle successful verification
      return this.formatSuccess(
        proofType as ProofType,
        {
          wallet: proofDetails?.user,
          amount: proofDetails?.thresholdAmount,
          tokenSymbol: proofDetails?.tokenSymbol,
          transactionHash: proofDetails?.txHash,
          publicInputs: publicSignals,
        },
        {
          proofHash: proofDetails?.proofHash,
          expiryTime: proofDetails?.expiryTime ? 
            (typeof proofDetails.expiryTime === 'string' ? 
              Math.floor(new Date(proofDetails.expiryTime).getTime() / 1000) : 
              proofDetails.expiryTime) : 
            undefined,
        },
        verificationTime
      );
    } else {
      // Handle failed verification
      return this.formatFailure(
        proofType as ProofType,
        error?.errorType || errorType || 'VERIFICATION_ERROR',
        errorMessage || error?.message || 'Verification failed',
        {
          wallet: proofDetails?.user,
          amount: proofDetails?.thresholdAmount,
          tokenSymbol: proofDetails?.tokenSymbol,
          transactionHash: proofDetails?.txHash,
          publicInputs: publicSignals,
        },
        error?.details || { vkeyPath },
        {
          proofHash: proofDetails?.proofHash,
          expiryTime: proofDetails?.expiryTime ? 
            (typeof proofDetails.expiryTime === 'string' ? 
              Math.floor(new Date(proofDetails.expiryTime).getTime() / 1000) : 
              proofDetails.expiryTime) : 
            undefined,
        },
        verificationTime
      );
    }
  }
}

export default VerificationResultFormatter;