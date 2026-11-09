-- Refund offers: a refund an admin offers and the buyer takes from a link,
-- after confirming a code sent to the order's email. Additive only.

-- AlterEnum

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'REFUND_OFFERED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'REFUND_OFFER_WITHDRAWN';

-- AlterEnum

ALTER TYPE "TicketEmailType" ADD VALUE IF NOT EXISTS 'REFUND_OFFER';
ALTER TYPE "TicketEmailType" ADD VALUE IF NOT EXISTS 'REFUND_CODE';

-- CreateTable
CREATE TABLE "refund_offer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "includesFees" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "offeredById" TEXT,
    "offeredBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refund_offer_orderId_idx" ON "refund_offer"("orderId");

-- AddForeignKey
ALTER TABLE "refund_offer" ADD CONSTRAINT "refund_offer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ticket_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

