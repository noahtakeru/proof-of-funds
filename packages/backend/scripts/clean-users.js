/**
 * Script to clean test users from database (USE CAREFULLY!)
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanTestUsers() {
  try {
    console.log('⚠️  CLEANING TEST USERS FROM DATABASE...\n');
    
    // Delete all users (BE CAREFUL!)
    const result = await prisma.user.deleteMany();
    
    console.log(`✅ Deleted ${result.count} users from database`);
    
  } catch (error) {
    console.error('Error cleaning users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Uncomment the line below to run the cleanup
// cleanTestUsers();