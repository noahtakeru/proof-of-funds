/**
 * Seed script for the database
 * 
 * This script populates the database with initial data needed for the application.
 * In a production environment, this should be minimal and focused on reference data.
 */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '../.env' });

// Create PrismaClient with the correct database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://zkp_dev_user:Lt%23VKfuATdJ%2AF%2F0Y@35.193.170.68:5432/zkp_dev",
    },
  },
});

async function main() {
  console.log('Starting seed process...');
  
  // Create a default organization if none exists
  const orgCount = await prisma.organization.count();
  if (orgCount === 0) {
    console.log('Creating default organization...');
    const defaultOrg = await prisma.organization.create({
      data: {
        name: 'Proof of Funds Platform',
        settings: {
          defaultProofExpiry: 604800, // 7 days in seconds
          maxProofsPerUser: 100,
          allowedProofTypes: ['STANDARD', 'THRESHOLD', 'MAXIMUM', 'ZERO_KNOWLEDGE']
        }
      }
    });
    console.log(`Created default organization with ID: ${defaultOrg.id}`);
    
    // Create default proof templates for the organization
    await prisma.proofTemplate.createMany({
      data: [
        {
          organizationId: defaultOrg.id,
          name: 'Standard KYC Verification',
          description: 'Verify exact amount for KYC purposes',
          proofType: 'STANDARD',
          threshold: '1000000000000000000', // 1 ETH in wei
          expiryPeriod: 2592000, // 30 days in seconds
          settings: {
            requiredChains: [1], // Ethereum mainnet
            warningThreshold: 0.8, // Warn if balance drops below 80%
          }
        },
        {
          organizationId: defaultOrg.id,
          name: 'Minimum Investment Threshold',
          description: 'Verify minimum investment amount',
          proofType: 'THRESHOLD',
          threshold: '10000000000000000000', // 10 ETH in wei
          expiryPeriod: 7776000, // 90 days in seconds
          settings: {
            requiredChains: [1, 137], // Ethereum and Polygon
            allowMultipleWallets: true,
            warningThreshold: 0.9, // Warn if balance drops below 90%
          }
        },
        {
          organizationId: defaultOrg.id,
          name: 'Maximum Account Limit',
          description: 'Verify account stays below maximum value',
          proofType: 'MAXIMUM',
          threshold: '100000000000000000000', // 100 ETH in wei
          expiryPeriod: 2592000, // 30 days in seconds
          settings: {
            requiredChains: [1], // Ethereum mainnet
            warningThreshold: 0.95, // Warn if balance reaches 95% of max
          }
        }
      ]
    });
    
    console.log('Created default proof templates');
  } else {
    console.log('Default organization already exists, skipping creation');
  }

  console.log('Seed process completed successfully');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });