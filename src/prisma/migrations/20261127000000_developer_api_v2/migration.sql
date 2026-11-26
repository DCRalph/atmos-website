-- Developer API v2: the update feed, which key did what in the activity log,
-- and the system user API keys act as. Additive only: apply before merging.
-- See docs/DEVELOPER-API.md.

-- AlterTable
ALTER TABLE "activity_log" ADD COLUMN "apiKeyId" TEXT;

-- CreateTable
CREATE TABLE "api_update" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "gigId" TEXT,
    "eventId" TEXT,
    "orderId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_update_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_apiKeyId_idx" ON "activity_log"("apiKeyId");

-- CreateIndex
CREATE INDEX "api_update_createdAt_idx" ON "api_update"("createdAt");

-- CreateIndex
CREATE INDEX "api_update_eventId_type_idx" ON "api_update"("eventId", "type");

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "apikey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The user every API key acts as. No account and no permission rows, so it
-- cannot sign in and appears in no staff list; the developer API grants it
-- admin for the length of a request. See `~/server/developer-api/caller.ts`.
INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
VALUES ('developer-api', 'Developer API', 'developer-api@system.invalid', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
