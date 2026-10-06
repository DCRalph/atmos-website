-- Tiers that wait for the one before them to stop selling. Off for every
-- existing tier, which is how they all behave today.

ALTER TABLE "ticket_tier" ADD COLUMN "releaseAfterPrevious" BOOLEAN NOT NULL DEFAULT false;
