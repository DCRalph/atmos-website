-- One ticket link, one order.
--
-- A batch used to mint a single order and hang every ticket off it: twenty
-- links with a plus one each was one order of forty tickets. Everything an
-- order carries — its number, its ticket link, a note, a refund — was therefore
-- about the batch rather than about the person holding a link. Now each link is
-- its own order of one primary ticket plus its extras, so the batch owns many
-- orders and the foreign key moves to the order side.
--
--   psql "$DATABASE_URL" -f src/prisma/migrations/20260814010000_link_batch_order_per_link/migration.sql
--
-- Afterwards `prisma db push` is safe and should report no drift.

ALTER TABLE "ticket_order" ADD COLUMN IF NOT EXISTS "linkBatchId" TEXT;

ALTER TABLE "ticket_order"
  ADD CONSTRAINT "ticket_order_linkBatchId_fkey"
  FOREIGN KEY ("linkBatchId") REFERENCES "ticket_link_batch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ticket_order_linkBatchId_idx"
  ON "ticket_order"("linkBatchId");

-- Batches issued under the old shape keep working: their one order becomes the
-- one order of that batch. Nothing about the tickets on it changes.
UPDATE "ticket_order" o
   SET "linkBatchId" = b."id"
  FROM "ticket_link_batch" b
 WHERE b."orderId" = o."id";

-- Takes its unique index and its foreign key with it.
ALTER TABLE "ticket_link_batch" DROP COLUMN IF EXISTS "orderId";
