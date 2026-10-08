-- Wallet-supplied billing address on ticket orders. Additive; `db push` would
-- do the same, this is here so it can be applied before deploy.
ALTER TABLE "ticket_order" ADD COLUMN IF NOT EXISTS "buyerAddress" TEXT;
