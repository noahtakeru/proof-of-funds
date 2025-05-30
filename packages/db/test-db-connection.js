/**
 * Database Connection Test
 * 
 * This script tests a direct connection to the database without using Prisma
 */
const { Client } = require('pg');

// Database connection parameters (hardcoded for direct testing)
const dbConfig = {
  host: '35.193.170.68',
  port: 5432,
  user: 'zkp_dev_user',
  password: 'Lt#VKfuATdJ*F/0Y',
  database: 'zkp_dev',
  connectionTimeoutMillis: 10000 // 10 seconds
};

console.log('Testing database connection with parameters:');
console.log(`Host: ${dbConfig.host}`);
console.log(`Port: ${dbConfig.port}`);
console.log(`User: ${dbConfig.user}`);
console.log(`Database: ${dbConfig.database}`);

// Create a client
const client = new Client(dbConfig);

// Test connection
async function testConnection() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');
    
    // Run a simple query
    console.log('Executing test query...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`Current database time: ${result.rows[0].current_time}`);
    
    // Test schema access
    console.log('Checking database tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Database tables:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    return 'Connection test successful';
  } catch (error) {
    console.error('Connection failed:', error.message);
    return `Connection test failed: ${error.message}`;
  } finally {
    // Close the connection
    await client.end();
    console.log('Connection closed');
  }
}

// Run the test
testConnection()
  .then(result => {
    console.log(result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });