-- A landscape poster for the /gigs hero and link previews. Additive only.

ALTER TABLE "gig" ADD COLUMN IF NOT EXISTS "widePosterFileUploadId" TEXT;
