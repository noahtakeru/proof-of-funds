/**
 * Script to manually verify a user's email for testing
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyUserEmail(email) {
  try {
    console.log(`🔍 Looking for user with email: ${email}\n`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        createdAt: true
      }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('👤 User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Currently verified: ${user.emailVerified ? 'Yes' : 'No'}`);
    console.log(`   Created: ${user.createdAt.toISOString()}\n`);
    
    if (user.emailVerified) {
      console.log('✅ User is already verified!');
      return;
    }
    
    // Manually verify the user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        tokenExpiry: null
      }
    });
    
    console.log('✅ User email verified successfully!');
    console.log('🎉 User can now log in.');
    
  } catch (error) {
    console.error('❌ Error verifying user email:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'nyehnyeh37@gmail.com';
verifyUserEmail(email);