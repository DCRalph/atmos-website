-- Mailouts: mailing lists, subscribers, and marketing email sent to them.
-- Additive. Run this, then 20261109000001_mailouts_copy_newsletter, which copies the old
-- newsletter table across.

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('BOUNCED', 'COMPLAINED', 'RESEND');

-- CreateEnum
CREATE TYPE "UnsubscribeVia" AS ENUM ('ONE_CLICK', 'PAGE', 'COMPLAINT', 'ADMIN');

-- CreateEnum
CREATE TYPE "MailoutStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MailoutRecipientStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MAILOUT_SENT';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MAILOUT_CANCELLED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MAILING_LIST_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MAILING_LIST_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SUBSCRIBERS_IMPORTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SUBSCRIBER_DELETED';

-- CreateTable
CREATE TABLE "mailing_list" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailing_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "suppressedAt" TIMESTAMP(3),
    "suppressedReason" "SuppressionReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_membership" (
    "subscriberId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribedVia" "UnsubscribeVia",
    "unsubscribedFromMailoutId" TEXT,

    CONSTRAINT "list_membership_pkey" PRIMARY KEY ("subscriberId","listId")
);

-- CreateTable
CREATE TABLE "mailout" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "previewText" TEXT,
    "heading" TEXT,
    "body" JSONB,
    "imageFileId" TEXT,
    "buttonLabel" TEXT,
    "buttonUrl" TEXT,
    "listIds" TEXT[],
    "status" "MailoutStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "html" TEXT,
    "text" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailout_recipient" (
    "id" TEXT NOT NULL,
    "mailoutId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "MailoutRecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "resendId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),

    CONSTRAINT "mailout_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mailing_list_slug_key" ON "mailing_list"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subscriber_email_key" ON "subscriber"("email");

-- CreateIndex
CREATE INDEX "list_membership_listId_unsubscribedAt_idx" ON "list_membership"("listId", "unsubscribedAt");

-- CreateIndex
CREATE INDEX "list_membership_unsubscribedFromMailoutId_idx" ON "list_membership"("unsubscribedFromMailoutId");

-- CreateIndex
CREATE UNIQUE INDEX "mailout_slug_key" ON "mailout"("slug");

-- CreateIndex
CREATE INDEX "mailout_status_scheduledFor_idx" ON "mailout"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "mailout_recipient_resendId_key" ON "mailout_recipient"("resendId");

-- CreateIndex
CREATE INDEX "mailout_recipient_mailoutId_status_idx" ON "mailout_recipient"("mailoutId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mailout_recipient_mailoutId_subscriberId_key" ON "mailout_recipient"("mailoutId", "subscriberId");

-- AddForeignKey
ALTER TABLE "list_membership" ADD CONSTRAINT "list_membership_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_membership" ADD CONSTRAINT "list_membership_listId_fkey" FOREIGN KEY ("listId") REFERENCES "mailing_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailout_recipient" ADD CONSTRAINT "mailout_recipient_mailoutId_fkey" FOREIGN KEY ("mailoutId") REFERENCES "mailout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailout_recipient" ADD CONSTRAINT "mailout_recipient_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
