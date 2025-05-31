/**
 * Zero-Knowledge Proof Service
 * 
 * Handles generation and verification of ZK proofs using snarkjs
 */
import path from 'path';
import fs from 'fs';
import { ApiError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import config from '../config';

// Define valid proof types
const VALID_PROOF_TYPES = ['standard', 'threshold', 'maximum'];

// Import snarkjs dynamically to avoid frontend issues
let snarkjs: any;
try {
  snarkjs = require('snarkjs');
} catch (error) {
  logger.error('Failed to load snarkjs', { error });
}

/**
 * Service for handling ZK proofs
 */
class ZkProofService {
  /**
   * Get circuit paths for a specific proof type
   * 
   * @param proofType Type of proof to generate
   * @returns Object with paths to the wasm, zkey and vkey files
   * @throws ApiError if proof type is invalid or circuit files are missing
   */
  private getCircuitPaths(proofType: string): { wasmPath: string; zkeyPath: string; vkeyPath: string } {
    // Validate proof type
    const normalizedType = proofType.toLowerCase();
    if (!VALID_PROOF_TYPES.includes(normalizedType)) {
      throw new ApiError(400, `Invalid proof type: ${proofType}. Must be one of: ${VALID_PROOF_TYPES.join(', ')}`, 'INVALID_PROOF_TYPE');
    }

    // Get base path for the circuit
    const basePath = config.zkProof.circuitPaths[normalizedType as keyof typeof config.zkProof.circuitPaths];
    if (!basePath) {
      throw new ApiError(500, `Circuit path not configured for proof type: ${proofType}`, 'CIRCUIT_NOT_CONFIGURED');
    }

    // Construct full paths
    const wasmPath = `${basePath}.wasm`;
    const zkeyPath = `${basePath}.zkey`;
    const vkeyPath = `${basePath}.vkey.json`;

    // Verify files exist
    if (!fs.existsSync(wasmPath)) {
      throw new ApiError(500, `WASM file not found for proof type: ${proofType}`, 'CIRCUIT_FILE_NOT_FOUND');
    }
    if (!fs.existsSync(zkeyPath)) {
      throw new ApiError(500, `ZKey file not found for proof type: ${proofType}`, 'CIRCUIT_FILE_NOT_FOUND');
    }
    if (!fs.existsSync(vkeyPath)) {
      throw new ApiError(500, `Verification key not found for proof type: ${proofType}`, 'CIRCUIT_FILE_NOT_FOUND');
    }

    return { wasmPath, zkeyPath, vkeyPath };
  }

  /**
   * Validate input for a specific proof type
   * 
   * @param proofType Type of proof to validate input for
   * @param input Input data for the proof
   * @throws ApiError if input is invalid
   */
  private validateInput(proofType: string, input: any): void {
    const normalizedType = proofType.toLowerCase();

    // Basic validation - ensure input is provided
    if (!input) {
      throw new ApiError(400, 'Input data is required', 'MISSING_INPUT');
    }

    // Common validations for all proof types
    if (!input.userAddress) {
      throw new ApiError(400, 'User address is required', 'MISSING_USER_ADDRESS');
    }

    // Proof type specific validations
    switch (normalizedType) {
      case 'standard':
        if (!input.balance) {
          throw new ApiError(400, 'Balance is required for standard proof', 'MISSING_BALANCE');
        }
        if (!input.threshold) {
          throw new ApiError(400, 'Threshold is required for standard proof', 'MISSING_THRESHOLD');
        }
        break;
      
      case 'threshold':
        if (!input.totalBalance) {
          throw new ApiError(400, 'Total balance is required for threshold proof', 'MISSING_TOTAL_BALANCE');
        }
        if (!input.threshold) {
          throw new ApiError(400, 'Threshold is required for threshold proof', 'MISSING_THRESHOLD');
        }
        if (!input.networkId) {
          throw new ApiError(400, 'Network ID is required for threshold proof', 'MISSING_NETWORK_ID');
        }
        break;
      
      case 'maximum':
        if (!input.maxBalance) {
          throw new ApiError(400, 'Maximum balance is required for maximum proof', 'MISSING_MAX_BALANCE');
        }
        if (!input.threshold) {
          throw new ApiError(400, 'Threshold is required for maximum proof', 'MISSING_THRESHOLD');
        }
        if (!input.networks || !Array.isArray(input.networks) || input.networks.length === 0) {
          throw new ApiError(400, 'Networks array is required for maximum proof', 'MISSING_NETWORKS');
        }
        break;
    }
  }

  /**
   * Generate a ZK proof
   * 
   * @param proofType Type of proof to generate
   * @param input Input data for the proof
   * @returns Generated proof and public signals
   * @throws ApiError if proof generation fails
   */
  async generateProof(proofType: string, input: any): Promise<any> {
    try {
      // Ensure snarkjs is loaded
      if (!snarkjs) {
        throw new Error('snarkjs library not loaded');
      }

      // Normalize proof type to lowercase
      const normalizedType = proofType.toLowerCase();

      // Validate input for the proof type
      this.validateInput(normalizedType, input);

      // Get circuit paths
      const { wasmPath, zkeyPath } = this.getCircuitPaths(normalizedType);

      // Log proof generation attempt
      logger.info('Generating ZK proof', { proofType: normalizedType });

      // Generate the proof using snarkjs
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

      // Log successful proof generation
      logger.info('ZK proof generated successfully', { proofType: normalizedType });

      return { proof, publicSignals };
    } catch (error) {
      // Log the error
      logger.error('ZK proof generation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        proofType, 
        input: JSON.stringify(input).substring(0, 100) + '...' // Log a truncated version of input for debugging
      });

      // Rethrow as ApiError if it's not already one
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500, 
        'Failed to generate ZK proof', 
        'PROOF_GENERATION_ERROR', 
        { message: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Verify a ZK proof
   * 
   * @param proofType Type of proof to verify
   * @param proof Proof to verify
   * @param publicSignals Public signals for verification
   * @returns True if the proof is valid
   * @throws ApiError if verification fails
   */
  async verifyProof(proofType: string, proof: any, publicSignals: any): Promise<boolean> {
    try {
      // Ensure snarkjs is loaded
      if (!snarkjs) {
        throw new Error('snarkjs library not loaded');
      }

      // Normalize proof type to lowercase
      const normalizedType = proofType.toLowerCase();

      // Get verification key path
      const { vkeyPath } = this.getCircuitPaths(normalizedType);

      // Load verification key
      const verificationKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

      // Log verification attempt
      logger.info('Verifying ZK proof', { proofType: normalizedType });

      // Verify the proof using snarkjs
      const isValid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);

      // Log verification result
      logger.info('ZK proof verification result', { proofType: normalizedType, isValid });

      return isValid;
    } catch (error) {
      // Log the error
      logger.error('ZK proof verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        proofType
      });

      // Rethrow as ApiError if it's not already one
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500, 
        'Failed to verify ZK proof', 
        'PROOF_VERIFICATION_ERROR', 
        { message: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}

// Export singleton instance
export const zkProofService = new ZkProofService();

// Export individual methods for easier mocking in tests
export const { generateProof, verifyProof } = zkProofService;