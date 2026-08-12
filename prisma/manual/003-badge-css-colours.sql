-- Badge styling: Tailwind class pair -> CSS colours.
--
-- `tone` held strings like `bg-sky-300 text-sky-950`, which meant editing a
-- level's badge required knowing Tailwind's palette by name. Two hex columns
-- instead, so the admin UI can offer a colour picker.
--
-- The backfill maps the six seeded pairs to the hex values those classes
-- actually resolve to, so nothing changes visually. Anything unrecognised
-- falls back to white on black rather than being dropped.
--
--   psql "$DATABASE_URL" -f prisma/manual/003-badge-css-colours.sql

BEGIN;

ALTER TABLE access_level ADD COLUMN IF NOT EXISTS "badgeBg" TEXT NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE access_level ADD COLUMN IF NOT EXISTS "badgeFg" TEXT NOT NULL DEFAULT '#000000';

-- Tailwind's own values for the pairs that were seeded.
UPDATE access_level SET "badgeBg" = v.bg, "badgeFg" = v.fg
FROM (VALUES
  ('bg-white text-black',             '#FFFFFF', '#000000'),
  ('bg-sky-300 text-sky-950',         '#7DD3FC', '#082F49'),
  ('bg-violet-300 text-violet-950',   '#C4B5FD', '#2E1065'),
  ('bg-amber-300 text-amber-950',     '#FCD34D', '#451A03'),
  ('bg-teal-300 text-teal-950',       '#5EEAD4', '#042F2E'),
  ('bg-fuchsia-300 text-fuchsia-950', '#F0ABFC', '#4A044E')
) AS v(tone, bg, fg)
WHERE access_level."tone" = v.tone;

ALTER TABLE access_level DROP COLUMN IF EXISTS "tone";

COMMIT;

-- Check:
--   SELECT code, "badgeBg", "badgeFg" FROM access_level ORDER BY rank;
