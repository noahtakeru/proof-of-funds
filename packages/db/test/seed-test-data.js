/**
 * Test Data Seeding Utility
 * 
 * This module provides utilities for seeding test data into the database
 * for unit and integration tests.
 */
const { prisma } = require('../src/connection');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a random Ethereum address
 * @returns {string} Random Ethereum address
 */
function randomAddress() {
  return `0x${uuidv4().replace(/-/g, '').substring(0, 40)}`;
}

/**
 * Generate a future date
 * @param {number} days Days from now
 * @returns {Date} Future date
 */
function futureDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Generate a past date
 * @param {number} days Days before now
 * @returns {Date} Past date
 */
function pastDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Create a test user
 * @param {Object} data Override data
 * @returns {Promise<Object>} Created user
 */
async function createUser(data = {}) {
  return prisma.user.create({
    data: {
      id: data.id || uuidv4(),
      address: data.address || randomAddress(),
      createdAt: data.createdAt || new Date(),
      lastLoginAt: data.lastLoginAt || new Date(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      permissions: data.permissions || ['USER'],
      settings: data.settings || {}
    }
  });
}

/**
 * Create a test wallet
 * @param {string} userId User ID
 * @param {Object} data Override data
 * @returns {Promise<Object>} Created wallet
 */
async function createWallet(userId, data = {}) {
  return prisma.wallet.create({
    data: {
      id: data.id || uuidv4(),
      userId,
      address: data.address || randomAddress(),
      chainId: data.chainId || 1,
      type: data.type || 'USER_CONNECTED',
      encryptedPrivateKey: data.encryptedPrivateKey,
      keyId: data.keyId,
      createdAt: data.createdAt || new Date(),
      lastUsedAt: data.lastUsedAt || new Date(),
      isArchived: data.isArchived !== undefined ? data.isArchived : false,
      balance: data.balance,
      nonce: data.nonce
    }
  });
}

/**
 * Create a test proof
 * @param {string} userId User ID
 * @param {string} tempWalletId Temporary wallet ID
 * @param {Object} data Override data
 * @returns {Promise<Object>} Created proof
 */
async function createProof(userId, tempWalletId, data = {}) {
  return prisma.proof.create({
    data: {
      id: data.id || uuidv4(),
      userId,
      referenceId: data.referenceId || `ref-${uuidv4()}`,
      createdAt: data.createdAt || new Date(),
      expiresAt: data.expiresAt || futureDate(),
      proofType: data.proofType || 'STANDARD',
      isRevoked: data.isRevoked !== undefined ? data.isRevoked : false,
      revokedAt: data.revokedAt,
      revocationReason: data.revocationReason,
      encryptedData: data.encryptedData || 'encrypted-test-data',
      encryptionKeyId: data.encryptionKeyId || 'test-key-id',
      tempWalletId,
      transactionHash: data.transactionHash,
      merkleRoot: data.merkleRoot,
      merklePath: data.merklePath,
      batchId: data.batchId,
      warningFlags: data.warningFlags || [],
      originalWallets: data.originalWallets || [randomAddress()],
      status: data.status || 'PENDING'
    }
  });
}

/**
 * Create a test organization
 * @param {Object} data Override data
 * @returns {Promise<Object>} Created organization
 */
async function createOrganization(data = {}) {
  return prisma.organization.create({
    data: {
      id: data.id || uuidv4(),
      name: data.name || `Test Organization ${uuidv4()}`,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      apiKey: data.apiKey || `api-${uuidv4()}`,
      settings: data.settings || {}
    }
  });
}

/**
 * Create multiple test users
 * @param {number} count Number of users to create
 * @param {Object} data Base data for all users
 * @returns {Promise<Array>} Created users
 */
async function createUsers(count, data = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(createUser(data));
  }
  return Promise.all(users);
}

/**
 * Create complete test data set
 * @param {Object} userData User data overrides
 * @param {Object} walletData Wallet data overrides
 * @param {Object} proofData Proof data overrides
 * @returns {Promise<Object>} Created test data
 */
async function createTestDataSet(userData = {}, walletData = {}, proofData = {}) {
  const user = await createUser(userData);
  const wallet = await createWallet(user.id, walletData);
  const tempWallet = await createWallet(user.id, { 
    type: 'TEMPORARY',
    ...walletData
  });
  const proof = await createProof(user.id, tempWallet.id, proofData);
  
  return { user, wallet, tempWallet, proof };
}

/**
 * Clean up all test data
 * @returns {Promise<void>}
 */
async function cleanupTestData() {
  await prisma.verification.deleteMany({});
  await prisma.proof.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.proofTemplate.deleteMany({});
  await prisma.organizationUser.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.batch.deleteMany({});
}

module.exports = {
  createUser,
  createUsers,
  createWallet,
  createProof,
  createOrganization,
  createTestDataSet,
  cleanupTestData,
  randomAddress,
  futureDate,
  pastDate
};