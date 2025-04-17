declare module 'snarkjs' {
  export interface Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  }

  export interface FullProveResult {
    proof: Proof;
    publicSignals: string[];
  }

  export interface VerifyResult {
    valid: boolean;
  }

  export interface Groth16 {
    fullProve(
      input: any,
      wasmFile: string,
      zkeyFile: string,
      options?: any
    ): Promise<FullProveResult>;
    
    prove(
      zkey: any,
      wtns: any,
      options?: any
    ): Promise<any>;
    
    verify(
      verificationKey: any,
      publicSignals: string[],
      proof: Proof
    ): Promise<any>;
    
    exportSolidityCallData(
      proof: Proof,
      publicSignals: string[]
    ): Promise<string>;
  }

  export interface PlonkProver {
    setup?(
      r1cs: any,
      params: any,
      options?: any
    ): Promise<any>;
    
    fullProve(
      input: any,
      wasmFile: string,
      zkeyFile: string
    ): Promise<FullProveResult>;
    
    prove(
      zkey: any,
      wtns: any,
      options?: any
    ): Promise<any>;
    
    verify(
      verificationKey: any,
      publicSignals: string[],
      proof: Proof
    ): Promise<any>;
    
    exportSolidityCallData(
      proof: Proof,
      publicSignals: string[]
    ): Promise<string>;
  }

  export interface WitnessCalculator {
    calculate(
      input: any,
      wasm: any,
      options?: any
    ): Promise<any>;
  }
  
  export interface ZKey {
    exportVerificationKey(zkeyFile: string): Promise<any>;
  }
  
  export interface StatusChecker {
    check(): Promise<{
      available: boolean;
      features?: string[];
      version?: string;
      processingTimes?: Record<string, number>;
      error?: string;
    }>;
  }
  
  export const version: string;
  export const groth16: Groth16;
  export const plonk: PlonkProver;
  export const wtns: WitnessCalculator;
  export const zKey: ZKey;
  export const status: StatusChecker;
  
  export function getVersion(): string;
  export function initialize(): Promise<any>;
}