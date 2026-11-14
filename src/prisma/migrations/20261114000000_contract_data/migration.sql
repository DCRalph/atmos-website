-- Contract data: what the contract pages need that the database did not hold.
-- Private artist details, booking terms on each artist in a set, the rest of
-- the hire agreement on the rental, replacement values and serials on gear,
-- and a saved record of each contract as it was issued. Additive only.

-- CreateEnum
CREATE TYPE "ContractKind" AS ENUM ('PERFORMER', 'HIRE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED');

-- AlterTable
ALTER TABLE "gig_set_artist" ADD COLUMN     "contractNotes" TEXT,
ADD COLUMN     "feeCents" INTEGER,
ADD COLUMN     "feeIncludesGst" BOOLEAN,
ADD COLUMN     "guestListPlaces" INTEGER;

-- AlterTable
ALTER TABLE "gear_item" ADD COLUMN     "replacementValueCents" INTEGER,
ADD COLUMN     "serialNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "rental" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bondCents" INTEGER,
ADD COLUMN     "collectionTime" TEXT,
ADD COLUMN     "organisation" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "returnTime" TEXT,
ADD COLUMN     "useLocation" TEXT;

-- CreateTable
CREATE TABLE "artist_private_details" (
    "artistProfileId" TEXT NOT NULL,
    "legalName" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "gstNumber" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "artist_private_details_pkey" PRIMARY KEY ("artistProfileId")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "kind" "ContractKind" NOT NULL,
    "setArtistId" TEXT,
    "rentalId" TEXT,
    "title" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_setArtistId_key" ON "contract"("setArtistId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_rentalId_key" ON "contract"("rentalId");

-- CreateIndex
CREATE INDEX "contract_status_updatedAt_idx" ON "contract"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "artist_private_details" ADD CONSTRAINT "artist_private_details_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "artist_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_setArtistId_fkey" FOREIGN KEY ("setArtistId") REFERENCES "gig_set_artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;
