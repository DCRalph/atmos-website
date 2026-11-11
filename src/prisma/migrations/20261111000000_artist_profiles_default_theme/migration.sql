-- Profiles that never picked a theme drew the hard-coded DEFAULT_THEME, so
-- editing the system theme in the admin never reached them. Point them at the
-- default system theme (the oldest one, as `defaultArtistThemeId` picks it),
-- and clear their old accent overrides, which would beat the theme's accent.
UPDATE "artist_profile"
SET
  "themeId" = (
    SELECT "id" FROM "artist_profile_theme"
    WHERE "isSystem" = true
    ORDER BY "createdAt" ASC
    LIMIT 1
  ),
  "accentColor" = NULL
WHERE "themeId" IS NULL;
