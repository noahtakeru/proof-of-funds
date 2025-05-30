/**
 * Global Teardown for Jest
 * 
 * This file is run once after all tests.
 */

// Import database utilities from the db package
const { disconnectTestDatabase } = require('@proof-of-funds/db/test/db-test-helpers');

module.exports = async () => {
  console.log('Starting global teardown...');
  
  // Clean up database connections
  try {
    await disconnectTestDatabase();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Failed to disconnect from database:', error);
  }
  
  console.log('Global teardown completed');
};