/**
 * Database Structure Tests
 * 
 * These tests verify the structure of the database models and migration files
 * without requiring an active database connection.
 */
const fs = require('fs');
const path = require('path');

describe('Database Structure', () => {
  describe('Migration Files', () => {
    const migrationsPath = path.join(__dirname, '../prisma/migrations');
    
    it('should have migration folders in the correct format', () => {
      // Skip if migrations directory doesn't exist
      if (!fs.existsSync(migrationsPath)) {
        console.warn('Migrations directory not found, skipping test');
        return;
      }
      
      // Get migration directories
      const migrationDirs = fs.readdirSync(migrationsPath)
        .filter(dir => dir !== 'migration_lock.toml' && !dir.startsWith('.'));
      
      // Verify we have migration directories
      expect(migrationDirs.length).toBeGreaterThan(0);
      
      // Check migration directory naming convention
      migrationDirs.forEach(dir => {
        // Should be in format YYYYMMDDHHMMSS_name
        expect(dir).toMatch(/^\d{14}_[a-z0-9_]+$/);
        
        // Should have a migration.sql file
        const migrationFile = path.join(migrationsPath, dir, 'migration.sql');
        expect(fs.existsSync(migrationFile)).toBe(true);
        
        // Migration file should not be empty
        const content = fs.readFileSync(migrationFile, 'utf8');
        expect(content.length).toBeGreaterThan(0);
      });
    });
    
    it('should have a migration_lock.toml file', () => {
      const lockFile = path.join(migrationsPath, 'migration_lock.toml');
      expect(fs.existsSync(lockFile)).toBe(true);
      
      const content = fs.readFileSync(lockFile, 'utf8');
      expect(content).toContain('provider = "postgresql"');
    });
  });
  
  describe('Prisma Schema', () => {
    it('should have a valid schema.prisma file', () => {
      const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
      expect(fs.existsSync(schemaPath)).toBe(true);
      
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Check for required model definitions
      expect(schema).toContain('model User {');
      expect(schema).toContain('model Wallet {');
      expect(schema).toContain('model Proof {');
      expect(schema).toContain('model Verification {');
      expect(schema).toContain('model Batch {');
      expect(schema).toContain('model Organization {');
      expect(schema).toContain('model ProofTemplate {');
      
      // Check for required enums
      expect(schema).toContain('enum WalletType {');
      expect(schema).toContain('enum ProofType {');
      expect(schema).toContain('enum ProofStatus {');
      expect(schema).toContain('enum BatchStatus {');
      expect(schema).toContain('enum OrgRole {');
      
      // Check for relations
      expect(schema).toContain('@relation(');
    });
  });
  
  describe('Database Scripts', () => {
    it('should have required database scripts', () => {
      // Check for init-db.js
      const initDbPath = path.join(__dirname, '../scripts/init-db.js');
      expect(fs.existsSync(initDbPath)).toBe(true);
      
      // Check for run-migrations.js
      const migrationsPath = path.join(__dirname, '../scripts/run-migrations.js');
      expect(fs.existsSync(migrationsPath)).toBe(true);
    });
  });
});