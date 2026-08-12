-- Finish the access-level migration after a `prisma db push`.
--
-- Push created the level table and converted `ticket.accessLevel` and
-- `ticket_tier.accessLevel` from the enum to text, but it cannot seed a table,
-- and it skipped the foreign keys — an empty level table cannot satisfy them
-- while tickets already reference `GENERAL`.
--
-- Note the naming: every table in this schema is snake_case via Prisma's
-- `@@map`, while columns stay camelCase. The level model was added without a
-- `@@map`, so push created it as "AccessLevel" — the only PascalCase table in
-- the database. Step 0 renames it into line before anything points at it.
--
-- Additive only: it renames one empty table, inserts six rows, and adds two
-- constraints. It deletes nothing and rewrites no ticket.
--
--   psql "$DATABASE_URL" -f prisma/manual/002-access-levels-finish.sql

BEGIN;

-- 0. Bring the table into the schema's naming convention. Empty at this point,
--    so the rename is free.
ALTER TABLE IF EXISTS "AccessLevel" RENAME TO access_level;
ALTER INDEX IF EXISTS "AccessLevel_archived_rank_idx"
  RENAME TO access_level_archived_rank_idx;

-- Belt and braces for a database where push never ran at all.
CREATE TABLE IF NOT EXISTS access_level (
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
CREATE INDEX IF NOT EXISTS access_level_archived_rank_idx
  ON access_level ("archived", "rank");

-- 1. The levels the retired enum used to hold, codes unchanged so every
--    existing ticket resolves the moment this lands.
INSERT INTO access_level
  ("code", "label", "short", "tone", "passAccent", "rank", "updatedAt")
VALUES
  ('GENERAL', 'General',          'GA',     'bg-white text-black',             NULL,      0, NOW()),
  ('GUEST',   'Guest list',       'GUEST',  'bg-sky-300 text-sky-950',         '#7DD3FC', 1, NOW()),
  ('VIP',     'VIP',              'VIP',    'bg-violet-300 text-violet-950',   '#C4B5FD', 2, NOW()),
  ('ARTIST',  'Artist',           'ARTIST', 'bg-amber-300 text-amber-950',     '#FCD34D', 3, NOW()),
  ('CREW',    'Crew',             'CREW',   'bg-teal-300 text-teal-950',       '#5EEAD4', 4, NOW()),
  ('AAA',     'Access all areas', 'AAA',    'bg-fuchsia-300 text-fuchsia-950', '#F0ABFC', 5, NOW())
ON CONFLICT ("code") DO NOTHING;

-- 2. Cover any code in use that the seed does not, so step 3 cannot fail. On a
--    database where every ticket is GENERAL this inserts nothing.
INSERT INTO access_level ("code", "label", "short", "rank", "updatedAt")
SELECT DISTINCT t."accessLevel", t."accessLevel", LEFT(t."accessLevel", 6), 0, NOW()
FROM ticket t
WHERE NOT EXISTS (SELECT 1 FROM access_level a WHERE a."code" = t."accessLevel")
ON CONFLICT ("code") DO NOTHING;

INSERT INTO access_level ("code", "label", "short", "rank", "updatedAt")
SELECT DISTINCT tt."accessLevel", tt."accessLevel", LEFT(tt."accessLevel", 6), 0, NOW()
FROM ticket_tier tt
WHERE NOT EXISTS (SELECT 1 FROM access_level a WHERE a."code" = tt."accessLevel")
ON CONFLICT ("code") DO NOTHING;

-- 3. Referential integrity. RESTRICT on delete is deliberate: a level tickets
--    were issued against must be archived, not deleted, or history stops
--    resolving.
ALTER TABLE ticket DROP CONSTRAINT IF EXISTS "ticket_accessLevel_fkey";
ALTER TABLE ticket
  ADD CONSTRAINT "ticket_accessLevel_fkey"
  FOREIGN KEY ("accessLevel") REFERENCES access_level ("code")
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ticket_tier DROP CONSTRAINT IF EXISTS "ticket_tier_accessLevel_fkey";
ALTER TABLE ticket_tier
  ADD CONSTRAINT "ticket_tier_accessLevel_fkey"
  FOREIGN KEY ("accessLevel") REFERENCES access_level ("code")
  ON UPDATE CASCADE ON DELETE RESTRICT;

COMMIT;

-- Check:
--   SELECT code, label, rank FROM access_level ORDER BY rank;
--   SELECT "accessLevel", COUNT(*) FROM ticket GROUP BY 1;
