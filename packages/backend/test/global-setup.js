/**
 * Global Setup for Jest
 * 
 * This file is run once before all tests.
 */
require('dotenv').config();

// Import database utilities from the db package
const { setupTestDatabase } = require('@proof-of-funds/db/test/db-test-helpers');

module.exports = async () => {
  console.log('Starting global setup...');
  
  // Make sure we're using the test database
  process.env.NODE_ENV = 'test';
  
  if (!process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL_TEST = 'postgresql://zkp_test_user:=+^4d;Q+SCa]{-ra@35.193.170.68:5432/zkp_test';
  }
  
  // Initialize test database
  try {
    await setupTestDatabase();
    console.log('Test database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
  
  console.log('Global setup completed');
};