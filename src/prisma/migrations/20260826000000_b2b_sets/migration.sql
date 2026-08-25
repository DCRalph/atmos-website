-- Back to back sets.
--
-- A slot moves from a column on `gig_schedule_item` to its own table, because a
-- back to back is one set with two or three people in it. Modelled as two rows
-- it would announce a changeover between them and print the slot twice on the
-- public bill.
--
-- Existing rows carry across one artist each, which is what they already were.
--
--   psql "$DATABASE_URL" -f src/prisma/migrations/20260826000000_b2b_sets/migration.sql
--
-- Afterwards `prisma db push` is safe and should report no drift.

CREATE TABLE IF NOT EXISTS "gig_set_artist" (
  "id"               TEXT NOT NULL,
  "itemId"           TEXT NOT NULL,
  "creatorProfileId" TEXT NOT NULL,
  "sortOrder"        INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "gig_set_artist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gig_set_artist_itemId_creatorProfileId_key"
  ON "gig_set_artist"("itemId", "creatorProfileId");
CREATE INDEX IF NOT EXISTS "gig_set_artist_creatorProfileId_idx"
  ON "gig_set_artist"("creatorProfileId");
CREATE INDEX IF NOT EXISTS "gig_set_artist_itemId_sortOrder_idx"
  ON "gig_set_artist"("itemId", "sortOrder");

ALTER TABLE "gig_set_artist"
  DROP CONSTRAINT IF EXISTS "gig_set_artist_itemId_fkey";
ALTER TABLE "gig_set_artist"
  ADD CONSTRAINT "gig_set_artist_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "gig_schedule_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gig_set_artist"
  DROP CONSTRAINT IF EXISTS "gig_set_artist_creatorProfileId_fkey";
ALTER TABLE "gig_set_artist"
  ADD CONSTRAINT "gig_set_artist_creatorProfileId_fkey"
  FOREIGN KEY ("creatorProfileId") REFERENCES "creator_profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Every set that already had somebody in it. `gen_random_uuid()` rather than a
-- cuid because Postgres is generating these, not Prisma; the column is text
-- either way and nothing parses it.
INSERT INTO "gig_set_artist" ("id", "itemId", "creatorProfileId", "sortOrder")
SELECT gen_random_uuid()::text, "id", "creatorProfileId", 0
FROM "gig_schedule_item"
WHERE "creatorProfileId" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "gig_schedule_item"
  DROP CONSTRAINT IF EXISTS "gig_schedule_item_creatorProfileId_fkey";
DROP INDEX IF EXISTS "gig_schedule_item_creatorProfileId_idx";
ALTER TABLE "gig_schedule_item" DROP COLUMN IF EXISTS "creatorProfileId";
