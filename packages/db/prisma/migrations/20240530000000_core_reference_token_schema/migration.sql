-- Core Database Schema Enhancements for Phase 1.2
-- This migration adds essential fields to existing Organization and ProofTemplate models
-- and creates additional performance indexes.

-- Enhancement for Organization model
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_phone" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Enhancement for ProofTemplate model
ALTER TABLE "proof_templates" ADD COLUMN IF NOT EXISTS "category_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "proof_templates" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "proof_templates" ADD COLUMN IF NOT EXISTS "min_verification_interval" INTEGER DEFAULT 3600; -- Default 1 hour in seconds

-- Additional indexes for performance optimization
-- Organization indexes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_organizations_name'
    ) THEN
        CREATE INDEX "idx_organizations_name" ON "organizations"("name");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_organizations_created_at'
    ) THEN
        CREATE INDEX "idx_organizations_created_at" ON "organizations"("created_at");
    END IF;
END $$;

-- ProofTemplate indexes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proof_templates_name'
    ) THEN
        CREATE INDEX "idx_proof_templates_name" ON "proof_templates"("name");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proof_templates_proof_type'
    ) THEN
        CREATE INDEX "idx_proof_templates_proof_type" ON "proof_templates"("proof_type");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proof_templates_is_active'
    ) THEN
        CREATE INDEX "idx_proof_templates_is_active" ON "proof_templates"("is_active");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proof_templates_is_public'
    ) THEN
        CREATE INDEX "idx_proof_templates_is_public" ON "proof_templates"("is_public");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proof_templates_created_at'
    ) THEN
        CREATE INDEX "idx_proof_templates_created_at" ON "proof_templates"("created_at");
    END IF;
END $$;

-- Proof indexes (additional)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proofs_created_at'
    ) THEN
        CREATE INDEX "idx_proofs_created_at" ON "proofs"("created_at");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proofs_is_revoked'
    ) THEN
        CREATE INDEX "idx_proofs_is_revoked" ON "proofs"("is_revoked");
    END IF;
END $$;

-- Verification performance indexes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_verifications_verified_at'
    ) THEN
        CREATE INDEX "idx_verifications_verified_at" ON "verifications"("verified_at");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_verifications_is_successful'
    ) THEN
        CREATE INDEX "idx_verifications_is_successful" ON "verifications"("is_successful");
    END IF;
END $$;

-- Batch indexes for query optimization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_batches_created_at'
    ) THEN
        CREATE INDEX "idx_batches_created_at" ON "batches"("created_at");
    END IF;
END $$;

-- User indexes for faster lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_is_active'
    ) THEN
        CREATE INDEX "idx_users_is_active" ON "users"("is_active");
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_created_at'
    ) THEN
        CREATE INDEX "idx_users_created_at" ON "users"("created_at");
    END IF;
END $$;