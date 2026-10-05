-- Gig mode becomes two independent flags, so a gig can be both to be
-- announced and affiliated.
--
-- Run this before `prisma db push`: push would drop `mode` and lose which gigs
-- were TBA or affiliated. The copy and the drop are one transaction.
--
--   psql "$DATABASE_URL" -f prisma/manual/006-gig-mode-flags.sql
--
-- Afterwards `prisma db push` is safe and should report no drift.

BEGIN;

ALTER TABLE "gig" ADD COLUMN IF NOT EXISTS "isTba" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gig" ADD COLUMN IF NOT EXISTS "isAffiliated" BOOLEAN NOT NULL DEFAULT false;

UPDATE "gig" SET "isTba" = true WHERE "mode" = 'TO_BE_ANNOUNCED';
UPDATE "gig" SET "isAffiliated" = true WHERE "mode" = 'AFFILIATED';

ALTER TABLE "gig" DROP COLUMN "mode";
DROP TYPE "GigMode";

COMMIT;

-- Check:
--   SELECT "isTba", "isAffiliated", count(*) FROM "gig" GROUP BY 1, 2;
