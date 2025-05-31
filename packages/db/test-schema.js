/**
 * Test Script for Schema Enhancements
 * 
 * This script tests that the new fields added to Organization and ProofTemplate models
 * in Phase 1.2 are correctly implemented.
 */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: './.env' });

async function testSchema() {
  // Create PrismaClient with the correct database URL
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    console.log('Starting schema test...');

    // Test Organization model with new fields
    console.log('\n1. Testing Organization model with new fields:');
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        contactPhone: true,
        description: true
      }
    });
    console.log(`Found ${orgs.length} organizations`);
    console.log('First organization data sample:', orgs[0] ? JSON.stringify(orgs[0], null, 2) : 'No organizations found');

    // Test ProofTemplate model with new fields
    console.log('\n2. Testing ProofTemplate model with new fields:');
    const templates = await prisma.proofTemplate.findMany({
      select: {
        id: true,
        name: true,
        categoryTags: true,
        isPublic: true,
        minVerificationInterval: true
      }
    });
    console.log(`Found ${templates.length} proof templates`);
    console.log('First template data sample:', templates[0] ? JSON.stringify(templates[0], null, 2) : 'No templates found');

    // Attempt to create an organization with the new fields
    console.log('\n3. Testing creation of organization with new fields:');
    const testOrgName = `Test Org ${Date.now()}`;
    const newOrg = await prisma.organization.create({
      data: {
        name: testOrgName,
        email: 'test@example.com',
        contactPhone: '+1 555-123-4567',
        description: 'Test organization created by schema test script',
        settings: {
          testSetting: true
        }
      },
    });
    console.log('Created test organization:', JSON.stringify(newOrg, null, 2));

    // Attempt to create a proof template with the new fields
    console.log('\n4. Testing creation of proof template with new fields:');
    const newTemplate = await prisma.proofTemplate.create({
      data: {
        organizationId: newOrg.id,
        name: 'Test Template',
        description: 'Template created by test script',
        proofType: 'STANDARD',
        threshold: '1000000000000000000',
        expiryPeriod: 86400,
        categoryTags: ['Test', 'Standard', 'Schema'],
        isPublic: true,
        minVerificationInterval: 3600,
        settings: {}
      },
    });
    console.log('Created test template:', JSON.stringify(newTemplate, null, 2));

    // Clean up test data
    console.log('\n5. Cleaning up test data:');
    await prisma.proofTemplate.delete({
      where: { id: newTemplate.id }
    });
    await prisma.organization.delete({
      where: { id: newOrg.id }
    });
    console.log('Test data cleaned up successfully');

    console.log('\nSchema test completed successfully! Phase 1.2 enhancements are working correctly.');
  } catch (error) {
    console.error('Error testing schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSchema();