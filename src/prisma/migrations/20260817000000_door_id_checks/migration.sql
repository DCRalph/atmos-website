-- Door ID checks: reading a patron's identity document and deciding about them.
--
-- Everything the ticketing schema had until now decides whether a *ticket* is
-- good. These three tables decide whether the *person* is: old enough, known to
-- us, and not barred. A refusal recorded against a ticket is invisible the
-- following weekend, because next weekend's ticket is a different row — a
-- `patron` is the spine that was missing.
--
-- Enum additions stand first so the rest can sit in a transaction on PG 12+.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PATRON_BANNED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PATRON_BAN_LIFTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PATRON_PURGED';

CREATE TYPE "IdDocumentType" AS ENUM (
  'NZ_DRIVER_LICENCE',
  'NZ_PASSPORT',
  'FOREIGN_PASSPORT',
  'KIWI_ACCESS_CARD',
  'OTHER'
);

CREATE TYPE "IdCheckResult" AS ENUM (
  'PASS',
  'UNDERAGE',
  'BANNED',
  'DOCUMENT_EXPIRED',
  'NOT_APPROVED_EVIDENCE',
  'ALREADY_USED_TONIGHT',
  'NAME_MISMATCH',
  'UNREADABLE'
);

-- A member of the public, found again by the document they showed.
--
-- `documentHash` is an HMAC of the document type and number, so the index this
-- is looked up by is not itself a list of licence numbers. `purgeAfter` is the
-- retention switch: set on every check, and NULL only while a ban stands.
CREATE TABLE "patron" (
    "id" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "documentType" "IdDocumentType" NOT NULL,
    "documentNumber" TEXT,
    "documentExpiry" TIMESTAMP(3),
    "fullName" TEXT NOT NULL,
    "givenNames" TEXT,
    "familyName" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "photoKey" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkCount" INTEGER NOT NULL DEFAULT 0,
    "purgeAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patron_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patron_documentHash_key" ON "patron"("documentHash");
-- Surname alone, because the namesake lookup that catches a barred person
-- returning on a different document filters on surname and birthday together.
CREATE INDEX "patron_familyName_idx" ON "patron"("familyName");
-- Driven by the nightly sweep, which asks only "what is due".
CREATE INDEX "patron_purgeAfter_idx" ON "patron"("purgeAfter");

-- Somebody barred from Atmos events. Append-only: lifting stamps `liftedAt`
-- rather than deleting, so "who barred me, and who let me back in" keeps an
-- answer.
CREATE TABLE "patron_ban" (
    "id" TEXT NOT NULL,
    "patronId" TEXT NOT NULL,
    "reason" "TicketDenyReason" NOT NULL,
    "note" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "eventId" TEXT,
    "liftedAt" TIMESTAMP(3),
    "liftedByUserId" TEXT,
    "liftedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patron_ban_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "patron_ban_patronId_liftedAt_idx" ON "patron_ban"("patronId", "liftedAt");

ALTER TABLE "patron_ban"
  ADD CONSTRAINT "patron_ban_patronId_fkey"
  FOREIGN KEY ("patronId") REFERENCES "patron"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only log of every check, including the ones that read nothing.
--
-- `patronId` is nullable and falls to NULL rather than cascading: the identity
-- is purged out from under these rows by design, and what is left still answers
-- "how many IDs did this door check, and how many came back underage".
CREATE TABLE "id_check" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "patronId" TEXT,
    "ticketId" TEXT,
    "result" "IdCheckResult" NOT NULL,
    "ageYears" INTEGER,
    "documentType" "IdDocumentType",
    "checkedByUserId" TEXT,
    "deviceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "id_check_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "id_check_eventId_createdAt_idx" ON "id_check"("eventId", "createdAt");
CREATE INDEX "id_check_patronId_createdAt_idx" ON "id_check"("patronId", "createdAt");
CREATE INDEX "id_check_ticketId_idx" ON "id_check"("ticketId");

ALTER TABLE "id_check"
  ADD CONSTRAINT "id_check_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ticket_event"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "id_check"
  ADD CONSTRAINT "id_check_patronId_fkey"
  FOREIGN KEY ("patronId") REFERENCES "patron"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "id_check"
  ADD CONSTRAINT "id_check_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "ticket"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
