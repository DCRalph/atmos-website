-- No-login share links for one event's read-only organiser pages. Additive only.
--
--   npx prisma db execute --file src/prisma/migrations/20261123000001_ticket_event_share_link/migration.sql

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_event_share_link" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_event_share_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_event_share_link_token_key" ON "ticket_event_share_link"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_event_share_link_eventId_idx" ON "ticket_event_share_link"("eventId");

-- AddForeignKey
ALTER TABLE "ticket_event_share_link" DROP CONSTRAINT IF EXISTS "ticket_event_share_link_eventId_fkey";
ALTER TABLE "ticket_event_share_link" ADD CONSTRAINT "ticket_event_share_link_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ticket_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
