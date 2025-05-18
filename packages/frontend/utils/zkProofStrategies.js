/**
 * ZK Proof Generation Strategies
 * 
 * This module defines different strategies for loading and processing ZK proof files.
 * It implements the Strategy pattern to provide different ways to access ZKey files.
 */

// Use our filesystem shim for better browser compatibility
import { path, fs, promises as fsPromises } from './shims/fs';
// Use local shim for better compatibility with Pages Router
import { createZkError, ZkErrorType } from './shims/error-handling';

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
    const isServer = typeof window === 'undefined';
    
    // In browser environment, use relative URL for direct access
    if (!isServer) {
      return `/lib/zk/circuits/${proofType}Proof.wasm`;
    }
    
    // On server, use filesystem path
    const wasmPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${proofType}Proof.wasm`);
    
    // Verify that circuit file exists
    try {
      if (!fs.existsSync(wasmPath)) {
        throw new Error('File not found');
      }
      return wasmPath;
    } catch (error) {
      throw createZkError('Circuit WASM file not found', {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { wasmPath }
      });
    }
  }

  async getZKeyData(proofType) {
    const isServer = typeof window === 'undefined';
    
    // In browser environment, use relative URL for direct access
    if (!isServer) {
      return `/lib/zk/circuits/${proofType}Proof.zkey`;
    }
    
    // On server, use filesystem path
    const zkeyPath = path.resolve(process.cwd(), `public/lib/zk/circuits/${proofType}Proof.zkey`);
    
    // Verify that circuit file exists
    try {
      if (!fs.existsSync(zkeyPath)) {
        throw new Error('File not found');
      }
      return zkeyPath;
    } catch (error) {
      throw createZkError('Circuit zkey file not found', {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { zkeyPath }
      });
    }
  }

  async getVerificationKey(proofType) {
    const isServer = typeof window === 'undefined';
    
    // Build verification key path
    const vkeyPath = isServer
      ? path.resolve(process.cwd(), `public/lib/zk/circuits/${proofType}Proof.vkey.json`)
      : `/lib/zk/circuits/${proofType}Proof.vkey.json`;
    
    try {
      // In browser environment, fetch the file
      if (!isServer) {
        const response = await fetch(vkeyPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch verification key: ${response.status}`);
        }
        return await response.json();
      }
      
      // On server, read from filesystem
      if (!fs.existsSync(vkeyPath)) {
        throw new Error('File not found');
      }
      return JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    } catch (error) {
      throw createZkError('Verification key file not found', {
        zkErrorType: ZkErrorType.CIRCUIT_ERROR,
        details: { vkeyPath, error: error.message }
      });
    }
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
    this.isServer = typeof window === 'undefined';
  }

  async initialize() {
    // Only initialize storage manager on server side
    if (this.isServer) {
      // Dynamically import to support tree shaking
      const ZKeyStorageManager = require('./zkeyStorageManager');
      this.storageManager = new ZKeyStorageManager();
    }
  }

  async getWasmPath(proofType) {
    // In browser environment, use relative URL for direct access
    if (!this.isServer) {
      return `/lib/zk/circuits/${proofType}Proof.wasm`;
    }
    
    // On server, check multiple paths
    // Primary path: WASM files from the frontend public directory
    const publicPath = path.join(
      process.cwd(),
      'public/lib/zk/circuits',
      `${proofType}Proof.wasm`
    );
    
    // Fallback paths in order of preference
    const fallbackPaths = [
      // Fallback 1: Using process.env.PROJECT_ROOT if available, or generating from process.cwd()
      path.join(
        process.env.PROJECT_ROOT || path.resolve(process.cwd(), '../../..'),
        'circuits',
        proofType.toLowerCase(),
        `${proofType}Proof_js`,
        `${proofType}Proof.wasm`
      ),
      // Fallback 2: Relative path to circuit files
      path.join(
        process.cwd(),
        '../../../circuits',
        proofType.toLowerCase(),
        `${proofType}Proof_js`,
        `${proofType}Proof.wasm`
      ),
      // Fallback 3: Try direct path in circuits directory without _js
      path.join(
        process.cwd(),
        '../../../circuits',
        proofType.toLowerCase(),
        `${proofType}Proof.wasm`
      ),
      // Fallback 4: Alternative public path
      path.join(
        process.cwd(),
        'public',
        `${proofType}Proof.wasm`
      )
    ];
    
    // Check if the primary path exists
    try {
      if (fs.existsSync(publicPath)) {
        console.log(`Using primary WASM path: ${publicPath}`);
        return publicPath;
      }
      
      // Try each fallback path
      for (const fallbackPath of fallbackPaths) {
        if (fs.existsSync(fallbackPath)) {
          console.log(`Using fallback WASM path: ${fallbackPath}`);
          return fallbackPath;
        }
      }
    } catch (error) {
      console.warn('Error checking file existence:', error);
    }
    
    // If we got here, no path worked - still return the primary path
    // This allows snarkjs to attempt loading it directly
    console.warn(`Warning: Could not verify WASM file exists. Using path: ${publicPath}`);
    return publicPath;
  }

  async getZKeyData(proofType) {
    // In browser environment, use public URL
    if (!this.isServer) {
      return `/lib/zk/circuits/${proofType}Proof.zkey`;
    }
    
    // On server, use storage manager
    if (!this.storageManager) {
      await this.initialize();
    }
    
    try {
      // Get the actual zkey data from cloud storage
      return await this.storageManager.getZKey(proofType);
    } catch (error) {
      // Fallback to local file if cloud storage fails
      const zkeyPath = path.join(
        process.cwd(),
        'public/lib/zk/circuits',
        `${proofType}Proof.zkey`
      );
      
      if (fs.existsSync(zkeyPath)) {
        console.log(`Falling back to local zkey file: ${zkeyPath}`);
        return zkeyPath;
      }
      
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
    // In browser environment, fetch the file
    if (!this.isServer) {
      const vkeyUrl = `/lib/zk/circuits/${proofType}Proof.vkey.json`;
      try {
        const response = await fetch(vkeyUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch verification key: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        throw createZkError('Error fetching verification key in browser', {
          zkErrorType: ZkErrorType.CIRCUIT_ERROR,
          details: { url: vkeyUrl, error: error.message }
        });
      }
    }
    
    // On server, try multiple paths
    const publicPath = path.join(
      process.cwd(),
      'public/lib/zk/circuits',
      `${proofType}Proof.vkey.json`
    );
    
    // Fallback paths in order of preference
    const fallbackPaths = [
      // Fallback 1: Using process.env.PROJECT_ROOT if available, or generating from process.cwd()
      path.join(
        process.env.PROJECT_ROOT || path.resolve(process.cwd(), '../../..'),
        'circuits',
        proofType.toLowerCase(),
        `${proofType}Proof.vkey.json`
      ),
      // Fallback 2: Relative path to circuit files
      path.join(
        process.cwd(),
        '../../../circuits',
        proofType.toLowerCase(),
        `${proofType}Proof.vkey.json`
      ),
      // Fallback 3: Alternative public path
      path.join(
        process.cwd(),
        'public',
        `${proofType}Proof.vkey.json`
      )
    ];
    
    // Try the primary path first
    try {
      if (fs.existsSync(publicPath)) {
        console.log(`Using primary vkey path: ${publicPath}`);
        return JSON.parse(fs.readFileSync(publicPath, 'utf8'));
      }
      
      // Try each fallback path
      for (const fallbackPath of fallbackPaths) {
        if (fs.existsSync(fallbackPath)) {
          console.log(`Using fallback vkey path: ${fallbackPath}`);
          return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        }
      }
    } catch (error) {
      console.warn('Error checking verification key file existence:', error);
    }
    
    // If we got here, no path worked
    throw createZkError(`Verification key file not found for ${proofType}Proof`, {
      zkErrorType: ZkErrorType.CIRCUIT_ERROR,
      details: { triedPaths: [publicPath, ...fallbackPaths] }
    });
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