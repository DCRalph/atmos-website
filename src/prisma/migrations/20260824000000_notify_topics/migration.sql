-- Team notifications.
--
-- Two parts:
--
--   * `device_token.topics` — the ntfy-style topics a handset receives. Empty
--     for every existing row, which is correct: those devices registered before
--     topics existed and are re-seeded from their owner's permissions the next
--     time the app opens and the user is resolved (see `push.register`).
--   * `notify_message` — what was published, by whom, and how many devices it
--     reached. Without it "nobody got the alert" is unanswerable.
--
--   psql "$DATABASE_URL" -f src/prisma/migrations/20260824000000_notify_topics/migration.sql
--
-- Afterwards `prisma db push` is safe and should report no drift.

ALTER TABLE "device_token"
  ADD COLUMN IF NOT EXISTS "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "notify_message" (
  "id"        TEXT NOT NULL,
  "topic"     TEXT NOT NULL,
  "title"     TEXT,
  "message"   TEXT NOT NULL,
  "priority"  INTEGER NOT NULL DEFAULT 3,
  "tags"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "click"     TEXT,
  "source"    TEXT NOT NULL,
  "senderId"  TEXT,
  "devices"   INTEGER NOT NULL DEFAULT 0,
  "delivered" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notify_message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notify_message_topic_createdAt_idx"
  ON "notify_message"("topic", "createdAt");

CREATE INDEX IF NOT EXISTS "notify_message_senderId_idx"
  ON "notify_message"("senderId");

ALTER TABLE "notify_message"
  DROP CONSTRAINT IF EXISTS "notify_message_senderId_fkey";

-- The sender leaving does not erase what they sent.
ALTER TABLE "notify_message"
  ADD CONSTRAINT "notify_message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
