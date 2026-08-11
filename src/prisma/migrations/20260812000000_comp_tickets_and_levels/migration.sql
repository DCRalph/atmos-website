-- Comps become minted tickets rather than tickets drawn from a tier, and every
-- ticket gains a link and a name of its own.
--
-- Nothing here rewrites an existing row: tickets already issued keep their tier,
-- are not comps, and are not name-locked, so historical comps carry on behaving
-- exactly as they did.

-- A comp belongs to no tier. The FK stays ON DELETE RESTRICT for tier-backed
-- tickets, which is still what stops a tier being deleted out from under a sale.
ALTER TABLE "ticket" ALTER COLUMN "tierId" DROP NOT NULL;

ALTER TABLE "ticket"
  ADD COLUMN "isComp"             BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "nameLockedAt"       TIMESTAMP(3),
  ADD COLUMN "hostTicketId"       TEXT,
  ADD COLUMN "invitedByName"      TEXT,
  ADD COLUMN "sentAt"             TIMESTAMP(3),
  ADD COLUMN "accessTokenVersion" INTEGER   NOT NULL DEFAULT 1;

-- A hand-out points at the comp ticket it was granted alongside. SET NULL rather
-- than CASCADE: voiding an artist's own ticket must not silently delete the
-- tickets their guests are already holding.
ALTER TABLE "ticket"
  ADD CONSTRAINT "ticket_hostTicketId_fkey"
  FOREIGN KEY ("hostTicketId") REFERENCES "ticket"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ticket_eventId_isComp_status_idx" ON "ticket"("eventId", "isComp", "status");
CREATE INDEX "ticket_hostTicketId_idx" ON "ticket"("hostTicketId");

-- A target for how many tickets this event gives away. Never enforced.
ALTER TABLE "ticket_event" ADD COLUMN "compAllowance" INTEGER;

-- Enum additions cannot run inside a transaction block, so they stand alone.
ALTER TYPE "TicketEmailType" ADD VALUE IF NOT EXISTS 'COMP';
ALTER TYPE "TicketEmailType" ADD VALUE IF NOT EXISTS 'HANDOUT';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TICKET_HANDOUT_SENT';
