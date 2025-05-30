/**
 * Type definitions for backend tests
 */

// Module declarations for test helpers
declare module '../../test/api-test-helpers' {
  import { Express } from 'express';
  
  export function createTestServer(options?: any): Express;
  export function authenticatedRequest(
    app: Express,
    userId?: string,
    permissions?: string[],
    address?: string
  ): any;
  export function publicRequest(app: Express): any;
  export function expectSuccess(response: any): any;
  export function expectError(response: any, status?: number, errorCode?: string): any;
}

declare module '../../test/mock-services' {
  export class MockZkProofService {
    generateProof(input: any): Promise<any>;
    verifyProof(proof: any, publicSignals: any): Promise<boolean>;
  }
  
  export class MockWalletService {
    createTemporaryWallet(): Promise<any>;
    getBalance(address: string): Promise<string>;
  }
  
  export class MockBlockchainService {
    getCurrentBlockNumber(): Promise<number>;
    submitTransaction(tx: any): Promise<string>;
  }
}