#!/usr/bin/env node
/**
 * Database Initialization Script
 * 
 * This script initializes the database by running migrations
 * and seeding with initial data.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Load environment variables from both the root .env and local .env
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Initializing database for environment: ${NODE_ENV}`);

// Define direct connection config to avoid URL parsing issues with special characters
const directDbConfig = {
  host: '35.193.170.68',
  port: 5432,
  user: NODE_ENV === 'test' ? 'zkp_test_user' : 'zkp_dev_user',
  password: NODE_ENV === 'test' ? '=+^4d;Q+SCa]{-ra' : 'Lt#VKfuATdJ*F/0Y',
  database: NODE_ENV === 'test' ? 'zkp_test' : 'zkp_dev'
};

// Create a properly formatted URL for Prisma
const encodedPassword = encodeURIComponent(directDbConfig.password);
const DATABASE_URL = `postgresql://${directDbConfig.user}:${encodedPassword}@${directDbConfig.host}:${directDbConfig.port}/${directDbConfig.database}`;

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

// Main initialization function
async function initializeDatabase() {
  console.log('Starting database initialization...');

  // Check if migrations folder exists
  const migrationsPath = path.resolve(__dirname, '../prisma/migrations');
  if (!fs.existsSync(migrationsPath)) {
    console.error('Error: Migrations folder not found.');
    process.exit(1);
  }

  // Run database migrations
  const migrationsSuccess = runCommand('npx prisma migrate deploy', 'database migrations');
  if (!migrationsSuccess) {
    console.error('Failed to run migrations. Aborting initialization.');
    process.exit(1);
  }

  // Generate Prisma client
  const generateSuccess = runCommand('npx prisma generate', 'Prisma client generation');
  if (!generateSuccess) {
    console.error('Failed to generate Prisma client. Aborting initialization.');
    process.exit(1);
  }

  // Seed the database if not in test environment
  if (NODE_ENV !== 'test') {
    const seedSuccess = runCommand('npx prisma db seed', 'database seeding');
    if (!seedSuccess) {
      console.error('Warning: Failed to seed database.');
    }
  }

  console.log('Database initialization completed successfully.');
}

// Run the initialization
initializeDatabase().catch(error => {
  console.error('Unhandled error during database initialization:', error);
  process.exit(1);
});