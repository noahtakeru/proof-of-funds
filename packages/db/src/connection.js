/**
 * Database Connection and Pooling Configuration
 * 
 * This module provides an optimized database connection pool for the application.
 * It includes robust error handling, connection monitoring, and performance optimization.
 */
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const { PrismaClient } = require('@prisma/client');

// Initialize environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = NODE_ENV === 'test' 
  ? process.env.DATABASE_URL_TEST 
  : process.env.DATABASE_URL_DEV;

// Parse connection string
const dbConfig = parse(DATABASE_URL);

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
  // Configure Prisma connection pool
  __internal: {
    engine: {
      connectTimeout: CONNECTION_TIMEOUT,
      connectionPoolOptions: {
        min: 1,
        max: POOL_SIZE,
        idleTimeoutMillis: IDLE_TIMEOUT,
        maxUses: 7500,
      },
    },
  },
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
  await shutdown();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connections');
  await shutdown();
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