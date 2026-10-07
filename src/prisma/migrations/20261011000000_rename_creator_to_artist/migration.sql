-- Creator profiles become artist profiles.
--
-- Pure renames: tables, columns, indexes, constraints and enums all keep their
-- rows, ids and foreign keys, so nothing is copied or rebuilt. Upload rows also
-- carry the preset and destination names as plain strings; those move too so
-- dedupe and the media library keep matching them. Files already in storage
-- keep their `creator-profiles/` keys; only new uploads land under
-- `artist-profiles/`.
--
-- One transaction: if any name here does not match the live database, nothing
-- changes. Apply before deploying the code that expects the new names:
--
--   psql "$DATABASE_URL" -f src/prisma/migrations/20261011000000_rename_creator_to_artist/migration.sql
--
-- Afterwards `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma` should report no difference.

BEGIN;

-- Tables
ALTER TABLE "creator_profile"       RENAME TO "artist_profile";
ALTER TABLE "creator_profile_theme" RENAME TO "artist_profile_theme";
ALTER TABLE "creator_block"         RENAME TO "artist_block";
ALTER TABLE "creator_social"        RENAME TO "artist_social";
ALTER TABLE "creator_claim_request" RENAME TO "artist_claim_request";

-- Columns pointing at a profile from elsewhere
ALTER TABLE "crew_member"    RENAME COLUMN "creatorProfileId" TO "artistProfileId";
ALTER TABLE "gig_set_artist" RENAME COLUMN "creatorProfileId" TO "artistProfileId";

-- Primary keys
ALTER TABLE "artist_profile"       RENAME CONSTRAINT "creator_profile_pkey"       TO "artist_profile_pkey";
ALTER TABLE "artist_profile_theme" RENAME CONSTRAINT "creator_profile_theme_pkey" TO "artist_profile_theme_pkey";
ALTER TABLE "artist_block"         RENAME CONSTRAINT "creator_block_pkey"         TO "artist_block_pkey";
ALTER TABLE "artist_social"        RENAME CONSTRAINT "creator_social_pkey"        TO "artist_social_pkey";
ALTER TABLE "artist_claim_request" RENAME CONSTRAINT "creator_claim_request_pkey" TO "artist_claim_request_pkey";

-- Foreign keys
ALTER TABLE "artist_profile"       RENAME CONSTRAINT "creator_profile_userId_fkey"                TO "artist_profile_userId_fkey";
ALTER TABLE "artist_profile"       RENAME CONSTRAINT "creator_profile_themeId_fkey"               TO "artist_profile_themeId_fkey";
ALTER TABLE "artist_profile_theme" RENAME CONSTRAINT "creator_profile_theme_ownerUserId_fkey"     TO "artist_profile_theme_ownerUserId_fkey";
ALTER TABLE "artist_block"         RENAME CONSTRAINT "creator_block_profileId_fkey"               TO "artist_block_profileId_fkey";
ALTER TABLE "artist_social"        RENAME CONSTRAINT "creator_social_profileId_fkey"              TO "artist_social_profileId_fkey";
ALTER TABLE "artist_claim_request" RENAME CONSTRAINT "creator_claim_request_profileId_fkey"       TO "artist_claim_request_profileId_fkey";
ALTER TABLE "artist_claim_request" RENAME CONSTRAINT "creator_claim_request_requestingUserId_fkey" TO "artist_claim_request_requestingUserId_fkey";
ALTER TABLE "crew_member"          RENAME CONSTRAINT "crew_member_creatorProfileId_fkey"          TO "crew_member_artistProfileId_fkey";
ALTER TABLE "gig_set_artist"       RENAME CONSTRAINT "gig_set_artist_creatorProfileId_fkey"       TO "gig_set_artist_artistProfileId_fkey";

