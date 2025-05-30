-- Add additional foreign key indexes for better join performance

-- Additional indexes for foreign keys that might not be automatically indexed
CREATE INDEX IF NOT EXISTS "idx_batch_proof_relation" ON "proofs" ("batch_id") WHERE "batch_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_verification_proof_relation" ON "verifications" ("proof_id");
CREATE INDEX IF NOT EXISTS "idx_template_org_relation" ON "proof_templates" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_user_wallet_type_relation" ON "wallets" ("user_id", "type");

-- Partial indexes for specific queries
CREATE INDEX IF NOT EXISTS "idx_active_proofs" ON "proofs" ("user_id", "status") WHERE "status" = 'CONFIRMED' AND "is_revoked" = false;
CREATE INDEX IF NOT EXISTS "idx_pending_batches" ON "batches" ("status", "created_at") WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS "idx_temporary_wallets" ON "wallets" ("type", "created_at") WHERE "type" = 'TEMPORARY';
CREATE INDEX IF NOT EXISTS "idx_pending_proofs" ON "proofs" ("status", "created_at") WHERE "status" = 'PENDING';

-- Add B-tree indexes for range queries
CREATE INDEX IF NOT EXISTS "idx_proofs_expires_range" ON "proofs" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "idx_wallets_balance_range" ON "wallets" USING btree (("balance"::numeric)) WHERE "balance" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_batches_retry_count" ON "batches" USING btree ("retry_count");

-- Indexes for full text search if needed
CREATE INDEX IF NOT EXISTS "idx_templates_description_text" ON "proof_templates" USING gin (to_tsvector('english', "description")) WHERE "description" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_audit_metadata_jsonb" ON "audit_logs" USING gin ("metadata") WHERE "metadata" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_org_settings_jsonb" ON "organizations" USING gin ("settings");

-- Create extension for more advanced indexing if not exists
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_trgm;