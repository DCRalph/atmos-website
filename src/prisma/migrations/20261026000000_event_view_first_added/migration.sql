-- When a visit first put a ticket in its basket, so the checkout journey has
-- a checkpoint between seeing the page and pressing hold and pay.
--
-- Additive, so safe to run before the code that uses it.
--
--   npx prisma db execute --file src/prisma/migrations/20261026000000_event_view_first_added/migration.sql

ALTER TABLE "ticket_event_view" ADD COLUMN IF NOT EXISTS "firstAddedAt" TIMESTAMP(3);
