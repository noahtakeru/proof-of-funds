-- CreateTable
CREATE TABLE "wallet_auth_logs" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "wallet_address" TEXT NOT NULL,
  "chain_id" INTEGER,
  "nonce" TEXT NOT NULL,
  "signature" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "auth_result" TEXT NOT NULL,
  "failure_reason" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "wallet_auth_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_wallet_auth_logs_user_id" ON "wallet_auth_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_wallet_auth_logs_wallet_address" ON "wallet_auth_logs"("wallet_address");

-- CreateIndex
CREATE INDEX "idx_wallet_auth_logs_auth_result" ON "wallet_auth_logs"("auth_result");

-- CreateIndex
CREATE INDEX "idx_wallet_auth_logs_timestamp" ON "wallet_auth_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "wallet_auth_logs" ADD CONSTRAINT "wallet_auth_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;