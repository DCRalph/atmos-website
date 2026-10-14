-- Campaigns: tagged links with a spend, and the order columns that measure
-- them. `utmContent` tells two versions of one post apart; `visitId` makes a
-- buyer who changes their basket count as one checkout.
--
-- Additive, so safe to run before the code that uses it.
--
--   npx prisma db execute --file src/prisma/migrations/20261024000000_campaigns/migration.sql

ALTER TABLE "ticket_order" ADD COLUMN IF NOT EXISTS "utmContent" TEXT;
ALTER TABLE "ticket_order" ADD COLUMN IF NOT EXISTS "visitId" TEXT;

CREATE TABLE IF NOT EXISTS "campaign" (
  "id" TEXT NOT NULL,
  "eventId" TEXT,
  "source" TEXT NOT NULL,
  "medium" TEXT,
  "name" TEXT NOT NULL,
  "content" TEXT,
  "destination" TEXT NOT NULL,
  "spendCents" INTEGER NOT NULL DEFAULT 0,
  "shortLinkId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ticket_event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "campaign_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "short_link"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_shortLinkId_key" ON "campaign"("shortLinkId");
CREATE INDEX IF NOT EXISTS "campaign_eventId_idx" ON "campaign"("eventId");
CREATE INDEX IF NOT EXISTS "campaign_source_name_idx" ON "campaign"("source", "name");
