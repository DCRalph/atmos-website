-- Two new scan results: taking back a refusal, and a note.
--
-- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block that then
-- uses the value, so these are deliberately not wrapped in BEGIN/COMMIT. Both
-- are additive and idempotent; nothing existing changes.
--
--   psql "$DATABASE_URL" -f prisma/manual/004-scan-results.sql

ALTER TYPE "TicketScanResult" ADD VALUE IF NOT EXISTS 'DENIAL_REVERTED';
ALTER TYPE "TicketScanResult" ADD VALUE IF NOT EXISTS 'NOTE';

-- Check:
--   SELECT unnest(enum_range(NULL::"TicketScanResult"));
