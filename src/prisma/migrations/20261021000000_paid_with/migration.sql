-- How each Stripe payment was made: Apple Pay, Google Pay, Link, card.
--
-- Additive and nullable, so safe to run before the code that writes it.
--
--   npx prisma db execute --file src/prisma/migrations/20261021000000_paid_with/migration.sql
--
-- Then fill in existing payments from Stripe with `bun run db:backfill-paid-with`.

ALTER TABLE "ticket_order" ADD COLUMN IF NOT EXISTS "paidWith" TEXT;
ALTER TABLE "donation" ADD COLUMN IF NOT EXISTS "paidWith" TEXT;
