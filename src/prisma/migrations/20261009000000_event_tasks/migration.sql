-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PROPOSED', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'WILL_GPT', 'PLAYBOOK', 'EMAIL', 'SHARE');

-- CreateEnum
CREATE TYPE "TaskEventKind" AS ENUM ('CREATED', 'ACCEPTED', 'ASSIGNED', 'STATUS_CHANGED', 'DUE_CHANGED', 'SHIFTED', 'DELAY_REPORTED', 'OFFERED', 'TAKEN', 'NUDGED', 'ESCALATED', 'COMMENT', 'PROOF_ADDED', 'ROUND_SETTLED', 'ROUND_WAIVED');

-- CreateEnum
CREATE TYPE "TaskRoundReason" AS ENUM ('SILENT_MISS', 'RESCUED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'TASK_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_STATUS_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_DELAY_REPORTED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_TAKEN';

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "gigId" TEXT,
    "assigneeId" TEXT,
    "reviewerId" TEXT,
    "createdById" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "plannedDueAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "hardDeadlineAt" TIMESTAMP(3),
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "checkBackAt" TIMESTAMP(3),
    "upForGrabs" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "source" "TaskSource" NOT NULL DEFAULT 'MANUAL',
    "sourceRef" TEXT,
    "sourceQuote" TEXT,
    "sourceSubject" TEXT,
    "playbookItemId" TEXT,
    "proofRequired" BOOLEAN NOT NULL DEFAULT false,
    "proofUploadId" TEXT,
    "proofAssessment" TEXT,
    "automation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependency" (
    "taskId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "gapMinutes" INTEGER NOT NULL,

    CONSTRAINT "task_dependency_pkey" PRIMARY KEY ("taskId","dependsOnId")
);

-- CreateTable
CREATE TABLE "task_event" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "TaskEventKind" NOT NULL,
    "body" TEXT,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus",
    "fromDueAt" TIMESTAMP(3),
    "toDueAt" TIMESTAMP(3),
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "causeTaskId" TEXT,
    "onBehalf" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_nudge" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "forDueAt" TIMESTAMP(3) NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "devices" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_nudge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_round" (
    "id" TEXT NOT NULL,
    "owedById" TEXT NOT NULL,
    "owedToId" TEXT,
    "taskId" TEXT NOT NULL,
    "reason" "TaskRoundReason" NOT NULL,
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,
    "waivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_calendar_feed" (
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,

    CONSTRAINT "task_calendar_feed_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "task_playbook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,

    CONSTRAINT "task_playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_inbox_receipt" (
    "sourceRef" TEXT NOT NULL,
    "source" "TaskSource" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "leaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_inbox_receipt_pkey" PRIMARY KEY ("sourceRef")
);

-- CreateTable
CREATE TABLE "task_batch_fire" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_batch_fire_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "task_assigneeId_status_dueAt_idx" ON "task"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "task_gigId_dueAt_idx" ON "task"("gigId", "dueAt");

-- CreateIndex
CREATE INDEX "task_status_dueAt_idx" ON "task"("status", "dueAt");

-- CreateIndex
CREATE INDEX "task_source_sourceRef_idx" ON "task"("source", "sourceRef");

-- CreateIndex
CREATE INDEX "task_dependency_dependsOnId_idx" ON "task_dependency"("dependsOnId");

-- CreateIndex
CREATE INDEX "task_event_taskId_createdAt_idx" ON "task_event"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "task_event_actorId_kind_idx" ON "task_event"("actorId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "task_nudge_taskId_step_forDueAt_key" ON "task_nudge"("taskId", "step", "forDueAt");

-- CreateIndex
CREATE INDEX "task_round_owedById_settledAt_idx" ON "task_round"("owedById", "settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "task_round_taskId_reason_key" ON "task_round"("taskId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "task_calendar_feed_token_key" ON "task_calendar_feed"("token");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "gig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_event" ADD CONSTRAINT "task_event_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_event" ADD CONSTRAINT "task_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_nudge" ADD CONSTRAINT "task_nudge_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_round" ADD CONSTRAINT "task_round_owedById_fkey" FOREIGN KEY ("owedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_round" ADD CONSTRAINT "task_round_owedToId_fkey" FOREIGN KEY ("owedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_round" ADD CONSTRAINT "task_round_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_calendar_feed" ADD CONSTRAINT "task_calendar_feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
