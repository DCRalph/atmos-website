-- Event codes get their own table.
--
-- `discount_code` keeps the global codes, which are a discount and nothing
-- more. Codes that belong to one event, and can unlock its hidden tiers, move
-- to `event_code` with their redemptions in `event_code_redemption`. An order
-- points at whichever kind it used: `discountCodeId` or the new `eventCodeId`.
--
-- Rows keep their ids, so nothing that logged a code id loses track of it.
-- A global code that had "unlocks hidden tiers" on simply stops unlocking: the
-- column goes, and only event codes unlock now.
--
-- One transaction. Apply before deploying the code that expects the new tables:
--
--   psql "$DATABASE_URL" -f src/prisma/migrations/20261012000000_split_event_codes/migration.sql
--
-- Afterwards `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma` should report no difference.

BEGIN;

-- New tables
CREATE TABLE "event_code" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountCodeType" NOT NULL,
    "value" INTEGER NOT NULL,
    "tierIds" TEXT[],
    "unlocksHiddenTiers" BOOLEAN NOT NULL DEFAULT false,
    "maxRedemptions" INTEGER,
    "maxPerEmail" INTEGER DEFAULT 1,
    "minTickets" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_code_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_code_redemption" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "email" TEXT,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_code_redemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_code_eventId_code_key" ON "event_code"("eventId", "code");
CREATE INDEX "event_code_redemption_codeId_email_idx" ON "event_code_redemption"("codeId", "email");
CREATE UNIQUE INDEX "event_code_redemption_codeId_orderId_key" ON "event_code_redemption"("codeId", "orderId");

ALTER TABLE "event_code" ADD CONSTRAINT "event_code_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ticket_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_code_redemption" ADD CONSTRAINT "event_code_redemption_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "event_code"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_code_redemption" ADD CONSTRAINT "event_code_redemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ticket_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_order" ADD COLUMN "eventCodeId" TEXT;

-- Move every event-scoped code across, with its redemptions and orders
INSERT INTO "event_code" (
    "id", "eventId", "code", "type", "value", "tierIds", "unlocksHiddenTiers",
    "maxRedemptions", "maxPerEmail", "minTickets", "redemptionCount",
    "startsAt", "endsAt", "isActive", "createdBy", "createdAt", "updatedAt"
)
SELECT
    "id", "eventId", "code", "type", "value", "tierIds", "unlocksHiddenTiers",
    "maxRedemptions", "maxPerEmail", "minTickets", "redemptionCount",
    "startsAt", "endsAt", "isActive", "createdBy", "createdAt", "updatedAt"
FROM "discount_code"
WHERE "eventId" IS NOT NULL;

INSERT INTO "event_code_redemption" ("id", "codeId", "orderId", "email", "amountCents", "createdAt")
SELECT r."id", r."codeId", r."orderId", r."email", r."amountCents", r."createdAt"
FROM "discount_redemption" r
JOIN "event_code" e ON e."id" = r."codeId";

UPDATE "ticket_order" o
SET "eventCodeId" = o."discountCodeId", "discountCodeId" = NULL
FROM "event_code" e
WHERE e."id" = o."discountCodeId";

-- Redemptions go with their codes (and cascade anyway); deleted explicitly so
-- the intent reads here.
DELETE FROM "discount_redemption" WHERE "codeId" IN (SELECT "id" FROM "event_code");
DELETE FROM "discount_code" WHERE "id" IN (SELECT "id" FROM "event_code");

-- `discount_code` is global only now
ALTER TABLE "discount_code" DROP CONSTRAINT "discount_code_eventId_fkey";
DROP INDEX "discount_code_eventId_isActive_idx";
ALTER TABLE "discount_code"
    DROP COLUMN "eventId",
    DROP COLUMN "tierIds",
    DROP COLUMN "unlocksHiddenTiers";
CREATE INDEX "discount_code_isActive_idx" ON "discount_code"("isActive");

COMMIT;
