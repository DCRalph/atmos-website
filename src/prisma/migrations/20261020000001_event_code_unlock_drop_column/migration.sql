-- Unlock codes, step 2 of 2: drop the switch the UNLOCK type replaced.
--
-- Run only once the code without `unlocksHiddenTiers` is live. Before that,
-- the deployed code still selects it and every event code read would fail.
--
--   npx prisma db execute --file src/prisma/migrations/20261020000001_event_code_unlock_drop_column/migration.sql
--
-- Afterwards `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma` should report no difference.

ALTER TABLE "event_code" DROP COLUMN IF EXISTS "unlocksHiddenTiers";
