-- Unlock codes, step 1 of 2: give event codes their own type with UNLOCK in it.
--
-- An event code used to be a discount with an `unlocksHiddenTiers` switch on
-- the side, where an empty `tierIds` meant "every hidden tier". Now unlocking
-- is its own type and always names its tiers. A code that only unlocked
-- (worth nothing) becomes UNLOCK; one that unlocked and discounted stays a
-- discount, since the hidden tier's own price does that job now. A code that
-- unlocked every hidden tier gets those tiers written out.
--
-- Run it just before the deploy. The old code still reads and redeems codes
-- fine; saving an event code in the admin may fail until the deploy lands,
-- since its client casts `type` to the old enum.
--
--   npx prisma db execute --file src/prisma/migrations/20261020000000_event_code_unlock/migration.sql
--
-- Then deploy, then run 20261020000001_event_code_unlock_drop_column.

DO $$ BEGIN
  CREATE TYPE "EventCodeType" AS ENUM ('PERCENT', 'FIXED', 'UNLOCK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "event_code"
  ALTER COLUMN "type" TYPE "EventCodeType" USING ("type"::text::"EventCodeType");

UPDATE "event_code" ec
SET "type" = 'UNLOCK',
    "tierIds" = CASE
      WHEN cardinality(ec."tierIds") > 0 THEN ec."tierIds"
      ELSE ARRAY(
        SELECT t.id FROM "ticket_tier" t
        WHERE t."eventId" = ec."eventId" AND t."isHidden"
        ORDER BY t."sortOrder"
      )
    END
WHERE ec."unlocksHiddenTiers" AND ec."value" = 0;
