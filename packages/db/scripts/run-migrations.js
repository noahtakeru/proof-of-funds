#!/usr/bin/env node
/**
 * Database Migration Script
 * 
 * This script runs database migrations using Prisma Migrate
 * with proper error handling and logging.
 */
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Running migrations for environment: ${NODE_ENV}`);

// Validate database connection URLs
const DATABASE_URL_DEV = process.env.DATABASE_URL_DEV;
const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

if (!DATABASE_URL_DEV || !DATABASE_URL_TEST) {
  console.error('Error: DATABASE_URL_DEV and DATABASE_URL_TEST must be set in .env');
  process.exit(1);
}

// Set the appropriate database URL based on environment
process.env.DATABASE_URL = NODE_ENV === 'test' ? DATABASE_URL_TEST : DATABASE_URL_DEV;
console.log(`Using database URL: ${process.env.DATABASE_URL.split('@')[1]}`);

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