-- Indexes
ALTER INDEX "creator_profile_userId_key"                 RENAME TO "artist_profile_userId_key";
ALTER INDEX "creator_profile_handle_key"                 RENAME TO "artist_profile_handle_key";
ALTER INDEX "creator_profile_claimStatus_idx"            RENAME TO "artist_profile_claimStatus_idx";
ALTER INDEX "creator_profile_themeId_idx"                RENAME TO "artist_profile_themeId_idx";
ALTER INDEX "creator_profile_theme_ownerUserId_idx"      RENAME TO "artist_profile_theme_ownerUserId_idx";
ALTER INDEX "creator_profile_theme_isPublic_isSystem_idx" RENAME TO "artist_profile_theme_isPublic_isSystem_idx";
ALTER INDEX "creator_block_profileId_y_x_idx"            RENAME TO "artist_block_profileId_y_x_idx";
ALTER INDEX "creator_social_profileId_sortOrder_idx"     RENAME TO "artist_social_profileId_sortOrder_idx";
ALTER INDEX "creator_claim_request_profileId_idx"        RENAME TO "artist_claim_request_profileId_idx";
ALTER INDEX "creator_claim_request_requestingUserId_idx" RENAME TO "artist_claim_request_requestingUserId_idx";
ALTER INDEX "creator_claim_request_status_idx"           RENAME TO "artist_claim_request_status_idx";
ALTER INDEX "crew_member_creatorProfileId_idx"           RENAME TO "crew_member_artistProfileId_idx";
ALTER INDEX "gig_set_artist_creatorProfileId_idx"        RENAME TO "gig_set_artist_artistProfileId_idx";
ALTER INDEX "gig_set_artist_itemId_creatorProfileId_key" RENAME TO "gig_set_artist_itemId_artistProfileId_key";

-- Enums
ALTER TYPE "CreatorBlockType" RENAME TO "ArtistBlockType";

ALTER TYPE "UserPermission" RENAME VALUE 'CREATOR' TO 'ARTIST';

ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_PROFILE_CREATED'     TO 'ARTIST_PROFILE_CREATED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_PROFILE_UPDATED'     TO 'ARTIST_PROFILE_UPDATED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_PROFILE_PUBLISHED'   TO 'ARTIST_PROFILE_PUBLISHED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_PROFILE_UNPUBLISHED' TO 'ARTIST_PROFILE_UNPUBLISHED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_PROFILE_DELETED'     TO 'ARTIST_PROFILE_DELETED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_PROFILE_LINKED'      TO 'ARTIST_PROFILE_LINKED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_PROFILE_UNLINKED'    TO 'ARTIST_PROFILE_UNLINKED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_BLOCK_CREATED'       TO 'ARTIST_BLOCK_CREATED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_BLOCK_UPDATED'       TO 'ARTIST_BLOCK_UPDATED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_BLOCK_DELETED'       TO 'ARTIST_BLOCK_DELETED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_CLAIM_REQUESTED'     TO 'ARTIST_CLAIM_REQUESTED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_CLAIM_APPROVED'      TO 'ARTIST_CLAIM_APPROVED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_CLAIM_REJECTED'      TO 'ARTIST_CLAIM_REJECTED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_THEME_CREATED'       TO 'ARTIST_THEME_CREATED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_THEME_UPDATED'       TO 'ARTIST_THEME_UPDATED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_THEME_DELETED'       TO 'ARTIST_THEME_DELETED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_THEME_PUBLISHED'     TO 'ARTIST_THEME_PUBLISHED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_THEME_UNPUBLISHED'   TO 'ARTIST_THEME_UNPUBLISHED';
ALTER TYPE "ActivityType" RENAME VALUE 'CREATOR_THEME_DUPLICATED'    TO 'ARTIST_THEME_DUPLICATED';
ALTER TYPE "ActivityType" RENAME VALUE 'GIG_CREATOR_ADDED'           TO 'GIG_ARTIST_ADDED';
ALTER TYPE "ActivityType" RENAME VALUE 'GIG_CREATOR_REMOVED'         TO 'GIG_ARTIST_REMOVED';

-- Upload rows: `creatorAvatar` -> `artistAvatar`, `creator_profile_banner` ->
-- `artist_profile_banner`, and so on for the four profile presets.
UPDATE "file_upload"
SET "preset" = regexp_replace("preset", '^creator', 'artist')
WHERE "preset" LIKE 'creator%';

UPDATE "file_upload"
SET "for" = regexp_replace("for", '^creator_profile_', 'artist_profile_')
WHERE "for" LIKE 'creator\_profile\_%';

COMMIT;
