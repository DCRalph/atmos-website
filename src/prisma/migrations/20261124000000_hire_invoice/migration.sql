-- Hire invoices: the Stripe tax invoice a signed equipment hire agreement
-- raises, paid on /invoices/<payToken>. Additive only.

-- CreateEnum
CREATE TYPE "HireInvoiceStatus" AS ENUM ('OPEN', 'PAID', 'REFUNDED', 'VOID');

-- CreateTable
CREATE TABLE "hire_invoice" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "payToken" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "description" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "gstCents" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "HireInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "emailedAt" TIMESTAMP(3),
    "emailedTo" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidWith" TEXT,
    "stripePaymentIntentId" TEXT,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hire_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hire_invoice_contractId_key" ON "hire_invoice"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "hire_invoice_payToken_key" ON "hire_invoice"("payToken");

-- CreateIndex
CREATE UNIQUE INDEX "hire_invoice_stripeInvoiceId_key" ON "hire_invoice"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "hire_invoice_stripePaymentIntentId_key" ON "hire_invoice"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "hire_invoice_status_dueAt_idx" ON "hire_invoice"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "hire_invoice" ADD CONSTRAINT "hire_invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
