-- Contract signing: the link a contract is emailed with, who it was sent to
-- and by, the other party's signature, and the task that reminds someone to
-- pay the performer. Additive only.

-- AlterEnum

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CONTRACT_SENT';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CONTRACT_SIGNED';

-- AlterTable
ALTER TABLE "contract" ADD COLUMN     "paymentTaskId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "sentByName" TEXT,
ADD COLUMN     "sentTo" TEXT,
ADD COLUMN     "signToken" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "signedIp" TEXT,
ADD COLUMN     "signedName" TEXT,
ADD COLUMN     "signedUserAgent" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contract_signToken_key" ON "contract"("signToken");

-- CreateIndex
CREATE UNIQUE INDEX "contract_paymentTaskId_key" ON "contract"("paymentTaskId");

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_paymentTaskId_fkey" FOREIGN KEY ("paymentTaskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
