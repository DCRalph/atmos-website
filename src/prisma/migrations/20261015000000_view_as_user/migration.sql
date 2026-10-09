-- "View as user" in the admin. Additive; `db push` would do the same, this is
-- here so it can be applied before deploy.
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'USER_IMPERSONATED';
