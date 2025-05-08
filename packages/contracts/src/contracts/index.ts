/**
 * @file index.ts
 * @description Exports all contract interfaces
 */

export { ContractInterface } from './ContractInterface';
export { AbiVersionManager } from './AbiVersionManager';
export { ContractAddressRegistry } from './ContractAddressRegistry';
export { ZKVerifierContract } from './ZKVerifierContract';
export { ProofOfFundsContract } from './ProofOfFundsContract';

// Re-export contract types from the types directory
export * from '../types/contractTypes';