-- Per-event read-only access to the organiser pages. Additive only.
--
--   npx prisma db execute --file src/prisma/migrations/20261123000000_ticket_event_viewer/migration.sql

-- CreateTable
CREATE TABLE IF NOT EXISTS "ticket_event_viewer" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_event_viewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ticket_event_viewer_userId_idx" ON "ticket_event_viewer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_event_viewer_eventId_userId_key" ON "ticket_event_viewer"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "ticket_event_viewer" DROP CONSTRAINT IF EXISTS "ticket_event_viewer_eventId_fkey";
ALTER TABLE "ticket_event_viewer" ADD CONSTRAINT "ticket_event_viewer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ticket_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_event_viewer" DROP CONSTRAINT IF EXISTS "ticket_event_viewer_userId_fkey";
ALTER TABLE "ticket_event_viewer" ADD CONSTRAINT "ticket_event_viewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
