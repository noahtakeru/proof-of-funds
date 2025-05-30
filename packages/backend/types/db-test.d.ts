/**
 * Type declarations for @proof-of-funds/db/test modules
 */

declare module '@proof-of-funds/db/test/seed-test-data' {
  export function createUser(overrides?: any): Promise<any>;
  export function createWallet(userId: string, overrides?: any): Promise<any>;
  export function createProof(userId: string, tempWalletId: string, overrides?: any): Promise<any>;
  export function createOrganization(overrides?: any): Promise<any>;
  export function createTestDataSet(userData?: any, walletData?: any, proofData?: any): Promise<any>;
  export function cleanupTestData(): Promise<void>;
  export function randomAddress(): string;
  export function futureDate(days?: number): Date;
  export function pastDate(days?: number): Date;
}