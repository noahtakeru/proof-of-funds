-- AlterTable
ALTER TABLE "users" ADD COLUMN "email" TEXT,
                    ADD COLUMN "password_hash" TEXT,
                    ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
                    ADD COLUMN "email_verify_token" TEXT,
                    ADD COLUMN "token_expiry" TIMESTAMP(3),
                    ALTER COLUMN "address" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");