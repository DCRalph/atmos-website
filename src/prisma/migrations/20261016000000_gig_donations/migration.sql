-- Gig donations: an opt-in donate page per gig with three suggested amounts,
-- and the paid donations recorded from Stripe. Additive only, so `prisma db
-- push` alone is also safe.

ALTER TABLE "gig"
  ADD COLUMN IF NOT EXISTS "donationsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "donationAmountsCents" INTEGER[] DEFAULT ARRAY[1000, 2000, 5000]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "donationRecommendedIndex" INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS "donation" (
    "id" TEXT NOT NULL,
    "gigId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NZD',
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "donorEmail" TEXT,
    "donorName" TEXT,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "donation_stripePaymentIntentId_key" ON "donation"("stripePaymentIntentId");
CREATE INDEX IF NOT EXISTS "donation_gigId_paidAt_idx" ON "donation"("gigId", "paidAt");
CREATE INDEX IF NOT EXISTS "donation_paidAt_idx" ON "donation"("paidAt");
ALTER TABLE "donation" ADD CONSTRAINT "donation_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "gig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
