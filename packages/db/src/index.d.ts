import { PrismaClient, User, Wallet, Proof, Verification, Batch, Organization, OrganizationUser, ProofTemplate, AuditLog, ProofType, ProofStatus, WalletType, BatchStatus, OrgRole } from '@prisma/client';

export const prisma: PrismaClient;

/**
 * Execute a database transaction
 *
 * @param fn - Function to execute within transaction
 * @returns Result of the transaction
 */
export function transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T>;

/**
 * Healthcheck function to verify database connectivity
 *
 * @returns True if connected, throws error otherwise
 */
export function healthCheck(): Promise<boolean>;

/**
 * Clean up function for graceful shutdown
 */
export function disconnect(): Promise<void>;

/**
 * Model exports for convenience
 */
export const models: {
  user: PrismaClient['user'];
  wallet: PrismaClient['wallet'];
  proof: PrismaClient['proof'];
  verification: PrismaClient['verification'];
  batch: PrismaClient['batch'];
  organization: PrismaClient['organization'];
  organizationUser: PrismaClient['organizationUser'];
  proofTemplate: PrismaClient['proofTemplate'];
  auditLog: PrismaClient['auditLog'];
};

/**
 * Type exports for convenience
 */
export { PrismaClient, User, Wallet, Proof, Verification, Batch, Organization, OrganizationUser, ProofTemplate, AuditLog, ProofType, ProofStatus, WalletType, BatchStatus, OrgRole };