-- Existing and new gigs show their uploaded gallery before the event by default.
ALTER TABLE "gig" ADD COLUMN "showGalleryBeforeGig" BOOLEAN NOT NULL DEFAULT true;
