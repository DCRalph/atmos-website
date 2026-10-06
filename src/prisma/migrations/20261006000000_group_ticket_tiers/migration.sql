-- Group tiers: one purchase mints `groupSize` tickets. Existing tiers and
-- order lines default to 1, which is exactly how they behave today.

ALTER TABLE "ticket_tier" ADD COLUMN "groupSize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ticket_order_item" ADD COLUMN "groupSize" INTEGER NOT NULL DEFAULT 1;
