/**
 * Circuit Versioning Registry
 * 
 * This module manages circuit versions, compatibility, and provides
 * access to the appropriate circuit files for each version. It enables
 * backward compatibility for verifying proofs generated with older circuits.
 */

import { CircuitVersionRegistry, CircuitVersionConfig } from './types';
import { ZK_PROOF_TYPES } from '../../config/constants';

// Current package version (used for versioning)
export const PACKAGE_VERSION = '1.0.0';
export const CURRENT_MAJOR_VERSION = parseInt(PACKAGE_VERSION.split('.')[0]);

/**
 * Registry of all circuit versions with their file paths and compatibility info
 */
export const CIRCUIT_VERSIONS: CircuitVersionRegistry = {
  'standard': {
    '1.0.0': {
      wasmPath: '/circuits/standard_v1_0_0.wasm',
      zkeyPath: '/circuits/standard_v1_0_0.zkey',
      vkeyPath: '/circuits/standard_v1_0_0.vkey.json',
      maxInputSize: 10240,
      compatibleWith: ['1.0.0'],
      deprecated: false
    }
  },
  'threshold': {
    '1.0.0': {
      wasmPath: '/circuits/threshold_v1_0_0.wasm',
      zkeyPath: '/circuits/threshold_v1_0_0.zkey',
      vkeyPath: '/circuits/threshold_v1_0_0.vkey.json',
      maxInputSize: 10240,
      compatibleWith: ['1.0.0'],
      deprecated: false
    }
  },
  'maximum': {
    '1.0.0': {
      wasmPath: '/circuits/maximum_v1_0_0.wasm',
      zkeyPath: '/circuits/maximum_v1_0_0.zkey',
      vkeyPath: '/circuits/maximum_v1_0_0.vkey.json',
      maxInputSize: 10240,
      compatibleWith: ['1.0.0'],
      deprecated: false
    }
  }
};

/**
 * Maps proof type enum values to string names
 */
export const PROOF_TYPE_NAMES: Record<number, string> = {
  [ZK_PROOF_TYPES.STANDARD]: 'standard',
  [ZK_PROOF_TYPES.THRESHOLD]: 'threshold',
  [ZK_PROOF_TYPES.MAXIMUM]: 'maximum'
};

/**
 * Maps proof type string names to enum values
 */
export const PROOF_TYPE_ENUMS: Record<string, number> = {
  'standard': ZK_PROOF_TYPES.STANDARD,
  'threshold': ZK_PROOF_TYPES.THRESHOLD,
  'maximum': ZK_PROOF_TYPES.MAXIMUM
};

/**
 * Get the name of a proof type
 * @param proofType The proof type enum value
 * @returns The proof type name
 */
export function getProofTypeName(proofType: number): string {
  return PROOF_TYPE_NAMES[proofType] || 'unknown';
}

/**
 * Gets the appropriate circuit version for the given proof type and version
 * @param proofType The type of proof as a string ('standard', 'threshold', 'maximum')
 * @param proofVersion The version of the proof to check compatibility with
 * @returns The circuit configuration for the requested proof type and version
 */
export function getCompatibleCircuitVersion(
  proofType: string | number, 
  proofVersion: string = '1.0.0'
): CircuitVersionConfig {
  // Convert proofType to string if it's a number
  const proofTypeName = typeof proofType === 'number' 
    ? getProofTypeName(proofType)
    : proofType;
  
  const circuitVersions = CIRCUIT_VERSIONS[proofTypeName];
  if (!circuitVersions) {
    throw new Error(`Unknown proof type: ${proofTypeName}`);
  }
  
  // First check for exact match
  if (circuitVersions[proofVersion]) {
    return circuitVersions[proofVersion];
  }
  
  // Then look for compatible version
  for (const [version, config] of Object.entries(circuitVersions)) {
    if (config.compatibleWith.includes(proofVersion) && !config.deprecated) {
      console.log(`Using circuit version ${version} for ${proofTypeName} proof version ${proofVersion}`);
      return config;
    }
  }
  
  throw new Error(`No compatible circuit version found for ${proofTypeName} proof version ${proofVersion}`);
}

