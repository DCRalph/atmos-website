-- A Release block for artist profiles: a record's cover, title and store
-- links. Additive only.
ALTER TYPE "ArtistBlockType" ADD VALUE IF NOT EXISTS 'RELEASE';
