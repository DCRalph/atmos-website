-- Admin-issued batches of unnamed ticket links drawn from a tier.
--
-- Distinct from comps: these consume allocation and capacity. Enum additions
-- stand first so the rest of the migration can sit in a transaction on PG 12+.

ALTER TYPE "PaymentMethodKind" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TICKET_LINK_BATCH_CREATED';

CREATE TABLE "ticket_link_batch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "label" TEXT,
    "primaryCount" INTEGER NOT NULL,
    "plusCount" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_link_batch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_link_batch_orderId_key" ON "ticket_link_batch"("orderId");
CREATE INDEX "ticket_link_batch_eventId_createdAt_idx" ON "ticket_link_batch"("eventId", "createdAt");

ALTER TABLE "ticket_link_batch"
  ADD CONSTRAINT "ticket_link_batch_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ticket_event"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_link_batch"
  ADD CONSTRAINT "ticket_link_batch_tierId_fkey"
  FOREIGN KEY ("tierId") REFERENCES "ticket_tier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_link_batch"
  ADD CONSTRAINT "ticket_link_batch_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "ticket_order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket" ADD COLUMN "linkBatchId" TEXT;

ALTER TABLE "ticket"
  ADD CONSTRAINT "ticket_linkBatchId_fkey"
  FOREIGN KEY ("linkBatchId") REFERENCES "ticket_link_batch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ticket_linkBatchId_idx" ON "ticket"("linkBatchId");
