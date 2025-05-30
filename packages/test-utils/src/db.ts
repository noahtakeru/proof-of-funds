/**
 * Database Testing Utilities
 * 
 * Provides tools for database setup and teardown in tests
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Create a test-specific Prisma client
const prismaTest = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_TEST,
    },
  },
});

/**
 * Setup the test database
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    // Verify connection to test database
    await prismaTest.$queryRaw`SELECT 1`;
    console.log('Connected to test database');
    
    // Clean up any existing data
    await cleanupTestDatabase();
  } catch (error) {
    console.error('Test database setup failed:', error);
    throw error;
  }
}

/**
 * Clean up the test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    // Delete all data in reverse order of dependencies
    await prismaTest.verification.deleteMany({});
    await prismaTest.proof.deleteMany({});
    await prismaTest.wallet.deleteMany({});
    await prismaTest.auditLog.deleteMany({});
    await prismaTest.proofTemplate.deleteMany({});
    await prismaTest.organizationUser.deleteMany({});
    await prismaTest.organization.deleteMany({});
    await prismaTest.user.deleteMany({});
    await prismaTest.batch.deleteMany({});
    
    console.log('Test database cleaned up');
  } catch (error) {
    console.error('Test database cleanup failed:', error);
    throw error;
  }
}

/**
 * Create a test user
 */
export async function createTestUser(overrides: Partial<any> = {}): Promise<any> {
  const userId = uuidv4();
  
  return prismaTest.user.create({
    data: {
      id: userId,
      address: overrides.address || `0x${uuidv4().replace(/-/g, '')}`,
      createdAt: overrides.createdAt || new Date(),
      lastLoginAt: overrides.lastLoginAt || new Date(),
      isActive: overrides.isActive !== undefined ? overrides.isActive : true,
      permissions: overrides.permissions || ['USER'],
      settings: overrides.settings || {}
    }
  });
}

/**
 * Create a test wallet
 */
export async function createTestWallet(userId: string, overrides: Partial<any> = {}): Promise<any> {
  return prismaTest.wallet.create({
    data: {
      id: uuidv4(),
      userId,
      address: overrides.address || `0x${uuidv4().replace(/-/g, '')}`,
      chainId: overrides.chainId || 1,
      type: overrides.type || 'USER_CONNECTED',
      encryptedPrivateKey: overrides.encryptedPrivateKey,
      keyId: overrides.keyId,
      createdAt: overrides.createdAt || new Date(),
      lastUsedAt: overrides.lastUsedAt || new Date(),
      isArchived: overrides.isArchived !== undefined ? overrides.isArchived : false,
      balance: overrides.balance,
      nonce: overrides.nonce
    }
  });
}

/**
 * Create a test proof
 */
export async function createTestProof(userId: string, tempWalletId: string, overrides: Partial<any> = {}): Promise<any> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  return prismaTest.proof.create({
    data: {
      id: uuidv4(),
      userId,
      referenceId: overrides.referenceId || `ref-${uuidv4()}`,
      createdAt: overrides.createdAt || new Date(),
      expiresAt: overrides.expiresAt || expiresAt,
      proofType: overrides.proofType || 'STANDARD',
      isRevoked: overrides.isRevoked !== undefined ? overrides.isRevoked : false,
      revokedAt: overrides.revokedAt,
      revocationReason: overrides.revocationReason,
      encryptedData: overrides.encryptedData || 'encrypted-test-data',
      encryptionKeyId: overrides.encryptionKeyId || 'test-key-id',
      tempWalletId,
      transactionHash: overrides.transactionHash,
      merkleRoot: overrides.merkleRoot,
      merklePath: overrides.merklePath,
      batchId: overrides.batchId,
      warningFlags: overrides.warningFlags || [],
      originalWallets: overrides.originalWallets || [],
      status: overrides.status || 'PENDING'
    }
  });
}

/**
 * Create a test organization
 */
export async function createTestOrganization(overrides: Partial<any> = {}): Promise<any> {
  return prismaTest.organization.create({
    data: {
      id: uuidv4(),
      name: overrides.name || `Test Organization ${uuidv4()}`,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      apiKey: overrides.apiKey || `api-${uuidv4()}`,
      settings: overrides.settings || {}
    }
  });
}

/**
 * Create a test organization user
 */
export async function createTestOrganizationUser(
  userId: string,
  organizationId: string,
  overrides: Partial<any> = {}
): Promise<any> {
  return prismaTest.organizationUser.create({
    data: {
      id: uuidv4(),
      userId,
      organizationId,
      role: overrides.role || 'MEMBER',
      joinedAt: overrides.joinedAt || new Date()
    }
  });
}

/**
 * Create a complete test user with wallet and proof
 */
export async function createCompleteTestUser(overrides: Partial<any> = {}): Promise<{
  user: any;
  wallet: any;
  proof: any;
}> {
  const user = await createTestUser(overrides.user);
  const wallet = await createTestWallet(user.id, overrides.wallet);
  const tempWallet = await createTestWallet(user.id, {
    type: 'TEMPORARY',
    ...overrides.tempWallet
  });
  const proof = await createTestProof(user.id, tempWallet.id, overrides.proof);
  
  return {
    user,
    wallet,
    proof
  };
}

// Export the test Prisma client
export { prismaTest };