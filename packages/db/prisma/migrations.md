# Database Migration System

This document describes the database migration system for the Proof of Funds platform.

## Migration Architecture

The Proof of Funds platform uses Prisma Migrate for database schema migrations. This provides:

1. **Version Control**: All schema changes are tracked in migration files
2. **Automated Application**: Migrations are applied automatically during deployment
3. **Rollback Capability**: Migrations can be rolled back if needed
4. **Environment Awareness**: Different strategies for development vs. production

## Migration Files

Migrations are stored in the `prisma/migrations` directory with the following structure:

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

Each migration is contained in a timestamped directory with a descriptive name, containing a `migration.sql` file with the SQL statements to apply.

## Current Migrations

### 20240529000000_initial_schema

Initial database schema creation with:

- User tables
- Wallet tables
- Proof tables
- Verification tables
- Batch tables
- Organization tables
- Basic indexes
- Foreign key relationships

### 20240529120000_add_indexes

Additional indexes for performance optimization:

- Specialized indexes (hash, GIN, etc.)
- Indexes for common query patterns
- Full coverage of all major tables

### 20240529130000_add_foreign_key_indexes

Advanced indexing for complex queries:

- Foreign key indexes
- Partial indexes
- B-tree indexes for range queries
- Full text search indexes
- Required PostgreSQL extensions

## Creating Migrations

To create a new migration:

```bash
node scripts/run-migrations.js --create migration_name
```

This will:
1. Create a new migration file based on the difference between the current schema and the database
2. Allow you to edit the migration file before applying it

## Applying Migrations

To apply all pending migrations:

```bash
node scripts/run-migrations.js
```

In development, this will:
1. Apply all pending migrations
2. Generate an updated Prisma client

In production, it will:
1. Apply all pending migrations without modifying the schema
2. Generate an updated Prisma client

## Checking Migration Status

To check the status of migrations:

```bash
node scripts/run-migrations.js --status
```

This will show:
1. Which migrations have been applied
2. Which migrations are pending
3. Any drift between the expected and actual schema

## Resetting the Database (Development Only)

To reset the database in development:

```bash
node scripts/run-migrations.js --reset
```

This will:
1. Drop all tables
2. Reapply all migrations
3. Run the seed script to populate reference data

## Production Deployment

When deploying to production:

1. Use `npx prisma migrate deploy` to apply migrations without schema modifications
2. Never use `reset` or development migrations in production
3. Always back up the database before applying migrations

## Best Practices

1. **Incremental Changes**: Make small, focused migrations
2. **Testing**: Test migrations in development/staging before production
3. **Documentation**: Document complex migrations in the migration file
4. **Performance**: Consider the impact of migrations on large tables
5. **Compatibility**: Ensure backward compatibility for rolling deployments