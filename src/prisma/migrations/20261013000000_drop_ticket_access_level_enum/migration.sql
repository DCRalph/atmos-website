-- Drop the retired `TicketAccessLevel` enum type.
--
-- Access levels have lived in `access_level` since prisma/manual/002, and
-- `ticket`, `ticket_tier` and `lifetime_ticket` all store the level's code as
-- text with a foreign key to it. Nothing references the enum type any more;
-- it only lingered because the schema still declared it. No rows change.
--
-- Safe either side of the deploy: the old code never read the type at runtime.
--
--   npx prisma db execute --file src/prisma/migrations/20261013000000_drop_ticket_access_level_enum/migration.sql
--
-- Afterwards `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma` should report no difference.

DROP TYPE IF EXISTS "TicketAccessLevel";
