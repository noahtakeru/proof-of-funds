/**
 * Database Connection and Pooling Configuration
 * 
 * This module provides an optimized database connection pool for the application.
 * It includes robust error handling, connection monitoring, and performance optimization.
 */
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Load environment variables from both the root .env and local .env
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Initialize environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';

// Define fixed database URLs if not provided in environment
// URL-encode special characters in the password
const DEFAULT_DEV_URL = "postgresql://zkp_dev_user:Lt%23VKfuATdJ%2AF%2F0Y@35.193.170.68:5432/zkp_dev";
const DEFAULT_TEST_URL = "postgresql://zkp_test_user:%3D%2B%5E4d%3BQ%2BSCa%5D%7B-ra@35.193.170.68:5432/zkp_test";

// Determine the correct database URL based on environment
let DATABASE_URL;
if (NODE_ENV === 'test') {
  DATABASE_URL = process.env.DATABASE_URL_TEST || DEFAULT_TEST_URL;
} else {
  DATABASE_URL = process.env.DATABASE_URL_DEV || DEFAULT_DEV_URL;
}

// Fallback for direct DATABASE_URL
if (!DATABASE_URL && process.env.DATABASE_URL) {
  DATABASE_URL = process.env.DATABASE_URL;
}

// Additional validation
if (!DATABASE_URL) {
  console.error('Error: No database connection string found. Using fallback.');
  DATABASE_URL = NODE_ENV === 'test' ? DEFAULT_TEST_URL : DEFAULT_DEV_URL;
}

// Define direct connection config to avoid URL parsing issues with special characters
const directDbConfig = {
  host: '35.193.170.68',
  port: 5432,
  user: NODE_ENV === 'test' ? 'zkp_test_user' : 'zkp_dev_user',
  password: NODE_ENV === 'test' ? '=+^4d;Q+SCa]{-ra' : 'Lt#VKfuATdJ*F/0Y',
  database: NODE_ENV === 'test' ? 'zkp_test' : 'zkp_dev',
  ssl: false // Explicitly disable SSL for these test databases
};

// Create a properly formatted URL for Prisma
const encodedPassword = encodeURIComponent(directDbConfig.password);
const formattedUrl = `postgresql://${directDbConfig.user}:${encodedPassword}@${directDbConfig.host}:${directDbConfig.port}/${directDbConfig.database}?sslmode=disable`;

// Update DATABASE_URL with properly encoded version
DATABASE_URL = formattedUrl;

// Create/update Prisma .env for CLI tools
const prismaEnvPath = path.resolve(__dirname, '../prisma/.env');
try {
  fs.writeFileSync(prismaEnvPath, `# This file contains environment variables for Prisma\n# It will be used by Prisma CLI but not by the Node.js application\n\nDATABASE_URL="${formattedUrl}"\n`);
  console.log(`Updated Prisma .env file at ${prismaEnvPath}`);
} catch (error) {
  console.warn(`Could not write to ${prismaEnvPath}: ${error.message}`);
}

// Use direct config instead of parsing to avoid special character issues
let dbConfig = directDbConfig;
console.log(`Configured database connection to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

// Set pool configuration from environment variables or defaults
const POOL_SIZE = parseInt(process.env.PGBOUNCER_POOL_SIZE || '10', 10);
const IDLE_TIMEOUT = parseInt(process.env.PGBOUNCER_IDLE_TIMEOUT || '300', 10) * 1000; // Convert to ms
const CONNECTION_TIMEOUT = parseInt(process.env.PGBOUNCER_CONNECTION_TIMEOUT || '30', 10) * 1000; // Convert to ms
const MAX_CLIENTS = parseInt(process.env.PGBOUNCER_MAX_CLIENTS || '50', 10);
const STATEMENT_TIMEOUT = parseInt(process.env.PGBOUNCER_STATEMENT_TIMEOUT || '60000', 10); // 60s default

// Create connection pool
const pool = new Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  ssl: dbConfig.ssl,
  min: 1, // Keep at least one connection open
  max: POOL_SIZE,
  idleTimeoutMillis: IDLE_TIMEOUT,
  connectionTimeoutMillis: CONNECTION_TIMEOUT,
  maxUses: 7500, // Close client after this many uses to prevent memory issues
  statement_timeout: STATEMENT_TIMEOUT // Maximum query execution time
});

// Error event handler
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client:', err);
});

// Count active and idle connections
pool.on('connect', (client) => {
  if (process.env.NODE_ENV === 'development' || process.env.LOG_POOL_ACTIVITY === 'true') {
    console.log(`DB Pool: New connection established (${pool.totalCount} total, ${pool.idleCount} idle)`);
  }
});

// Initialize Prisma with optimized connection management
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
  log: NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['warn', 'error'],
});

/**
 * Get a client from the pool
 * @returns {Promise<PoolClient>} A database client
 */
const getClient = async () => {
  const client = await pool.connect();
  
  // Set default statement timeout for this client
  await client.query(`SET statement_timeout TO ${STATEMENT_TIMEOUT}`);
  
  return client;
};

/**
 * Execute a query with a dedicated client
 * @param {String} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<QueryResult>} Query result
 */
const query = async (text, params) => {
  const client = await getClient();
  
  try {
    // Log slow queries in development
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000 && (NODE_ENV === 'development' || process.env.LOG_SLOW_QUERIES === 'true')) {
      console.warn(`Slow query (${duration}ms): ${text}`);
    }
    
    return result;
  } finally {
    client.release();
  }
};

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Function that takes a client and executes queries
 * @returns {Promise<any>} Result of the transaction
 */
const transaction = async (callback) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Healthcheck function to verify database connectivity
 * @returns {Promise<boolean>} True if connected, throws error otherwise
 */
const healthCheck = async () => {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    throw error;
  }
};

/**
 * Get current pool status
 * @returns {Object} Current pool statistics
 */
const getPoolStatus = () => ({
  totalConnections: pool.totalCount,
  idleConnections: pool.idleCount,
  waitingClients: pool.waitingCount,
  maxConnections: POOL_SIZE
});

/**
 * Shut down connection pool
 * @returns {Promise<void>}
 */
const shutdown = async () => {
  try {
    await prisma.$disconnect();
    await pool.end();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
    throw error;
  }
};

// Clean up connections on process exit
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connections');
  await shutdown().catch(console.error);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connections');
  await shutdown().catch(console.error);
});

module.exports = {
  pool,
  prisma,
  getClient,
  query,
  transaction,
  healthCheck,
  getPoolStatus,
  shutdown
};