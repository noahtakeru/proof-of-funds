/**
 * Circuit Build Manager
 * 
 * Handles the build, versioning, and management of zero-knowledge circuits.
 * 
 * ---------- NON-TECHNICAL SUMMARY ----------
 * This module manages the creation and organization of our zero-knowledge circuit files - 
 * the mathematical components that make our privacy system work. It handles compiling
 * these circuits, organizing the output files in a standardized way, and keeping track
 * of different versions. Think of it like a specialized build system that transforms
 * mathematical descriptions into optimized files that can run in a browser.
 * 
 * Business value: Provides consistent, reproducible circuit builds with proper versioning,
 * ensuring that all applications use compatible circuit components.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { keccak256, sha256 } from 'js-sha3';
import VerificationKeyRegistry from './VerificationKeyRegistry.js';

// Promisify exec
const execAsync = promisify(exec);

/**
 * Circuit types and their configurations
 */
export const CIRCUIT_TYPES = {
  STANDARD: {
    id: 'standard',
    name: 'Standard Proof of Funds',
    description: 'Proves exact amount of funds in an account',
    directory: 'standard',
  },
  THRESHOLD: {
    id: 'threshold',
    name: 'Threshold Proof of Funds',
    description: 'Proves funds above a specified threshold',
    directory: 'threshold',
  },
  MAXIMUM: {
    id: 'maximum',
    name: 'Maximum Proof of Funds',
    description: 'Proves funds below a specified maximum',
    directory: 'maximum',
  },
};

/**
 * Standard directory structure for circuit builds
 */
const DIRECTORY_STRUCTURE = {
  CIRCUITS_SOURCE: 'circuits',
  BUILD_ROOT: 'build',
  WASM: 'wasm',
  ZKEY: 'zkey',
  VERIFICATION_KEY: 'verification_key',
  R1CS: 'r1cs',
};

/**
 * Circuit Build Manager class
 * Handles building and versioning ZK circuits
 */
class CircuitBuildManager {
  constructor(options = {}) {
    // Base directories
    this.baseDir = options.baseDir || path.resolve(process.cwd(), 'lib', 'zk');
    this.circuitsDir = path.join(this.baseDir, DIRECTORY_STRUCTURE.CIRCUITS_SOURCE);
    this.buildDir = path.join(this.baseDir, DIRECTORY_STRUCTURE.BUILD_ROOT);
    
    // Registry for circuit versions
    this.circuitVersions = new Map();
    
    // Build metrics
    this.buildHistory = [];
    
    // Verification key registry
    this.verificationKeyRegistry = VerificationKeyRegistry;
    
    // Initialize directories
    this.ensureDirectories();
  }
  
  /**
   * Ensure all required directories exist
   * 
   * @private
   */
  ensureDirectories() {
    // Create base directories if they don't exist
    if (!fs.existsSync(this.circuitsDir)) {
      fs.mkdirSync(this.circuitsDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.buildDir)) {
      fs.mkdirSync(this.buildDir, { recursive: true });
    }
    
    // Create circuit type subdirectories
    for (const circuitType of Object.values(CIRCUIT_TYPES)) {
      const circuitSrcDir = path.join(this.circuitsDir, circuitType.directory);
      const circuitBuildDir = path.join(this.buildDir, circuitType.directory);
      
      if (!fs.existsSync(circuitSrcDir)) {
        fs.mkdirSync(circuitSrcDir, { recursive: true });
      }
      
      if (!fs.existsSync(circuitBuildDir)) {
        fs.mkdirSync(circuitBuildDir, { recursive: true });
      }
    }
  }
  
