# Database Package

This package provides database connectivity, models, and utilities for the Proof of Funds platform.

## Overview

The database package uses Prisma ORM to provide type-safe database access with:

- Comprehensive model definitions
- Migration system for schema changes
- Connection pooling for performance
- Transaction support
- Test utilities

## Setup

### Prerequisites

- Node.js 16+
- npm or yarn
- PostgreSQL database

### Installation

```bash
npm install
```

### Environment Variables

Copy the example environment variables and update with your credentials:

```
# Database URLs
DATABASE_URL_DEV="postgresql://username:password@host:5432/dbname"
DATABASE_URL_TEST="postgresql://username:password@host:5432/testdb"

# Connection Pool Settings
PGBOUNCER_POOL_SIZE=10
PGBOUNCER_IDLE_TIMEOUT=300
PGBOUNCER_CONNECTION_TIMEOUT=30
PGBOUNCER_MAX_CLIENTS=50
PGBOUNCER_STATEMENT_TIMEOUT=60000
```

### Database Access Setup

The database is hosted on Google Cloud SQL. To connect to it:

1. Go to Google Cloud Console
2. Navigate to SQL → Select the PostgreSQL instance
3. Go to the "Connections" tab
4. Under "Networking" section, find "Authorized networks"
5. Add your IP address to the authorized networks
6. Save changes

## Usage

### Database Initialization

```bash
npm run init-db
```

### Run Migrations

```bash
npm run run-migrations
```

### Generate Prisma Client

```bash
npm run generate
```

### Testing

```bash
npm test
```

## Migration System

The migration system uses Prisma Migrate to manage database schema changes. It includes:

- Version-controlled SQL migration files
- Migration script with creation, application, and rollback
- Support for different environments (development, test, production)

### Creating a New Migration

```bash
npm run run-migrations -- --create add_new_feature
```

This creates a new migration file in `prisma/migrations` that you can edit before applying.

### Applying Migrations

```bash
npm run run-migrations
```

### Checking Migration Status

```bash
npm run run-migrations -- --status
```

### Resetting the Database (Development Only)

```bash
npm run run-migrations -- --reset
```

## Database Models

The database schema includes the following main models:

- **User**: Platform users with authentication and permissions
- **Wallet**: User-connected or temporary wallets with balance information
- **Proof**: Generated proofs with various types (Standard, Threshold, Maximum, ZK)
- **Verification**: Proof verification records
- **Batch**: Batched proofs for submission
- **Organization**: User groups with templates
- **ProofTemplate**: Reusable proof templates

## Database Architecture

### Connection Pooling

The database connection uses a connection pool to:

- Optimize connection management
- Reuse connections for better performance
- Gracefully handle connection failures
- Monitor connection metrics

### Transactions

The package provides transaction support for:

- Atomic operations
- Automatic rollback on errors
- Query batching

### Metrics and Monitoring

The package includes metrics for:

- Connection pool status
- Query performance monitoring
- Slow query logging

## Troubleshooting

### Connection Issues

If you're experiencing connection issues:

1. Verify your database credentials in the .env file
2. Ensure your IP address is whitelisted in GCP
3. Check if your network allows outbound connections on port 5432
4. Verify the database server is running

### Migration Errors

For migration errors:

1. Check if the database exists and is accessible
2. Verify you have the correct permissions
3. Check for syntax errors in migration files
4. Ensure Prisma is properly configured