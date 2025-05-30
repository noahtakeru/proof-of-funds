/**
 * Database Infrastructure for Proof of Funds Platform
 * 
 * This module provides database connectivity, connection pooling,
 * and Prisma client initialization for the platform.
 */

const { 
  prisma,
  pool,
  query,
  transaction,
  healthCheck,
  getPoolStatus,
  shutdown
} = require('./connection');

/**
 * Models with type definitions and validation
 */
const models = {
  user: prisma.user,
  wallet: prisma.wallet,
  proof: prisma.proof,
  verification: prisma.verification,
  batch: prisma.batch,
  organization: prisma.organization,
  organizationUser: prisma.organizationUser,
  proofTemplate: prisma.proofTemplate,
  auditLog: prisma.auditLog,
};

/**
 * Database query monitoring and metrics
 * Tracks and logs query performance
 */
const metrics = {
  /**
   * Log query execution metrics
   * @param {string} operation - The operation being performed
   * @param {number} duration - Duration in milliseconds
   */
  logQueryExecution: (operation, duration) => {
    if (duration > 1000) {
      console.warn(`Slow database operation: ${operation} (${duration}ms)`);
    }
  },
  
  /**
   * Get current database metrics
   * @returns {Object} Database metrics
   */
  getCurrentMetrics: () => ({
    poolStatus: getPoolStatus(),
    prismaConnections: prisma.$metrics?.connections || { active: 'unknown', idle: 'unknown' }
  })
};

/**
 * Raw SQL execution with transaction support
 * Use only when Prisma's API is insufficient
 */
const sql = {
  /**
   * Execute a raw SQL query
   * @param {string} query - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<any>} Query result
   */
  query: async (queryString, params = []) => {
    return query(queryString, params);
  },
  
  /**
   * Execute raw SQL in a transaction
   * @param {Function} fn - Function containing SQL operations
   * @returns {Promise<any>} Transaction result
   */
  transaction: async (fn) => {
    return transaction(fn);
  }
};

module.exports = {
  prisma,
  pool,
  transaction,
  healthCheck,
  shutdown,
  metrics,
  sql,
  models,
};