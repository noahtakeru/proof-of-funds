/**
 * ZK Proof Generation Strategies
 * 
 * This module defines different strategies for loading and processing ZK proof files.
 * It implements the Strategy pattern to provide different ways to access ZKey files.
 */

import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { createZkError, ZkErrorType } from '@proof-of-funds/common/src/error-handling';

/**
 * Base interface for ZK proof generation strategies
 */
export class ZkProofStrategy {
  /**
   * Initialize the strategy
   */
  async initialize() {
    // Default implementation does nothing
  }

  /**
   * Get WASM file path for the given proof type
   * @param {string} proofType - The proof type (standard, threshold, maximum)
   * @returns {string} - Path to the WASM file
   */
  async getWasmPath(proofType) {
    throw new Error('Method getWasmPath not implemented');
  }

  /**
   * Get ZKey data for the given proof type
   * @param {string} proofType - The proof type (standard, threshold, maximum)
   * @returns {Buffer|string} - ZKey data or path
   */
  async getZKeyData(proofType) {
    throw new Error('Method getZKeyData not implemented');
  }

  /**
   * Get verification key for the given proof type
   * @param {string} proofType - The proof type (standard, threshold, maximum)
   * @returns {Object} - Verification key data
   */
  async getVerificationKey(proofType) {
    throw new Error('Method getVerificationKey not implemented');
  }

  /**
   * Clean up any resources used by the strategy
   */
  async cleanup() {
    // Default implementation does nothing
  }
}

/**
 * Strategy that uses public files from web directory
 */
export class PublicFilesStrategy extends ZkProofStrategy {
  async getWasmPath(proofType) {
    const wasmPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${proofType}Proof.wasm`);
    
    // Verify that circuit file exists
    if (!fs.existsSync(wasmPath)) {
      throw createZkError('Circuit WASM file not found', {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { wasmPath }
      });
    }
    
    return wasmPath;
  }

  async getZKeyData(proofType) {
    const zkeyPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${proofType}Proof.zkey`);
    
    // Verify that circuit file exists
    if (!fs.existsSync(zkeyPath)) {
      throw createZkError('Circuit zkey file not found', {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { zkeyPath }
      });
    }
    
    return zkeyPath;
  }

  async getVerificationKey(proofType) {
    const vkeyPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${proofType}Proof.vkey.json`);
    
    // Verify that verification key exists
    if (!fs.existsSync(vkeyPath)) {
      throw createZkError('Verification key file not found', {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { vkeyPath }
      });
    }
    
    return JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
  }
}

/**
 * Strategy that uses secure local files from circuits directory
 */
export class SecureLocalStrategy extends ZkProofStrategy {
  async getWasmPath(proofType) {
    const wasmPath = path.join(
      process.cwd(), 
      'circuits', 
      proofType, 
      `${proofType}Proof_js`,
      `${proofType}Proof.wasm`
    );
    
    // Verify that circuit file exists
    try {
      await fsPromises.access(wasmPath);
      return wasmPath;
    } catch (error) {
      throw createZkError(`Circuit WASM file not found: ${wasmPath}`, {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { wasmPath }
      });
    }
  }

  async getZKeyData(proofType) {
    const zkeyPath = path.join(
      process.cwd(), 
      'circuits', 
      proofType, 
      `${proofType}Proof.zkey`
    );
    
    // Verify that circuit file exists
    try {
      await fsPromises.access(zkeyPath);
      return zkeyPath;
    } catch (error) {
      throw createZkError(`Circuit zkey file not found: ${zkeyPath}`, {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { zkeyPath }
      });
    }
  }

  async getVerificationKey(proofType) {
    const vkeyPath = path.join(
      process.cwd(), 
      'circuits', 
      proofType, 
      `${proofType}Proof.vkey.json`
    );
    
    // Verify that verification key exists
    try {
      const vkeyData = await fsPromises.readFile(vkeyPath, 'utf8');
      return JSON.parse(vkeyData);
    } catch (error) {
      throw createZkError(`Verification key file not found: ${vkeyPath}`, {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { vkeyPath }
      });
    }
  }
}

/**
 * Strategy that uses Google Cloud Storage for ZKey files
 */
export class CloudStorageStrategy extends ZkProofStrategy {
  constructor() {
    super();
    this.storageManager = null;
  }

  async initialize() {
    // Dynamically import to support tree shaking
    const ZKeyStorageManager = require('./zkeyStorageManager');
    this.storageManager = new ZKeyStorageManager();
  }

  async getWasmPath(proofType) {
    // Even with cloud storage, WASM files are still loaded from local filesystem
    const wasmPath = path.join(
      process.cwd(),
      '../../../circuits',
      proofType,
      `${proofType}Proof_js`,
      `${proofType}Proof.wasm`
    );
    
    // Verify that circuit file exists
    if (!fs.existsSync(wasmPath)) {
      throw createZkError(`Circuit WASM file not found: ${wasmPath}`, {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { wasmPath }
      });
    }
    
    return wasmPath;
  }

  async getZKeyData(proofType) {
    if (!this.storageManager) {
      await this.initialize();
    }
    
    try {
      // Get the actual zkey data from cloud storage
      return await this.storageManager.getZKey(proofType);
    } catch (error) {
      throw createZkError('Error retrieving ZKey from cloud storage', {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { 
          proofType,
          storageError: error.message 
        }
      });
    }
  }

  async getVerificationKey(proofType) {
    const vkeyPath = path.join(
      process.cwd(),
      '../../../circuits',
      proofType,
      `${proofType}Proof.vkey.json`
    );
    
    // Verify that verification key exists
    if (!fs.existsSync(vkeyPath)) {
      throw createZkError(`Verification key file not found: ${vkeyPath}`, {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { vkeyPath }
      });
    }
    
    return JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
  }

  async cleanup() {
    // Clean up storage manager if needed
    this.storageManager = null;
  }
}

/**
 * Factory function to create the appropriate strategy
 * @param {string} strategyType - The strategy type to use
 * @returns {ZkProofStrategy} - The initialized strategy
 */
export function createProofStrategy(strategyType = 'public') {
  switch (strategyType.toLowerCase()) {
    case 'public':
      return new PublicFilesStrategy();
    case 'secure':
      return new SecureLocalStrategy();
    case 'cloud':
      return new CloudStorageStrategy();
    default:
      throw new Error(`Unknown strategy type: ${strategyType}`);
  }
}

export default {
  createProofStrategy,
  ZkProofStrategy,
  PublicFilesStrategy,
  SecureLocalStrategy,
  CloudStorageStrategy
};