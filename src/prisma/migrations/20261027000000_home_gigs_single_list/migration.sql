-- Merge the home page's featured and past placements into one ordered list.
-- The featured entry leads; a gig present in both sections appears only once.
-- Apply with the matching code release: the section column is removed.

BEGIN;

LOCK TABLE "home_gig_placement" IN ACCESS EXCLUSIVE MODE;

WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "gigId"
    ORDER BY CASE WHEN "section" = 'FEATURED' THEN 0 ELSE 1 END,
             "sortOrder", "createdAt", "id"
  ) AS position
  FROM "home_gig_placement"
)
DELETE FROM "home_gig_placement"
USING ranked
WHERE "home_gig_placement"."id" = ranked."id" AND ranked.position > 1;

WITH ordered AS (
  SELECT "id", row_number() OVER (
    ORDER BY CASE WHEN "section" = 'FEATURED' THEN 0 ELSE 1 END,
             "sortOrder", "createdAt", "id"
  ) - 1 AS position
  FROM "home_gig_placement"
)
UPDATE "home_gig_placement" AS placement
SET "sortOrder" = ordered.position
FROM ordered
WHERE placement."id" = ordered."id";

DROP INDEX "home_gig_placement_section_gigId_key";
DROP INDEX "home_gig_placement_section_sortOrder_idx";
ALTER TABLE "home_gig_placement" DROP COLUMN "section";
DROP TYPE "HomeGigSection";

CREATE UNIQUE INDEX "home_gig_placement_gigId_key" ON "home_gig_placement"("gigId");
CREATE INDEX "home_gig_placement_sortOrder_idx" ON "home_gig_placement"("sortOrder");

-- The older home ordering endpoints used these flags; the archive's
-- independent pastSortOrder remains in place.
ALTER TABLE "gig" DROP COLUMN "isFeatured", DROP COLUMN "featuredSortOrder";

COMMIT;
