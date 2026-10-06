-- Door allocation: a tier can be sold online, at the door, or both. Every
-- existing tier is both, which is how they all behave today.

CREATE TYPE "TierSalesChannel" AS ENUM ('ALL', 'ONLINE', 'DOOR');

ALTER TABLE "ticket_tier" ADD COLUMN "salesChannel" "TierSalesChannel" NOT NULL DEFAULT 'ALL';
