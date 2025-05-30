/**
 * Test database connection
 * 
 * This script attempts to connect to the database and reports detailed diagnostics
 */
const { Client } = require('pg');
const net = require('net');

// Database connection parameters - using raw credentials to avoid any parsing issues
const config = {
  host: '35.193.170.68',
  port: 5432,
  user: 'zkp_dev_user',
  password: 'Lt#VKfuATdJ*F/0Y',
  database: 'zkp_dev',
  connectionTimeoutMillis: 10000, // 10 seconds
};

console.log('Testing database connection with the following parameters:');
console.log(`Host: ${config.host}`);
console.log(`Port: ${config.port}`);
console.log(`User: ${config.user}`);
console.log(`Database: ${config.database}`);
console.log('Password: <hidden>');

// First try to connect with a TCP socket to check if port is reachable
console.log('\n1. Testing TCP connectivity...');
const socket = new net.Socket();
const timeout = 5000; // 5 seconds

socket.setTimeout(timeout);

socket.on('connect', () => {
  console.log(`✅ TCP connection successful to ${config.host}:${config.port}`);
  socket.end();
  testPgConnection();
});

socket.on('timeout', () => {
  console.error(`❌ TCP connection timed out after ${timeout}ms`);
  console.log('\nPossible issues:');
  console.log('- Your IP address may not be allowed in the authorized networks');
  console.log('- A firewall may be blocking the connection');
  console.log('- The database server may be down or not accepting connections');
  socket.destroy();
  process.exit(1);
});

socket.on('error', (err) => {
  console.error(`❌ TCP connection error: ${err.message}`);
  console.log('\nPossible issues:');
  console.log('- Your IP address may not be allowed in the authorized networks');
  console.log('- A firewall may be blocking the connection');
  console.log('- The database server may be down or not accepting connections');
  socket.destroy();
  process.exit(1);
});

socket.connect(config.port, config.host);

// Test PostgreSQL connection
function testPgConnection() {
  console.log('\n2. Testing PostgreSQL connection...');
  const client = new Client(config);

  client.connect()
    .then(() => {
      console.log('✅ PostgreSQL connection successful!');
      
      // Try a simple query
      return client.query('SELECT version()');
    })
    .then(res => {
      console.log('\n3. Test query successful:');
      console.log(res.rows[0]);
      
      console.log('\n✅ All tests passed! Database connection is working properly.');
    })
    .catch(err => {
      console.error(`❌ PostgreSQL connection error: ${err.message}`);
      
      if (err.message.includes('password authentication failed')) {
        console.log('\nAuthentication failed. Please verify your username and password.');
      } else if (err.message.includes('does not exist')) {
        console.log('\nDatabase or user does not exist. Please verify database name and user.');
      } else {
        console.log('\nPossible issues:');
        console.log('- The database credentials may be incorrect');
        console.log('- The user may not have permission to access the database');
        console.log('- The database may not exist');
      }
    })
    .finally(() => {
      client.end();
    });
}