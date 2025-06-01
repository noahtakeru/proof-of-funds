#!/usr/bin/env node
/**
 * Database Migration Script
 * 
 * This script runs database migrations using Prisma Migrate
 * with proper error handling and logging.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Load environment variables from both the root .env and local .env
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Running migrations for environment: ${NODE_ENV}`);

// Define direct connection config to avoid URL parsing issues with special characters
const directDbConfig = {
  host: '35.193.170.68',
  port: 5432,
  user: NODE_ENV === 'test' ? 'zkp_test_user' : 'zkp_dev_user',
  password: NODE_ENV === 'test' ? '=+^4d;Q+SCa]{-ra' : 'Lt#VKfuATdJ*F/0Y',
  database: NODE_ENV === 'test' ? 'zkp_test' : 'zkp_dev',
  ssl: false // Explicitly disable SSL for these test databases
};

// Create a properly formatted URL for Prisma
const encodedPassword = encodeURIComponent(directDbConfig.password);
const DATABASE_URL = `postgresql://${directDbConfig.user}:${encodedPassword}@${directDbConfig.host}:${directDbConfig.port}/${directDbConfig.database}?sslmode=disable`;

console.log(`Using database: ${directDbConfig.host}:${directDbConfig.port}/${directDbConfig.database}`);

// Create or update the Prisma .env file with the current DATABASE_URL
const prismaEnvPath = path.resolve(__dirname, '../prisma/.env');
fs.writeFileSync(prismaEnvPath, 
`# This file contains environment variables for Prisma
# It will be used by Prisma CLI but not by the Node.js application

# Development database URL with encoded special characters
DATABASE_URL="${DATABASE_URL}"

# Direct connection URL - used to bypass any parsing issues
DIRECT_URL="${DATABASE_URL}"
`);
console.log(`Updated Prisma .env file at ${prismaEnvPath}`);

// Helper function to run a command and handle errors
function runCommand(command, description) {
  console.log(`Running ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log(`${description} completed successfully.`);
    return true;
  } catch (error) {
    console.error(`Error during ${description}:`, error.message);
    return false;
  }
}

// Main migration function
async function runMigrations() {
  console.log('Starting database migrations...');

  // Check if migrations folder exists
  const migrationsPath = path.resolve(__dirname, '../prisma/migrations');
  if (!fs.existsSync(migrationsPath)) {
    console.error('Error: Migrations folder not found.');
    process.exit(1);
  }

  // Get command line arguments
  const args = process.argv.slice(2);
  
  // Handle different migration commands
  if (args.includes('--create') || args.includes('-c')) {
    // Extract migration name from arguments
    const nameIndex = Math.max(args.indexOf('--create'), args.indexOf('-c')) + 1;
    const migrationName = args[nameIndex] || 'migration';
    
    // Create new migration
    console.log(`Creating migration "${migrationName}"...`);
    const createSuccess = runCommand(`npx prisma migrate dev --name ${migrationName} --create-only`, 'migration creation');
    
    if (!createSuccess) {
      console.error('Failed to create migration. Aborting.');
      process.exit(1);
    }
    
    console.log(`Migration "${migrationName}" created successfully. Please edit the migration file and then run this script again without --create to apply it.`);
  } else if (args.includes('--reset') || args.includes('-r')) {
    // Reset database (development only)
    if (NODE_ENV === 'production') {
      console.error('Error: Cannot reset database in production environment.');
      process.exit(1);
    }
    
    console.log('Resetting database...');
    const resetSuccess = runCommand('npx prisma migrate reset --force', 'database reset');
    
    if (!resetSuccess) {
      console.error('Failed to reset database. Aborting.');
      process.exit(1);
    }
    
    console.log('Database reset successfully.');
  } else if (args.includes('--status') || args.includes('-s')) {
    // Check migration status
    console.log('Checking migration status...');
    runCommand('npx prisma migrate status', 'migration status check');
  } else {
    // Run database migrations
    console.log('Applying pending migrations...');
    
    // For development, use migrate dev which creates the DB if it doesn't exist
    if (NODE_ENV === 'development') {
      const devMigrateSuccess = runCommand('npx prisma migrate dev', 'development migration');
      
      if (!devMigrateSuccess) {
        console.error('Failed to run development migrations. Aborting.');
        process.exit(1);
      }
    } else {
      // For other environments, use migrate deploy
      const deploySuccess = runCommand('npx prisma migrate deploy', 'migration deployment');
      
      if (!deploySuccess) {
        console.error('Failed to deploy migrations. Aborting.');
        process.exit(1);
      }
    }
    
    // Generate Prisma client
    const generateSuccess = runCommand('npx prisma generate', 'Prisma client generation');
    
    if (!generateSuccess) {
      console.error('Failed to generate Prisma client. Aborting.');
      process.exit(1);
    }
    
    console.log('Migrations applied successfully and Prisma client generated.');
  }
}

// Run the migrations
runMigrations().catch(error => {
  console.error('Unhandled error during migrations:', error);
  process.exit(1);
});