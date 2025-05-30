#!/usr/bin/env node
/**
 * Database Initialization Script
 * 
 * This script initializes the database by running migrations
 * and seeding with initial data.
 */
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Initializing database for environment: ${NODE_ENV}`);

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