-- Photo signup: emails left on a gig's QR code page, waiting to hear the
-- photos are up, and the short link those QR codes point at. Additive only, so
-- `prisma db push` alone is also safe; this is here for the record.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'GIG_PHOTOS_EMAILED';

ALTER TABLE "gig" ADD COLUMN "photoSignupLinkId" TEXT;
CREATE UNIQUE INDEX "gig_photoSignupLinkId_key" ON "gig"("photoSignupLinkId");
ALTER TABLE "gig" ADD CONSTRAINT "gig_photoSignupLinkId_fkey" FOREIGN KEY ("photoSignupLinkId") REFERENCES "short_link"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "gig_photo_signup" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "gig_photo_signup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gig_photo_signup_gigId_email_key" ON "gig_photo_signup"("gigId", "email");
ALTER TABLE "gig_photo_signup" ADD CONSTRAINT "gig_photo_signup_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
