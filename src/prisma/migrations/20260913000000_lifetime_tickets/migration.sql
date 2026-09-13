-- Lifetime passes: one named person, every Atmos event.
--
-- A pass is its own row with its own signed QR. The first scan at an event
-- mints an ordinary ticket for that event and links it back here, so the door
-- and the headcount never learn a second set of rules. Enum additions stand
-- first so the rest can sit in a transaction on PG 12+.

ALTER TYPE "PaymentMethodKind" ADD VALUE IF NOT EXISTS 'LIFETIME';
ALTER TYPE "TicketEmailType" ADD VALUE IF NOT EXISTS 'LIFETIME';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'LIFETIME_TICKET_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'LIFETIME_TICKET_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'LIFETIME_TICKET_REVOKED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'LIFETIME_TICKET_DELETED';

CREATE TYPE "LifetimeTicketStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "lifetime_ticket" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "holderEmail" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'GENERAL',
    "notes" TEXT,
    "status" "LifetimeTicketStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "qrSecret" TEXT NOT NULL,
    "qrVersion" INTEGER NOT NULL DEFAULT 1,
    "accessTokenVersion" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lifetime_ticket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lifetime_ticket_number_key" ON "lifetime_ticket"("number");
CREATE INDEX "lifetime_ticket_status_createdAt_idx" ON "lifetime_ticket"("status", "createdAt");

ALTER TABLE "lifetime_ticket"
  ADD CONSTRAINT "lifetime_ticket_accessLevel_fkey"
  FOREIGN KEY ("accessLevel") REFERENCES "access_level"("code")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The per-event ticket a pass minted. SET NULL rather than CASCADE: deleting a
-- pass must not take a night's admission record with it.
ALTER TABLE "ticket" ADD COLUMN "lifetimeTicketId" TEXT;

ALTER TABLE "ticket"
  ADD CONSTRAINT "ticket_lifetimeTicketId_fkey"
  FOREIGN KEY ("lifetimeTicketId") REFERENCES "lifetime_ticket"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- One ticket per pass per event. NULLs are distinct, so ordinary tickets are
-- untouched by this.
CREATE UNIQUE INDEX "ticket_lifetimeTicketId_eventId_key" ON "ticket"("lifetimeTicketId", "eventId");
