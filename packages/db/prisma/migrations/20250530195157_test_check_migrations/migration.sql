-- DropForeignKey
ALTER TABLE "organization_users" DROP CONSTRAINT "organization_users_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_users" DROP CONSTRAINT "organization_users_user_id_fkey";

-- DropForeignKey
ALTER TABLE "proof_templates" DROP CONSTRAINT "proof_templates_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "proofs" DROP CONSTRAINT "proofs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "verifications" DROP CONSTRAINT "verifications_proof_id_fkey";

-- DropForeignKey
ALTER TABLE "wallets" DROP CONSTRAINT "wallets_user_id_fkey";

-- DropIndex
DROP INDEX "idx_audit_entity_id";

-- DropIndex
DROP INDEX "idx_audit_entity_type";

-- DropIndex
DROP INDEX "idx_audit_ip";

-- DropIndex
DROP INDEX "idx_audit_logs_action";

-- DropIndex
DROP INDEX "idx_audit_logs_timestamp";

-- DropIndex
DROP INDEX "idx_audit_logs_user_id";

-- DropIndex
DROP INDEX "idx_audit_timestamp_action";

-- DropIndex
DROP INDEX "idx_batches_processed_at";

-- DropIndex
DROP INDEX "idx_batches_retry_count";

-- DropIndex
DROP INDEX "idx_batches_status_created";

-- DropIndex
DROP INDEX "idx_batches_temp_wallet";

-- DropIndex
DROP INDEX "idx_batches_tx_hash";

-- DropIndex
DROP INDEX "idx_org_users_joined";

-- DropIndex
DROP INDEX "idx_org_users_org_id";

-- DropIndex
DROP INDEX "idx_org_users_role";

-- DropIndex
DROP INDEX "idx_org_users_user_id";

-- DropIndex
DROP INDEX "idx_org_settings_jsonb";

-- DropIndex
DROP INDEX "idx_organizations_api_key_hash";

-- DropIndex
DROP INDEX "idx_template_org_relation";

-- DropIndex
DROP INDEX "idx_templates_org_type";

-- DropIndex
DROP INDEX "idx_proofs_batch_id";

-- DropIndex
DROP INDEX "idx_proofs_original_wallets";

-- DropIndex
DROP INDEX "idx_proofs_reference_id_hash";

-- DropIndex
DROP INDEX "idx_proofs_status_expires";

-- DropIndex
DROP INDEX "idx_proofs_temp_wallet_id";

-- DropIndex
DROP INDEX "idx_proofs_user_status_type";

-- DropIndex
DROP INDEX "idx_proofs_warning_flags";

-- DropIndex
DROP INDEX "idx_users_address_hash";

-- DropIndex
DROP INDEX "idx_users_last_login";

-- DropIndex
DROP INDEX "idx_users_permissions";

-- DropIndex
DROP INDEX "idx_verifications_proof_success";

-- DropIndex
DROP INDEX "idx_verifications_reference_id";

-- DropIndex
DROP INDEX "idx_verifications_verifier";

-- DropIndex
DROP INDEX "idx_user_wallet_type_relation";

-- DropIndex
DROP INDEX "idx_wallets_address";

-- DropIndex
DROP INDEX "idx_wallets_address_type";

-- DropIndex
DROP INDEX "idx_wallets_chain_id";

-- DropIndex
DROP INDEX "idx_wallets_last_used";

-- DropIndex
DROP INDEX "idx_wallets_type";

-- DropIndex
DROP INDEX "idx_wallets_user_chain_type";

-- DropIndex
DROP INDEX "idx_wallets_user_id";

-- AlterTable
ALTER TABLE "proof_templates" ALTER COLUMN "min_verification_interval" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proofs" ADD CONSTRAINT "proofs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_proof_id_fkey" FOREIGN KEY ("proof_id") REFERENCES "proofs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_templates" ADD CONSTRAINT "proof_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
