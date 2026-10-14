-- Campaign run dates, and event page views. `startsAt`/`endsAt` scope a
-- campaign's results to while it ran; `ticket_event_view` is one row per
-- visit to an event's page, the top of the views → checkouts → paid funnel.
--
-- Additive, so safe to run before the code that uses it.
--
--   npx prisma db execute --file src/prisma/migrations/20261025000000_campaign_dates_and_event_views/migration.sql

ALTER TABLE "campaign" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "campaign" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ticket_event_view" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmContent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_event_view_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ticket_event_view_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ticket_event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ticket_event_view_eventId_visitId_key" ON "ticket_event_view"("eventId", "visitId");
CREATE INDEX IF NOT EXISTS "ticket_event_view_eventId_createdAt_idx" ON "ticket_event_view"("eventId", "createdAt");
