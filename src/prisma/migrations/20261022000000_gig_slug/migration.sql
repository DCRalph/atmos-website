-- A stored, unique slug for each gig's pretty URL. Additive only: the site
-- falls back to the cuid while it is null. Fill it with
-- `bun --conditions=react-server prisma/backfill-gig-slugs.ts --apply`.

ALTER TABLE "gig" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "gig_slug_key" ON "gig"("slug");
