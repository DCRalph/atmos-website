-- A tier waiting on the one above is now shown locked unless it opts to hide.
-- Every tier already waiting was hidden, so it keeps hiding.

ALTER TABLE "ticket_tier" ADD COLUMN "hideUntilReleased" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ticket_tier" SET "hideUntilReleased" = true WHERE "releaseAfterPrevious";
