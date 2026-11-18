-- When a ticket's pass was first added to Apple Wallet. Additive only.
--
--   npx prisma db execute --file src/prisma/migrations/20261118000000_ticket_apple_wallet_added_at/migration.sql

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN IF NOT EXISTS "appleWalletAddedAt" TIMESTAMP(3);

-- Passes already in a wallet: their registration's creation is the best date
-- there is.
UPDATE "ticket" t
SET "appleWalletAddedAt" = r.first_at
FROM (
  SELECT "serialNumber", MIN("createdAt") AS first_at
  FROM "wallet_pass_registration"
  GROUP BY "serialNumber"
) r
WHERE r."serialNumber" = t.id AND t."appleWalletAddedAt" IS NULL;
