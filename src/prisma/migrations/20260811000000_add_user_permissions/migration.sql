-- Phase 1 of the role-to-permission migration.
-- Deliberately does not copy any legacy role assignments: every user starts
-- with no explicit permissions and permissions are reassigned manually.
CREATE TYPE "UserPermission" AS ENUM ('EVENT_ORGANISER', 'CREATOR', 'ADMIN');

CREATE TABLE "user_permission_assignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "UserPermission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "user_permission_assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_permission_assignment_userId_permission_key"
ON "user_permission_assignment"("userId", "permission");

CREATE INDEX "user_permission_assignment_permission_idx"
ON "user_permission_assignment"("permission");

ALTER TABLE "user_permission_assignment"
ADD CONSTRAINT "user_permission_assignment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "ActivityType" ADD VALUE 'USER_PERMISSION_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE 'USER_PERMISSION_ADDED';
ALTER TYPE "ActivityType" ADD VALUE 'USER_PERMISSION_REMOVED';