  /**
   * Build a circuit with specific version
   * 
   * @param {Object} params - Build parameters
   * @param {string} params.circuitType - Circuit type from CIRCUIT_TYPES
   * @param {string} params.version - Semantic version (X.Y.Z)
   * @param {string} params.circuitName - Filename without extension
   * @param {Object} params.buildOptions - Additional build options
   * @returns {Promise<Object>} Build results
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function compiles a zero-knowledge circuit from its source code into
   * the optimized files needed for proof generation and verification. It's like
   * compiling source code, but for cryptographic circuits. Each build is versioned
   * and organized in a standardized directory structure, making it easy to track
   * which version of a circuit is being used in production.
   */
  async buildCircuit(params) {
    const { circuitType, version, circuitName, buildOptions = {} } = params;
    
    // Validate parameters
    if (!Object.values(CIRCUIT_TYPES).some(type => type.id === circuitType)) {
      throw new Error(`Invalid circuit type: ${circuitType}`);
    }
    
    if (!version || !version.match(/^\d+\.\d+\.\d+$/)) {
      throw new Error(`Invalid version format: ${version}. Must be in format X.Y.Z`);
    }
    
    if (!circuitName) {
      throw new Error('Circuit name is required');
    }
    
    // Set up directories
    const circuitTypeInfo = Object.values(CIRCUIT_TYPES).find(type => type.id === circuitType);
    const versionDir = path.join(this.buildDir, circuitTypeInfo.directory, version);
    
    // Create version directory
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
      fs.mkdirSync(path.join(versionDir, DIRECTORY_STRUCTURE.WASM), { recursive: true });
      fs.mkdirSync(path.join(versionDir, DIRECTORY_STRUCTURE.ZKEY), { recursive: true });
      fs.mkdirSync(path.join(versionDir, DIRECTORY_STRUCTURE.VERIFICATION_KEY), { recursive: true });
      fs.mkdirSync(path.join(versionDir, DIRECTORY_STRUCTURE.R1CS), { recursive: true });
    }
    
    // Circuit source path
    const circuitSrcPath = path.join(
      this.circuitsDir, 
      circuitTypeInfo.directory, 
      `${circuitName}.circom`
    );
    
    if (!fs.existsSync(circuitSrcPath)) {
      throw new Error(`Circuit source file not found: ${circuitSrcPath}`);
    }
    
    // Build paths
    const buildPaths = {
      r1cs: path.join(versionDir, DIRECTORY_STRUCTURE.R1CS, `${circuitName}.r1cs`),
      wasm: path.join(versionDir, DIRECTORY_STRUCTURE.WASM, `${circuitName}.wasm`),
      zkey: path.join(versionDir, DIRECTORY_STRUCTURE.ZKEY, `${circuitName}.zkey`),
      verificationKey: path.join(versionDir, DIRECTORY_STRUCTURE.VERIFICATION_KEY, `${circuitName}.json`),
    };
    
