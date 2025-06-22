/**
 * Simple script to view registered users in the database
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function viewUsers() {
  try {
    console.log('📧 Registered Email Addresses:\n');
    
    const users = await prisma.user.findMany({
      select: {
        email: true,
        emailVerified: true,
        createdAt: true,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (users.length === 0) {
      console.log('   No users found in database');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   ✓ Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
        console.log(`   ✓ Active: ${user.isActive ? 'Yes' : 'No'}`);
        console.log(`   ✓ Created: ${user.createdAt.toISOString()}`);
        console.log('');
      });
    }
    
    console.log(`Total users: ${users.length}`);
    
  } catch (error) {
    console.error('Error querying users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

viewUsers();