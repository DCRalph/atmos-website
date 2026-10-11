-- Gig donations: an opt-in donate page per gig, with three suggested amounts.
-- Additive only, so `prisma db push` alone is also safe.

ALTER TABLE "gig"
  ADD COLUMN IF NOT EXISTS "donationsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "donationAmountsCents" INTEGER[] DEFAULT ARRAY[1000, 2000, 5000]::INTEGER[];
