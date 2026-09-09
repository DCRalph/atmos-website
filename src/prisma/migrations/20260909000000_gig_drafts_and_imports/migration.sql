-- Draft gigs, and a record of where an imported one came from.
--
-- A gig gains a status. Every existing gig is `PUBLISHED`, which is what they
-- already were, so nothing moves off the site when this runs. Only the import
-- wizard creates drafts.
--
-- `gig_import` keeps the post that was read and the structured reading of it,
-- so a field can still say where its value came from after the gig is live.
--
--   psql "$DATABASE_URL" -f src/prisma/migrations/20260909000000_gig_drafts_and_imports/migration.sql
--
-- Afterwards `prisma db push` is safe and should report no drift.

DO $$ BEGIN
  CREATE TYPE "GigStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GigImportSource" AS ENUM ('INSTAGRAM', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The default is what makes this safe to run on a live database: every row
-- already there becomes PUBLISHED without a backfill.
ALTER TABLE "gig"
  ADD COLUMN IF NOT EXISTS "status" "GigStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "gig"
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Gigs that predate this have no record of going live; their creation time is
-- the closest true answer and keeps the column meaningful.
UPDATE "gig" SET "publishedAt" = "createdAt"
WHERE "publishedAt" IS NULL AND "status" = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS "gig_status_gigStartTime_idx"
  ON "gig"("status", "gigStartTime");

CREATE TABLE IF NOT EXISTS "gig_import" (
  "id"          TEXT NOT NULL,
  "source"      "GigImportSource" NOT NULL,
  "sourceUrl"   TEXT,
  "raw"         JSONB NOT NULL,
  "extraction"  JSONB NOT NULL,
  "model"       TEXT NOT NULL,
  "gigId"       TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "gig_import_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "gig_import_gigId_idx"
  ON "gig_import"("gigId");
CREATE INDEX IF NOT EXISTS "gig_import_createdById_createdAt_idx"
  ON "gig_import"("createdById", "createdAt");

-- SET NULL, not CASCADE: discarding the draft should leave the record of what
-- was read, which is the only way to tell a bad extraction from a bad post.
ALTER TABLE "gig_import"
  DROP CONSTRAINT IF EXISTS "gig_import_gigId_fkey";
ALTER TABLE "gig_import"
  ADD CONSTRAINT "gig_import_gigId_fkey"
  FOREIGN KEY ("gigId") REFERENCES "gig"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GIG_IMPORTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GIG_PUBLISHED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GIG_UNPUBLISHED';
