-- One-time approve/deny links in the staff rental notification email.
-- Nullable: existing rentals have no link, and the token is cleared once used.

ALTER TABLE "rental" ADD COLUMN "decisionToken" TEXT;

CREATE UNIQUE INDEX "rental_decisionToken_key" ON "rental"("decisionToken");