/**
 * Gets the latest circuit version for a specific proof type
 * @param proofType The type of proof (can be string or enum value)
 * @returns The latest circuit version configuration
 */
export function getLatestCircuitVersion(proofType: string | number): CircuitVersionConfig {
  // Convert proofType to string if it's a number
  const proofTypeName = typeof proofType === 'number' 
    ? getProofTypeName(proofType)
    : proofType;
  
  const circuitVersions = CIRCUIT_VERSIONS[proofTypeName];
  if (!circuitVersions) {
    throw new Error(`Unknown proof type: ${proofTypeName}`);
  }
  
  // Get all versions that are not deprecated
  const activeVersions = Object.entries(circuitVersions)
    .filter(([_, config]) => !config.deprecated)
    .map(([version, config]) => ({ 
      version, 
      config 
    }));
  
  if (activeVersions.length === 0) {
    throw new Error(`No active versions found for proof type: ${proofTypeName}`);
  }
  
  // Sort versions from newest to oldest using semver-like comparison
  activeVersions.sort((a, b) => {
    const [aMajor, aMinor, aPatch] = a.version.split('.').map(Number);
    const [bMajor, bMinor, bPatch] = b.version.split('.').map(Number);
    
    if (aMajor !== bMajor) return bMajor - aMajor;
    if (aMinor !== bMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  });
  
  // Return the newest version
  return activeVersions[0].config;
}

/**
 * Validates that a proof version is compatible with the current system
 * @param proofVersion The version string of the proof
 * @param circuitVersion The version string of the circuit that generated the proof
 * @returns Whether the proof is compatible with the current system
 */
export function validateProofVersion(
  proofVersion: string,
  circuitVersion?: string
): boolean {
  // Split versions into major, minor, patch
  const [proofMajor, proofMinor] = proofVersion.split('.').map(Number);
  
  // If circuit version is provided, check compatibility directly
  if (circuitVersion) {
    const [circuitMajor, circuitMinor] = circuitVersion.split('.').map(Number);
    
    // Major versions must match, minor version of proof must be <= circuit's
    if (proofMajor !== circuitMajor || (proofMinor > circuitMinor)) {
      console.warn(`Proof version ${proofVersion} may be incompatible with circuit version ${circuitVersion}`);
      return false;
    }
    
    return true;
  }
  
  // If no circuit version provided, check against current package version
  if (proofMajor !== CURRENT_MAJOR_VERSION) {
    console.warn(`Proof version ${proofVersion} may be incompatible with current system version ${PACKAGE_VERSION}`);
    return false;
  }
  
  return true;
}

/**
 * Gets the relative file path for a specific circuit file
 * @param proofType The type of proof
 * @param fileType The type of file to get ('wasm', 'zkey', or 'vkey')
 * @param version Optional specific version, or latest if not provided
 * @returns The file path for the requested circuit file
 */
export function getCircuitFilePath(
  proofType: string | number,
  fileType: 'wasm' | 'zkey' | 'vkey',
  version?: string
): string {
  const circuitConfig = version 
    ? getCompatibleCircuitVersion(proofType, version)
    : getLatestCircuitVersion(proofType);
  
  switch (fileType) {
    case 'wasm':
      return circuitConfig.wasmPath;
    case 'zkey':
      return circuitConfig.zkeyPath;
    case 'vkey':
      return circuitConfig.vkeyPath;
    default:
      throw new Error(`Unknown file type: ${fileType}`);
  }
}

/**
 * Gets all available circuit versions for a proof type
 * @param proofType The type of proof
 * @returns Array of available versions
 */
export function getAvailableVersions(proofType: string | number): string[] {
  // Convert proofType to string if it's a number
  const proofTypeName = typeof proofType === 'number' 
    ? getProofTypeName(proofType)
    : proofType;
  
  const circuitVersions = CIRCUIT_VERSIONS[proofTypeName];
  if (!circuitVersions) {
    throw new Error(`Unknown proof type: ${proofTypeName}`);
  }
  
  return Object.keys(circuitVersions);
}