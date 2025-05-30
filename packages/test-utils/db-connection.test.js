/**
 * Database Connection Test
 * 
 * Tests that we can connect to the database
 */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '../../.env' });

// Set test environment
process.env.NODE_ENV = 'test';

// Create Prisma client with encoded URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://zkp_test_user:%3D%2B%5E4d%3BQ%2BSCa%5D%7B-ra@35.193.170.68:5432/zkp_test",
    },
  },
});

describe('Database Connection', () => {
  // Disconnect after all tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to the database', async () => {
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result[0].test).toBe(1);
  });
});