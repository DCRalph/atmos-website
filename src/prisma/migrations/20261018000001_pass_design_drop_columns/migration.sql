-- Wallet pass designs, step 2 of 2: drop the columns `passDesign` replaced.
--
-- Run only once the code reading `passDesign` is live. Before that, the
-- deployed code still selects these columns and every pass build would fail.
--
--   npx prisma db execute --file src/prisma/migrations/20261018000001_pass_design_drop_columns/migration.sql
--
-- Afterwards `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma` should report no difference.

ALTER TABLE "ticket_event"
  DROP COLUMN IF EXISTS "passStripStyle",
  DROP COLUMN IF EXISTS "passAccentHex",
  DROP COLUMN IF EXISTS "passBackgroundHex",
  DROP COLUMN IF EXISTS "passForegroundHex",
  DROP COLUMN IF EXISTS "passLabelHex";

ALTER TABLE "access_level" DROP COLUMN IF EXISTS "passAccent";

DROP TYPE IF EXISTS "PassStripStyle";
