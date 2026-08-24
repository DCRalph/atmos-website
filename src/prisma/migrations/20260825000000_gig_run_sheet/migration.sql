-- The gig run sheet.
--
-- `gig_creator` becomes `gig_schedule_item`: a rename rather than a new table,
-- so every existing line-up row survives untouched and arrives as a `SET` with
-- no times, which is what it already was. The unique constraint on
-- (gigId, creatorProfileId) is dropped on purpose — an artist opening and
-- closing the same night is two rows, and the public line-up de-duplicates.
--
--   psql "$DATABASE_URL" -f src/prisma/migrations/20260825000000_gig_run_sheet/migration.sql
--
-- Afterwards `prisma db push` is safe and should report no drift.

ALTER TABLE "gig_creator" RENAME TO "gig_schedule_item";

ALTER TABLE "gig_schedule_item" RENAME CONSTRAINT "gig_creator_pkey" TO "gig_schedule_item_pkey";
ALTER TABLE "gig_schedule_item" RENAME CONSTRAINT "gig_creator_gigId_fkey" TO "gig_schedule_item_gigId_fkey";
ALTER TABLE "gig_schedule_item" RENAME CONSTRAINT "gig_creator_creatorProfileId_fkey" TO "gig_schedule_item_creatorProfileId_fkey";

ALTER INDEX IF EXISTS "gig_creator_creatorProfileId_idx" RENAME TO "gig_schedule_item_creatorProfileId_idx";
ALTER INDEX IF EXISTS "gig_creator_gigId_sortOrder_idx" RENAME TO "gig_schedule_item_gigId_sortOrder_idx";

-- An artist can play twice.
ALTER TABLE "gig_schedule_item"
  DROP CONSTRAINT IF EXISTS "gig_creator_gigId_creatorProfileId_key";
DROP INDEX IF EXISTS "gig_creator_gigId_creatorProfileId_key";

DO $$ BEGIN
  CREATE TYPE "GigScheduleKind" AS ENUM ('LOAD_IN', 'SOUND_CHECK', 'DOORS', 'SET', 'CURFEW', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "gig_schedule_item"
  ADD COLUMN IF NOT EXISTS "kind" "GigScheduleKind" NOT NULL DEFAULT 'SET',
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "leadMinutes" INTEGER[] NOT NULL DEFAULT ARRAY[5]::INTEGER[];

-- Only a `SET` has an artist, so the column has to give.
ALTER TABLE "gig_schedule_item" ALTER COLUMN "creatorProfileId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "gig_schedule_item_gigId_startsAt_idx"
  ON "gig_schedule_item"("gigId", "startsAt");

CREATE TABLE IF NOT EXISTS "gig_notify_recipient" (
  "id"        TEXT NOT NULL,
  "gigId"     TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gig_notify_recipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gig_notify_recipient_gigId_userId_key"
  ON "gig_notify_recipient"("gigId", "userId");
CREATE INDEX IF NOT EXISTS "gig_notify_recipient_userId_idx"
  ON "gig_notify_recipient"("userId");

ALTER TABLE "gig_notify_recipient"
  DROP CONSTRAINT IF EXISTS "gig_notify_recipient_gigId_fkey";
ALTER TABLE "gig_notify_recipient"
  ADD CONSTRAINT "gig_notify_recipient_gigId_fkey"
  FOREIGN KEY ("gigId") REFERENCES "gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gig_notify_recipient"
  DROP CONSTRAINT IF EXISTS "gig_notify_recipient_userId_fkey";
ALTER TABLE "gig_notify_recipient"
  ADD CONSTRAINT "gig_notify_recipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "gig_schedule_recipient" (
  "id"     TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "gig_schedule_recipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gig_schedule_recipient_itemId_userId_key"
  ON "gig_schedule_recipient"("itemId", "userId");
CREATE INDEX IF NOT EXISTS "gig_schedule_recipient_userId_idx"
  ON "gig_schedule_recipient"("userId");

ALTER TABLE "gig_schedule_recipient"
  DROP CONSTRAINT IF EXISTS "gig_schedule_recipient_itemId_fkey";
ALTER TABLE "gig_schedule_recipient"
  ADD CONSTRAINT "gig_schedule_recipient_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "gig_schedule_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gig_schedule_recipient"
  DROP CONSTRAINT IF EXISTS "gig_schedule_recipient_userId_fkey";
ALTER TABLE "gig_schedule_recipient"
  ADD CONSTRAINT "gig_schedule_recipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The idempotency ledger. One row per cue actually dealt with; the unique index
-- is what stops two overlapping sweeps sending the same warning twice.
CREATE TABLE IF NOT EXISTS "gig_schedule_fire" (
  "id"              TEXT NOT NULL,
  "itemId"          TEXT NOT NULL,
  "offsetMinutes"   INTEGER NOT NULL,
  "firedFor"        TIMESTAMP(3) NOT NULL,
  "skipped"         BOOLEAN NOT NULL DEFAULT false,
  "devices"         INTEGER NOT NULL DEFAULT 0,
  "delivered"       INTEGER NOT NULL DEFAULT 0,
  "notifyMessageId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gig_schedule_fire_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gig_schedule_fire_itemId_offsetMinutes_key"
  ON "gig_schedule_fire"("itemId", "offsetMinutes");

ALTER TABLE "gig_schedule_fire"
  DROP CONSTRAINT IF EXISTS "gig_schedule_fire_itemId_fkey";
ALTER TABLE "gig_schedule_fire"
  ADD CONSTRAINT "gig_schedule_fire_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "gig_schedule_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
