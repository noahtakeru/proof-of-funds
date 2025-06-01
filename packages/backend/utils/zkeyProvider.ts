/**
 * ZKey Provider Interface
 * 
 * This module defines a unified interface for managing ZK proving keys.
 * It abstracts the underlying storage mechanism (Secret Manager or Cloud Storage)
 * to provide a consistent API for the rest of the application.
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Interface defining a ZKey provider
 */
export interface ZKeyProvider {
  /**
   * Upload a ZKey file to the storage backend
   * @param circuitName Name of the circuit (standard, threshold, maximum)
   * @param localPath Local path to the zkey file
   * @returns Promise resolving to the path/identifier of the uploaded key
   */
  uploadZKey(circuitName: string, localPath: string): Promise<string>;
  
  /**
   * Retrieve a ZKey from the storage backend
   * @param circuitName Name of the circuit
   * @returns Promise resolving to the ZKey data buffer
   */
  getZKey(circuitName: string): Promise<Buffer>;
  
  /**
   * Generate a proof using the stored ZKey
   * @param circuitName Name of the circuit
   * @param input Input for the circuit
   * @param wasmPath Path to the circuit WASM file
   * @returns Promise resolving to the generated proof and public signals
   */
  generateProof(circuitName: string, input: any, wasmPath: string): Promise<{ proof: any, publicSignals: any }>;
}

/**
 * Base implementation with common functionality for ZKey providers
 */
export abstract class BaseZKeyProvider implements ZKeyProvider {
  /**
   * Abstract method to be implemented by concrete providers
   */
  abstract uploadZKey(circuitName: string, localPath: string): Promise<string>;
  
  /**
   * Abstract method to be implemented by concrete providers
   */
  abstract getZKey(circuitName: string): Promise<Buffer>;
  
  /**
   * Common proof generation method
   * @param circuitName Name of the circuit
   * @param input Input for the circuit
   * @param wasmPath Path to the WASM file
   */
  async generateProof(circuitName: string, input: any, wasmPath: string): Promise<{ proof: any, publicSignals: any }> {
    const snarkjs = require('snarkjs');
    
    try {
      // Get zkey from storage
      const zkeyData = await this.getZKey(circuitName);
      
      // Write to temporary file
      const tempPath = `/tmp/${circuitName}-${Date.now()}.zkey`;
      await fs.writeFile(tempPath, zkeyData);
      
      try {
        // Generate proof
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          input,
          wasmPath,
          tempPath
        );
        
        return { proof, publicSignals };
      } finally {
        // Cleanup temporary file
        try {
          await fs.unlink(tempPath);
        } catch (error) {
          console.warn(`Failed to remove temporary zkey file: ${tempPath}`, error);
        }
      }
    } catch (error) {
      console.error(`Error generating proof for ${circuitName}:`, error);
      throw error;
    }
  }
}

/**
 * Factory for creating ZKey providers
 */
export class ZKeyProviderFactory {
  /**
   * Create a ZKey provider based on the specified type
   * @param type Provider type ('secret-manager' or 'cloud-storage')
   * @returns The created ZKey provider
   */
  static createProvider(type: 'secret-manager' | 'cloud-storage'): ZKeyProvider {
    if (type === 'secret-manager') {
      const { SecretManagerZKeyProvider } = require('./zkeySecretManagerProvider');
      return new SecretManagerZKeyProvider();
    } else if (type === 'cloud-storage') {
      const { CloudStorageZKeyProvider } = require('./zkeyCloudStorageProvider');
      return new CloudStorageZKeyProvider();
    } else {
      throw new Error(`Unsupported ZKey provider type: ${type}`);
    }
  }
}

export default ZKeyProviderFactory;