    try {
      // Record start time
      const startTime = Date.now();
      
      // 1. Compile circuit to R1CS and WASM
      const compileCommand = `circom ${circuitSrcPath} --r1cs --wasm -o ${versionDir}`;
      await execAsync(compileCommand);
      
      // 2. Set up zkey (trusted setup would happen here in production)
      // For development, we use a mock trusted setup
      const setupCommand = `snarkjs groth16 setup ${buildPaths.r1cs} ./lib/zk/dev_ptau/powersOfTau28_hez_final_11.ptau ${buildPaths.zkey}`;
      await execAsync(setupCommand);
      
      // 3. Export verification key
      const exportCommand = `snarkjs zkey export verificationkey ${buildPaths.zkey} ${buildPaths.verificationKey}`;
      await execAsync(exportCommand);
      
      // 4. Calculate build hashes for integrity verification
      const fileHashes = {
        r1cs: await this.hashFile(buildPaths.r1cs),
        wasm: await this.hashFile(buildPaths.wasm),
        zkey: await this.hashFile(buildPaths.zkey),
        verificationKey: await this.hashFile(buildPaths.verificationKey),
      };
      
      // 5. Load verification key
      const verificationKey = JSON.parse(fs.readFileSync(buildPaths.verificationKey, 'utf8'));
      
      // 6. Register circuit version
      this.registerCircuitVersion(circuitType, circuitName, version, {
        buildTime: Date.now(),
        buildPaths,
        fileHashes,
      });
      
      // 7. Register verification key in registry
      const keyId = this.verificationKeyRegistry.registerKey({
        circuitId: `${circuitType}-${circuitName}`,
        version,
        verificationKey,
        status: buildOptions.keyStatus || 'active',
      });
      
      // 8. Register artifact paths
      this.verificationKeyRegistry.registerArtifactPaths(
        `${circuitType}-${circuitName}`,
        version,
        {
          wasmFile: buildPaths.wasm,
          zkeyFile: buildPaths.zkey,
          verificationKeyFile: buildPaths.verificationKey,
          r1csFile: buildPaths.r1cs,
        }
      );
      
      // Record build completion
      const endTime = Date.now();
      const buildRecord = {
        circuitType,
        circuitName,
        version,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: true,
        keyId,
        buildPaths,
        fileHashes,
      };
      
      this.buildHistory.push(buildRecord);
      
      return {
        success: true,
        circuitId: `${circuitType}-${circuitName}`,
        version,
        keyId,
        buildTime: new Date(startTime).toISOString(),
        duration: buildRecord.duration,
        artifactPaths: buildPaths,
        fileHashes,
      };
    } catch (error) {
      // Record build failure
      const endTime = Date.now();
      const buildRecord = {
        circuitType,
        circuitName,
        version,
        startTime: startTime || Date.now(),
        endTime,
        duration: endTime - (startTime || Date.now()),
        success: false,
        error: error.message,
      };
      
      this.buildHistory.push(buildRecord);
      
      console.error(`Circuit build failed: ${error.message}`);
      throw new Error(`Failed to build circuit: ${error.message}`);
    }
  }
  
  /**
   * Register a circuit version in the local registry
   * 
   * @private
   * @param {string} circuitType - Circuit type
   * @param {string} circuitName - Circuit name
   * @param {string} version - Semantic version
   * @param {Object} buildInfo - Build information
   */
  registerCircuitVersion(circuitType, circuitName, version, buildInfo) {
    const circuitId = `${circuitType}-${circuitName}`;
    
    if (!this.circuitVersions.has(circuitId)) {
      this.circuitVersions.set(circuitId, new Map());
    }
    
    const versions = this.circuitVersions.get(circuitId);
    versions.set(version, {
      buildTime: buildInfo.buildTime,
      buildPaths: buildInfo.buildPaths,
      fileHashes: buildInfo.fileHashes,
    });
  }
  
  /**
   * Hash a file for integrity verification
   * 
   * @private
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} File hash
   */
  async hashFile(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const hash = sha256(fileBuffer);
        resolve(`0x${hash}`);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Get information about a circuit version
   * 
   * @param {string} circuitType - Circuit type
   * @param {string} circuitName - Circuit name
   * @param {string} version - Circuit version
   * @returns {Object} Version information
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function provides detailed information about a specific version of
   * a circuit, including its build artifacts and file hashes. This is useful
   * for audit trails, troubleshooting, and verifying the integrity of circuit
   * files. Applications can use this information to ensure they're using the
   * correct, unmodified circuit files.
   */
  getCircuitVersion(circuitType, circuitName, version) {
    const circuitId = `${circuitType}-${circuitName}`;
    
    if (!this.circuitVersions.has(circuitId)) {
      throw new Error(`Circuit ${circuitId} not found`);
    }
    
    const versions = this.circuitVersions.get(circuitId);
    if (!versions.has(version)) {
      throw new Error(`Version ${version} not found for circuit ${circuitId}`);
    }
    
    // Get verification key info
    let keyInfo = null;
    try {
      keyInfo = this.verificationKeyRegistry.getKey(
        this.verificationKeyRegistry.getLatestKey(`${circuitType}-${circuitName}`).id
      );
    } catch (error) {
      console.warn(`Could not retrieve verification key: ${error.message}`);
    }
    
    const versionInfo = versions.get(version);
    return {
      circuitId,
      version,
      buildTime: new Date(versionInfo.buildTime).toISOString(),
      buildPaths: versionInfo.buildPaths,
      fileHashes: versionInfo.fileHashes,
      keyId: keyInfo?.id || null,
    };
  }
  
  /**
   * List all versions of a specific circuit
   * 
   * @param {string} circuitType - Circuit type
   * @param {string} circuitName - Circuit name
   * @returns {Array<Object>} List of versions
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function provides a list of all versions available for a specific
   * circuit, allowing applications to understand what versions exist and
   * potentially select a specific version for compatibility reasons. This
   * is particularly useful when upgrading systems, as it shows what versions
   * are available to choose from.
   */
  listCircuitVersions(circuitType, circuitName) {
    const circuitId = `${circuitType}-${circuitName}`;
    
    if (!this.circuitVersions.has(circuitId)) {
      throw new Error(`Circuit ${circuitId} not found`);
    }
    
    const versions = this.circuitVersions.get(circuitId);
    return Array.from(versions.entries()).map(([version, info]) => ({
      version,
      buildTime: new Date(info.buildTime).toISOString(),
    }));
  }
  
  /**
   * Get the latest version of a circuit
   * 
   * @param {string} circuitType - Circuit type
   * @param {string} circuitName - Circuit name
   * @returns {Object} Latest version information
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function automatically determines the latest version of a circuit
   * using semantic versioning rules. Applications can use this to always get
   * the most up-to-date circuit version without having to track version numbers.
   * This ensures that applications stay current with the latest security updates
   * and improvements to the circuits.
   */
  getLatestCircuitVersion(circuitType, circuitName) {
    const circuitId = `${circuitType}-${circuitName}`;
    
    if (!this.circuitVersions.has(circuitId)) {
      throw new Error(`Circuit ${circuitId} not found`);
    }
    
    const versions = this.circuitVersions.get(circuitId);
    if (versions.size === 0) {
      throw new Error(`No versions found for circuit ${circuitId}`);
    }
    
    // Find latest version using semantic versioning rules
    let latestVersion = null;
    let latestMajor = -1;
    let latestMinor = -1;
    let latestPatch = -1;
    
    for (const version of versions.keys()) {
      const [major, minor, patch] = version.split('.').map(Number);
      
      if (major > latestMajor ||
          (major === latestMajor && minor > latestMinor) ||
          (major === latestMajor && minor === latestMinor && patch > latestPatch)) {
        latestVersion = version;
        latestMajor = major;
        latestMinor = minor;
        latestPatch = patch;
      }
    }
    
    return this.getCircuitVersion(circuitType, circuitName, latestVersion);
  }
  
  /**
   * Get build metrics and statistics
   * 
   * @returns {Object} Build metrics
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function provides metrics about circuit builds, including success rates,
   * build times, and counts of different circuit types. This information is
   * useful for monitoring the build process, identifying trends or issues, and
   * optimizing the build pipeline. These metrics help ensure the reliability
   * and efficiency of the circuit build process.
   */
  getBuildMetrics() {
    // Calculate basic metrics
    const totalBuilds = this.buildHistory.length;
    const successfulBuilds = this.buildHistory.filter(b => b.success).length;
    const failedBuilds = totalBuilds - successfulBuilds;
    
    // Calculate average build duration
    const successfulDurations = this.buildHistory
      .filter(b => b.success)
      .map(b => b.duration);
    
    const averageDuration = successfulDurations.length > 0
      ? successfulDurations.reduce((sum, duration) => sum + duration, 0) / successfulDurations.length
      : 0;
    
    // Count by circuit type
    const buildsByType = {};
    for (const build of this.buildHistory) {
      buildsByType[build.circuitType] = (buildsByType[build.circuitType] || 0) + 1;
    }
    
    return {
      totalBuilds,
      successfulBuilds,
      failedBuilds,
      successRate: totalBuilds > 0 ? (successfulBuilds / totalBuilds) * 100 : 0,
      averageDuration,
      buildsByType,
      lastBuildTime: this.buildHistory.length > 0
        ? new Date(this.buildHistory[this.buildHistory.length - 1].endTime).toISOString()
        : null,
    };
  }
  
  /**
   * Verify the integrity of built circuit files
   * 
   * @param {string} circuitType - Circuit type
   * @param {string} circuitName - Circuit name
   * @param {string} version - Circuit version
   * @returns {Promise<Object>} Verification results
   * 
   * ---------- BUSINESS CONTEXT ----------
   * This function verifies the integrity of circuit build artifacts by comparing
   * their current hashes to the hashes recorded during the build process. This
   * helps detect any tampering with circuit files, which could potentially
   * compromise the security of the zero-knowledge proofs. Regular verification
   * helps ensure the ongoing integrity of the circuits used in production.
   */
  async verifyCircuitIntegrity(circuitType, circuitName, version) {
    // Get circuit version info
    const versionInfo = this.getCircuitVersion(circuitType, circuitName, version);
    const buildPaths = versionInfo.buildPaths;
    const recordedHashes = versionInfo.fileHashes;
    
    // Verify each file
    const results = {};
    let allValid = true;
    
    for (const [file, path] of Object.entries(buildPaths)) {
      try {
        const currentHash = await this.hashFile(path);
        const isValid = currentHash === recordedHashes[file];
        
        results[file] = {
          path,
          recordedHash: recordedHashes[file],
          currentHash,
          isValid,
        };
        
        if (!isValid) {
          allValid = false;
        }
      } catch (error) {
        results[file] = {
          path,
          error: error.message,
          isValid: false,
        };
        allValid = false;
      }
    }
    
    return {
      circuitId: `${circuitType}-${circuitName}`,
      version,
      allValid,
      results,
    };
  }
}

// Export as singleton
const circuitBuildManager = new CircuitBuildManager();
export default circuitBuildManager;