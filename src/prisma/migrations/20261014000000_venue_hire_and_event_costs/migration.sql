-- Venue hire, passing it on to buyers, and an event's other costs. Additive;
-- `db push` would do the same, this is here so it can be applied before deploy.
ALTER TABLE "ticket_event" ADD COLUMN IF NOT EXISTS "venueHireCents" INTEGER;
ALTER TABLE "ticket_event" ADD COLUMN IF NOT EXISTS "passVenueHire" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ticket_order" ADD COLUMN IF NOT EXISTS "venueFeeCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ticket_event_cost" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_event_cost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ticket_event_cost_eventId_idx" ON "ticket_event_cost"("eventId");

DO $$ BEGIN
    ALTER TABLE "ticket_event_cost" ADD CONSTRAINT "ticket_event_cost_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "ticket_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
