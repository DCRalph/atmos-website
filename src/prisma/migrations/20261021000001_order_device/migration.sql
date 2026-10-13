-- What each online order was bought on: phone, tablet or computer, and its OS.
--
-- Additive and nullable, so safe to run before the code that writes it.
-- Older orders stay null: nothing recorded their browser.
--
--   npx prisma db execute --file src/prisma/migrations/20261021000001_order_device/migration.sql

ALTER TABLE "ticket_order" ADD COLUMN IF NOT EXISTS "device" TEXT;
ALTER TABLE "ticket_order" ADD COLUMN IF NOT EXISTS "os" TEXT;
