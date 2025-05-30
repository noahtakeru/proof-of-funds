-- Add comprehensive indexes for performance optimization

-- User indexes
CREATE INDEX IF NOT EXISTS "idx_users_address_hash" ON "users" USING hash ("address");
CREATE INDEX IF NOT EXISTS "idx_users_created_at" ON "users" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_users_last_login" ON "users" ("last_login_at");
CREATE INDEX IF NOT EXISTS "idx_users_permissions" ON "users" USING GIN ("permissions");

-- Wallet indexes
CREATE INDEX IF NOT EXISTS "idx_wallets_chain_id" ON "wallets" ("chain_id");
CREATE INDEX IF NOT EXISTS "idx_wallets_last_used" ON "wallets" ("last_used_at");
CREATE INDEX IF NOT EXISTS "idx_wallets_address_type" ON "wallets" ("address", "type");

-- Proof indexes
CREATE INDEX IF NOT EXISTS "idx_proofs_created_at" ON "proofs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_proofs_reference_id_hash" ON "proofs" USING hash ("reference_id");
CREATE INDEX IF NOT EXISTS "idx_proofs_temp_wallet_id" ON "proofs" ("temp_wallet_id");
CREATE INDEX IF NOT EXISTS "idx_proofs_warning_flags" ON "proofs" USING GIN ("warning_flags");
CREATE INDEX IF NOT EXISTS "idx_proofs_original_wallets" ON "proofs" USING GIN ("original_wallets");
CREATE INDEX IF NOT EXISTS "idx_proofs_status_expires" ON "proofs" ("status", "expires_at");
CREATE INDEX IF NOT EXISTS "idx_proofs_batch_id" ON "proofs" ("batch_id");

-- Verification indexes
CREATE INDEX IF NOT EXISTS "idx_verifications_verified_at" ON "verifications" ("verified_at");
CREATE INDEX IF NOT EXISTS "idx_verifications_reference_id" ON "verifications" ("reference_id");
CREATE INDEX IF NOT EXISTS "idx_verifications_success" ON "verifications" ("is_successful");
CREATE INDEX IF NOT EXISTS "idx_verifications_verifier" ON "verifications" ("verifier_address");

-- Batch indexes
CREATE INDEX IF NOT EXISTS "idx_batches_created_at" ON "batches" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_batches_processed_at" ON "batches" ("processed_at");
CREATE INDEX IF NOT EXISTS "idx_batches_tx_hash" ON "batches" ("transaction_hash");
CREATE INDEX IF NOT EXISTS "idx_batches_temp_wallet" ON "batches" ("temp_wallet_id");
CREATE INDEX IF NOT EXISTS "idx_batches_status_created" ON "batches" ("status", "created_at");

-- Organization indexes
CREATE INDEX IF NOT EXISTS "idx_organizations_name" ON "organizations" ("name");
CREATE INDEX IF NOT EXISTS "idx_organizations_created_at" ON "organizations" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_organizations_api_key_hash" ON "organizations" USING hash ("api_key");

-- OrganizationUser indexes
CREATE INDEX IF NOT EXISTS "idx_org_users_role" ON "organization_users" ("role");
CREATE INDEX IF NOT EXISTS "idx_org_users_joined" ON "organization_users" ("joined_at");

-- ProofTemplate indexes
CREATE INDEX IF NOT EXISTS "idx_templates_name" ON "proof_templates" ("name");
CREATE INDEX IF NOT EXISTS "idx_templates_type" ON "proof_templates" ("proof_type");
CREATE INDEX IF NOT EXISTS "idx_templates_active" ON "proof_templates" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_templates_org_type" ON "proof_templates" ("organization_id", "proof_type");

-- AuditLog indexes
CREATE INDEX IF NOT EXISTS "idx_audit_entity_type" ON "audit_logs" ("entity_type");
CREATE INDEX IF NOT EXISTS "idx_audit_entity_id" ON "audit_logs" ("entity_id");
CREATE INDEX IF NOT EXISTS "idx_audit_ip" ON "audit_logs" ("ip_address");
CREATE INDEX IF NOT EXISTS "idx_audit_timestamp_action" ON "audit_logs" ("timestamp", "action");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_proofs_user_status_type" ON "proofs" ("user_id", "status", "proof_type");
CREATE INDEX IF NOT EXISTS "idx_wallets_user_chain_type" ON "wallets" ("user_id", "chain_id", "type");
CREATE INDEX IF NOT EXISTS "idx_verifications_proof_success" ON "verifications" ("proof_id", "is_successful");