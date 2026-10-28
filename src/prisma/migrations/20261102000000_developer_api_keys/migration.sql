-- API keys for the developer API (better-auth's api-key plugin), and which key
-- sent each notification. Additive only: apply before merging.
-- See docs/DEVELOPER-API.md.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'API_KEY_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'API_KEY_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'API_KEY_DELETED';

-- AlterTable
ALTER TABLE "notify_message" ADD COLUMN     "apiKeyId" TEXT,
ADD COLUMN     "recipients" JSONB;

-- CreateTable
CREATE TABLE "apikey" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "start" TEXT,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastRequest" TIMESTAMP(3),
    "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitTimeWindow" INTEGER,
    "rateLimitMax" INTEGER,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "refillInterval" INTEGER,
    "refillAmount" INTEGER,
    "lastRefillAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apikey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apikey_configId_idx" ON "apikey"("configId");

-- CreateIndex
CREATE INDEX "apikey_referenceId_idx" ON "apikey"("referenceId");

-- CreateIndex
CREATE INDEX "apikey_key_idx" ON "apikey"("key");

-- CreateIndex
CREATE INDEX "notify_message_apiKeyId_idx" ON "notify_message"("apiKeyId");

-- AddForeignKey
ALTER TABLE "notify_message" ADD CONSTRAINT "notify_message_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "apikey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

