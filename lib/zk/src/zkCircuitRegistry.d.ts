/**
 * TypeScript type definitions for zkCircuitRegistry
 */

/**
 * Circuit metadata
 */
export interface CircuitMetadata {
  name: string;
  version: string;
  description: string;
  circuitType: string;
  constraints: number;
  inputs: number;
  outputs: number;
  memoryRequirements: {
    minimum: number;
    recommended: number;
  };
  compatibleWith: string[];
  tags: string[];
  author: string;
  created: Date;
  lastUpdated: Date;
}

/**
 * Circuit configuration
 */
export interface CircuitConfig {
  id: string;
  type: string;
  version: string;
  wasm: boolean;
  worker: boolean;
  constraints: number;
  settings: Record<string, any>;
}

/**
 * Circuit Paths
 */
export interface CircuitPaths {
  wasmPath: string;
  r1csPath: string;
  zkeyPath: string;
  vkeyPath: string;
  symbolsPath: string;
  sourcePath: string;
}

/**
 * Circuit Registry containing all ZK circuits and methods to access them
 */
export interface ZKCircuitRegistry {
  /** Constants defining supported circuit types */
  CIRCUIT_TYPES: {
    STANDARD: 'standard';
    MAXIMUM: 'maximum';
    THRESHOLD: 'threshold';
    [key: string]: string;
  };

  /** Get all available versions for a circuit type */
  getCircuitVersions(circuitType: string): string[];

  /** Get latest version for a circuit type */
  getLatestCircuitVersion(circuitType: string): string;

  /** Get circuit metadata by type and version */
  getCircuitByVersion(circuitType: string, version: string): CircuitMetadata;

  /** Get detailed metadata for a circuit */
  getCircuitMetadata(circuitId: string): CircuitMetadata;

  /** Get configuration for a circuit */
  getCircuitConfig(circuitId: string): CircuitConfig;

  /** Get file paths for a circuit */
  getCircuitPaths(circuitId: string): CircuitPaths;

  /** Register a new circuit in the registry */
  registerCircuit(metadata: CircuitMetadata, config: CircuitConfig): boolean;

  /** Update metadata for an existing circuit */
  updateCircuitMetadata(circuitId: string, metadata: Partial<CircuitMetadata>): boolean;

  /** Check compatibility between circuit versions */
  checkCircuitCompatibility(sourceVersion: string, targetVersion: string): boolean;

  /** Get memory requirements for a circuit */
  getMemoryRequirements(circuitId: string): { minimum: number; recommended: number };

  /** Set the base path for circuit files */
  setBasePath(path: string): void;
}

// Default export for ESM compatibility
const zkCircuitRegistry: ZKCircuitRegistry;
export default zkCircuitRegistry;