/**
 * Proof test fixtures
 * 
 * Provides sample proof data for tests
 */
import { v4 as uuidv4 } from 'uuid';
import { randomAddress } from './users';

/**
 * Generate an expiration date
 * 
 * @param days Days from now
 * @returns Date object
 */
export function expirationDate(days: number = 30): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Standard proof fixture
 */
export const standardProof = {
  id: uuidv4(),
  userId: uuidv4(),
  referenceId: `ref-${uuidv4()}`,
  createdAt: new Date(),
  expiresAt: expirationDate(),
  proofType: 'STANDARD',
  isRevoked: false,
  encryptedData: 'encrypted-data-placeholder',
  encryptionKeyId: `key-${uuidv4()}`,
  tempWalletId: uuidv4(),
  warningFlags: [],
  originalWallets: [randomAddress()],
  status: 'CONFIRMED'
};

/**
 * Threshold proof fixture
 */
export const thresholdProof = {
  id: uuidv4(),
  userId: uuidv4(),
  referenceId: `ref-${uuidv4()}`,
  createdAt: new Date(),
  expiresAt: expirationDate(),
  proofType: 'THRESHOLD',
  isRevoked: false,
  encryptedData: 'encrypted-data-placeholder',
  encryptionKeyId: `key-${uuidv4()}`,
  tempWalletId: uuidv4(),
  warningFlags: [],
  originalWallets: [randomAddress(), randomAddress()],
  status: 'CONFIRMED'
};

/**
 * Maximum proof fixture
 */
export const maximumProof = {
  id: uuidv4(),
  userId: uuidv4(),
  referenceId: `ref-${uuidv4()}`,
  createdAt: new Date(),
  expiresAt: expirationDate(),
  proofType: 'MAXIMUM',
  isRevoked: false,
  encryptedData: 'encrypted-data-placeholder',
  encryptionKeyId: `key-${uuidv4()}`,
  tempWalletId: uuidv4(),
  warningFlags: [],
  originalWallets: [randomAddress()],
  status: 'CONFIRMED'
};

/**
 * ZK proof fixture
 */
export const zkProof = {
  id: uuidv4(),
  userId: uuidv4(),
  referenceId: `ref-${uuidv4()}`,
  createdAt: new Date(),
  expiresAt: expirationDate(),
  proofType: 'ZERO_KNOWLEDGE',
  isRevoked: false,
  encryptedData: 'encrypted-data-placeholder',
  encryptionKeyId: `key-${uuidv4()}`,
  tempWalletId: uuidv4(),
  warningFlags: [],
  originalWallets: [randomAddress()],
  status: 'CONFIRMED'
};

/**
 * Revoked proof fixture
 */
export const revokedProof = {
  id: uuidv4(),
  userId: uuidv4(),
  referenceId: `ref-${uuidv4()}`,
  createdAt: new Date(),
  expiresAt: expirationDate(),
  proofType: 'STANDARD',
  isRevoked: true,
  revokedAt: new Date(),
  revocationReason: 'Test revocation reason',
  encryptedData: 'encrypted-data-placeholder',
  encryptionKeyId: `key-${uuidv4()}`,
  tempWalletId: uuidv4(),
  warningFlags: [],
  originalWallets: [randomAddress()],
  status: 'REVOKED'
};

/**
 * Expired proof fixture
 */
export const expiredProof = {
  id: uuidv4(),
  userId: uuidv4(),
  referenceId: `ref-${uuidv4()}`,
  createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
  expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  proofType: 'STANDARD',
  isRevoked: false,
  encryptedData: 'encrypted-data-placeholder',
  encryptionKeyId: `key-${uuidv4()}`,
  tempWalletId: uuidv4(),
  warningFlags: [],
  originalWallets: [randomAddress()],
  status: 'EXPIRED'
};

/**
 * Pending proof fixture
 */
export const pendingProof = {
  id: uuidv4(),
  userId: uuidv4(),
  referenceId: `ref-${uuidv4()}`,
  createdAt: new Date(),
  expiresAt: expirationDate(),
  proofType: 'STANDARD',
  isRevoked: false,
  encryptedData: 'encrypted-data-placeholder',
  encryptionKeyId: `key-${uuidv4()}`,
  tempWalletId: uuidv4(),
  warningFlags: [],
  originalWallets: [randomAddress()],
  status: 'PENDING'
};

/**
 * Failed proof fixture
 */
export const failedProof = {
  id: uuidv4(),
  userId: uuidv4(),
  referenceId: `ref-${uuidv4()}`,
  createdAt: new Date(),
  expiresAt: expirationDate(),
  proofType: 'STANDARD',
  isRevoked: false,
  encryptedData: 'encrypted-data-placeholder',
  encryptionKeyId: `key-${uuidv4()}`,
  tempWalletId: uuidv4(),
  warningFlags: ['VERIFICATION_FAILED'],
  originalWallets: [randomAddress()],
  status: 'FAILED'
};