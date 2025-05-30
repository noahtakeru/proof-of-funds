# Database Migration System

This document describes the database migration system for the Proof of Funds platform.

## Overview

The migration system is built on Prisma Migrate, which provides:

- Version-controlled schema changes
- Automatic SQL generation
- Up and down migrations
- Migration history tracking
- Safe production deployments

## Migration Files

Migrations are stored in the `prisma/migrations` directory. Each migration is in its own folder with the format `YYYYMMDDHHMMSS_name`:

```
prisma/migrations/
├── 20240529000000_initial_schema/
│   └── migration.sql
├── 20240529120000_add_indexes/
│   └── migration.sql
├── 20240529130000_add_foreign_key_indexes/
│   └── migration.sql
└── migration_lock.toml
```

## Current Migrations

### Initial Schema (20240529000000_initial_schema)

The initial schema migration creates all the base tables and relations:

- Users
- Wallets
- Proofs
- Verifications
- Batches
- Organizations
- OrganizationUsers
- ProofTemplates
- AuditLogs

It also creates the necessary enums, primary keys, foreign keys, and basic indexes.

### Performance Indexes (20240529120000_add_indexes)

This migration adds comprehensive indexes for performance optimization:

- Hash indexes for quick lookups on frequently queried columns
- B-tree indexes for range queries
- GIN indexes for array and JSON columns
- Composite indexes for common query patterns
- Partial indexes for specific conditions

### Foreign Key Indexes (20240529130000_add_foreign_key_indexes)

This migration adds additional indexes to optimize foreign key relationships:

- Indexes on foreign key columns
- Partial indexes for conditional relationships
- Composite indexes for join operations
- Text search indexes for text columns
- PostgreSQL extensions for advanced indexing

## Creating Migrations

New migrations can be created using the migration script:

```bash
npm run run-migrations -- --create migration_name
```

This creates a new migration file that you can edit before applying.

## Applying Migrations

To apply pending migrations:

```bash
npm run run-migrations
```

In development, this will apply migrations to the development database.

## Development vs Production

### Development

In development, migrations are created and applied directly:

```bash
npm run run-migrations -- --create add_new_feature
# Edit migration file
npm run run-migrations
```

### Production

For production, we use the deployment mode which is safer:

```bash
NODE_ENV=production npm run run-migrations
```

This runs migrations without generating new migration files and is suitable for CI/CD pipelines.

## Rollbacks

Prisma Migrate doesn't directly support rollbacks, but you can:

1. Create a new migration that reverses the changes
2. Use the reset command in development (NOT production):

```bash
npm run run-migrations -- --reset
```

## Best Practices

1. **Keep migrations small**: Each migration should make a focused set of changes
2. **Test migrations**: Always test migrations in development before applying to production
3. **Version control**: Always commit migration files to version control
4. **Documentation**: Document complex migrations in the migration file
5. **Avoid raw SQL**: Use Prisma schema changes where possible
6. **Handle data migrations**: Add data migration code when schema changes affect existing data