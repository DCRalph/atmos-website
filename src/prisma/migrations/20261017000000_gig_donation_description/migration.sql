-- The donate page's description, written in the full editor. Additive only.

ALTER TABLE "gig" ADD COLUMN IF NOT EXISTS "donationDescriptionLexical" JSONB;
