-- Access levels: enum -> editable table.
--
-- Run this INSTEAD OF `prisma db push` for this change. Push would try to
-- create the foreign keys before `AccessLevel` has any rows, and every existing
-- ticket references a code that would not yet exist, so the constraint fails
-- and you are left half-migrated.
--
-- The seeded codes are the old enum's values exactly, so step 3 is an identity
-- mapping: no ticket changes value, and nothing needs backfilling. The whole
-- thing is one transaction — it either lands or it does not.
--
--   psql "$DATABASE_URL" -f prisma/manual/001-access-levels.sql
--
-- Afterwards `prisma db push` is safe again and should report no drift.

BEGIN;

-- 1. The table.
CREATE TABLE IF NOT EXISTS "AccessLevel" (
  "code"       TEXT PRIMARY KEY,
  "label"      TEXT NOT NULL,
  "short"      TEXT NOT NULL,
  "tone"       TEXT NOT NULL DEFAULT 'bg-white text-black',
  "passAccent" TEXT,
  "rank"       INTEGER NOT NULL DEFAULT 0,
  "archived"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AccessLevel_archived_rank_idx"
  ON "AccessLevel" ("archived", "rank");

-- 2. Seed with the retired enum's values, byte for byte.
INSERT INTO "AccessLevel"
  ("code", "label", "short", "tone", "passAccent", "rank", "updatedAt")
VALUES
  ('GENERAL', 'General',          'GA',     'bg-white text-black',           NULL,      0, NOW()),
  ('GUEST',   'Guest list',       'GUEST',  'bg-sky-300 text-sky-950',       '#7DD3FC', 1, NOW()),
  ('VIP',     'VIP',              'VIP',    'bg-violet-300 text-violet-950', '#C4B5FD', 2, NOW()),
  ('ARTIST',  'Artist',           'ARTIST', 'bg-amber-300 text-amber-950',   '#FCD34D', 3, NOW()),
  ('CREW',    'Crew',             'CREW',   'bg-teal-300 text-teal-950',     '#5EEAD4', 4, NOW()),
  ('AAA',     'Access all areas', 'AAA',    'bg-fuchsia-300 text-fuchsia-950', '#F0ABFC', 5, NOW())
ON CONFLICT ("code") DO NOTHING;

-- 3. Enum -> text. `::TEXT` on a Postgres enum yields the label, so every row
--    keeps the exact value it had. The default is dropped first because it is
--    typed against the enum and would block the cast.
ALTER TABLE "Ticket"     ALTER COLUMN "accessLevel" DROP DEFAULT;
ALTER TABLE "Ticket"     ALTER COLUMN "accessLevel" TYPE TEXT USING "accessLevel"::TEXT;
ALTER TABLE "Ticket"     ALTER COLUMN "accessLevel" SET DEFAULT 'GENERAL';

ALTER TABLE "TicketTier" ALTER COLUMN "accessLevel" DROP DEFAULT;
ALTER TABLE "TicketTier" ALTER COLUMN "accessLevel" TYPE TEXT USING "accessLevel"::TEXT;
ALTER TABLE "TicketTier" ALTER COLUMN "accessLevel" SET DEFAULT 'GENERAL';

-- 4. Referential integrity, now that every value has a row to point at.
--    RESTRICT on delete is deliberate: a level that tickets were issued against
--    must be archived rather than deleted, or history stops resolving.
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_accessLevel_fkey"
  FOREIGN KEY ("accessLevel") REFERENCES "AccessLevel" ("code")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "TicketTier"
  ADD CONSTRAINT "TicketTier_accessLevel_fkey"
  FOREIGN KEY ("accessLevel") REFERENCES "AccessLevel" ("code")
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 5. The enum type is now unreferenced. Left in place deliberately: dropping it
--    is the one irreversible step here, and it costs nothing to keep until the
--    new table has been running for a while.
--    When you are ready:  DROP TYPE "TicketAccessLevel";

COMMIT;

-- Sanity check, safe to run after:
--   SELECT "accessLevel", COUNT(*) FROM "Ticket" GROUP BY 1 ORDER BY 2 DESC;
