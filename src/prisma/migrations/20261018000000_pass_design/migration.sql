-- Wallet pass designs, step 1 of 2: add the JSON columns and copy the old ones in.
--
-- The five `pass*` columns on `ticket_event` and `access_level.passAccent`
-- become one `passDesign` JSON layer each (see `~/lib/ticketing/pass-design.ts`).
-- Values equal to the Atmos house style are left out, since an unset field
-- already resolves to it. Additive, so it is safe to run before the deploy:
-- the old code never reads these columns.
--
--   npx prisma db execute --file src/prisma/migrations/20261018000000_pass_design/migration.sql
--
-- Then deploy, then run 20261018000001_pass_design_drop_columns.

ALTER TABLE "ticket_event" ADD COLUMN IF NOT EXISTS "passDesign" JSONB;
ALTER TABLE "access_level" ADD COLUMN IF NOT EXISTS "passDesign" JSONB;

UPDATE "ticket_event"
SET "passDesign" = NULLIF(
  jsonb_strip_nulls(jsonb_build_object(
    'stripStyle', NULLIF("passStripStyle"::text, 'HATCH'),
    'accentHex', CASE WHEN lower("passAccentHex") = '#470082' THEN NULL ELSE "passAccentHex" END,
    'backgroundHex', CASE WHEN lower("passBackgroundHex") = '#0b0b0c' THEN NULL ELSE "passBackgroundHex" END,
    'foregroundHex', CASE WHEN lower("passForegroundHex") = '#ffffff' THEN NULL ELSE "passForegroundHex" END,
    'labelHex', CASE WHEN lower("passLabelHex") = '#a0a0aa' THEN NULL ELSE "passLabelHex" END
  )),
  '{}'::jsonb
)
WHERE "passDesign" IS NULL;

UPDATE "access_level"
SET "passDesign" = jsonb_build_object('accentHex', "passAccent")
WHERE "passAccent" IS NOT NULL AND "passDesign" IS NULL;
