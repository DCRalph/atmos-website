-- Marking somebody out of the building.
--
-- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block that then
-- uses the value, so this is deliberately not wrapped in BEGIN/COMMIT. It is
-- additive and idempotent; nothing existing changes, and no ticket moves.
--
--   psql "$DATABASE_URL" -f prisma/manual/005-departed.sql
--
-- Afterwards `prisma db push` is safe and should report no drift.

ALTER TYPE "TicketScanResult" ADD VALUE IF NOT EXISTS 'DEPARTED';

-- Check:
--   SELECT unnest(enum_range(NULL::"TicketScanResult"));
