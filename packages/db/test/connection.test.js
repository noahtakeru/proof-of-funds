/**
 * Connection Tests
 */
const { pool, prisma, healthCheck, transaction, query, getPoolStatus } = require('../src/connection');

// Mock process.env for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL_TEST = process.env.DATABASE_URL_TEST || 'postgresql://zkp_test_user:=+^4d;Q+SCa]{-ra@35.193.170.68:5432/zkp_test';
process.env.PGBOUNCER_POOL_SIZE = '5';
process.env.PGBOUNCER_IDLE_TIMEOUT = '60';
process.env.PGBOUNCER_CONNECTION_TIMEOUT = '10';

describe('Database Connection', () => {
  // Ensure we close connections after tests
  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
  
  it('should establish a connection to the database', async () => {
    // Simple query to verify connection
    const result = await query('SELECT 1 as test');
    expect(result.rows[0].test).toBe(1);
  });
  
  it('should pass health check', async () => {
    const result = await healthCheck();
    expect(result).toBe(true);
  });
  
  it('should report pool status', () => {
    const status = getPoolStatus();
    expect(status).toHaveProperty('totalConnections');
    expect(status).toHaveProperty('idleConnections');
    expect(status).toHaveProperty('waitingClients');
    expect(status).toHaveProperty('maxConnections');
  });
  
  it('should execute transactions', async () => {
    // Test transaction with rollback
    await expect(
      transaction(async (client) => {
        // Create a temporary table
        await client.query('CREATE TEMPORARY TABLE test_transaction (id SERIAL, value TEXT)');
        
        // Insert a row
        await client.query('INSERT INTO test_transaction (value) VALUES ($1)', ['test value']);
        
        // Verify the row was inserted
        const result = await client.query('SELECT * FROM test_transaction');
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].value).toBe('test value');
        
        // Throw an error to trigger rollback
        throw new Error('Test rollback');
      })
    ).rejects.toThrow('Test rollback');
    
    // Test successful transaction
    const result = await transaction(async (client) => {
      // Create a temporary table
      await client.query('CREATE TEMPORARY TABLE test_transaction_success (id SERIAL, value TEXT)');
      
      // Insert a row
      await client.query('INSERT INTO test_transaction_success (value) VALUES ($1)', ['test value']);
      
      // Return a result
      return 'success';
    });
    
    expect(result).toBe('success');
  });
  
  it('should handle parameterized queries', async () => {
    // Create a temporary table
    await query('CREATE TEMPORARY TABLE test_params (id SERIAL, value TEXT)');
    
    // Insert with parameters
    await query('INSERT INTO test_params (value) VALUES ($1)', ['test value']);
    
    // Select with parameters
    const result = await query('SELECT * FROM test_params WHERE value = $1', ['test value']);
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].value).toBe('test value');
  });
  
  it('should handle errors in queries', async () => {
    // Invalid SQL syntax
    await expect(
      query('SELECT * FROM nonexistent_table')
    ).rejects.toThrow();
  });
});