-- Gig chat rooms.
--
-- Three tables and no room table: a room is a gig, and who is in it is every
-- admin plus the gig's existing `gig_notify_recipient` rows. So there is
-- nothing to seed here and no backfill — every gig that exists already has a
-- room, empty until somebody says something in it.
--
--   psql "$DATABASE_URL" -f src/prisma/migrations/20260826000000_gig_chat/migration.sql
--
-- Afterwards `prisma db push` is safe and should report no drift.

CREATE TABLE IF NOT EXISTS "gig_chat_message" (
  "id"        TEXT NOT NULL,
  "gigId"     TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gig_chat_message_pkey" PRIMARY KEY ("id")
);

-- The room's only read pattern: the newest N messages for one gig.
CREATE INDEX IF NOT EXISTS "gig_chat_message_gigId_createdAt_idx"
  ON "gig_chat_message" ("gigId", "createdAt");
CREATE INDEX IF NOT EXISTS "gig_chat_message_authorId_idx"
  ON "gig_chat_message" ("authorId");

CREATE TABLE IF NOT EXISTS "gig_chat_reaction" (
  "id"        TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "emoji"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gig_chat_reaction_pkey" PRIMARY KEY ("id")
);

-- Reacting twice with the same emoji is the same reaction, so the toggle in the
-- router can upsert rather than read-then-write.
CREATE UNIQUE INDEX IF NOT EXISTS "gig_chat_reaction_messageId_userId_emoji_key"
  ON "gig_chat_reaction" ("messageId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "gig_chat_reaction_userId_idx"
  ON "gig_chat_reaction" ("userId");

CREATE TABLE IF NOT EXISTS "gig_chat_read" (
  "id"         TEXT NOT NULL,
  "gigId"      TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "muted"      BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "gig_chat_read_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gig_chat_read_gigId_userId_key"
  ON "gig_chat_read" ("gigId", "userId");
CREATE INDEX IF NOT EXISTS "gig_chat_read_userId_idx"
  ON "gig_chat_read" ("userId");

ALTER TABLE "gig_chat_message"
  DROP CONSTRAINT IF EXISTS "gig_chat_message_gigId_fkey",
  ADD CONSTRAINT "gig_chat_message_gigId_fkey"
    FOREIGN KEY ("gigId") REFERENCES "gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gig_chat_message"
  DROP CONSTRAINT IF EXISTS "gig_chat_message_authorId_fkey",
  ADD CONSTRAINT "gig_chat_message_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gig_chat_reaction"
  DROP CONSTRAINT IF EXISTS "gig_chat_reaction_messageId_fkey",
  ADD CONSTRAINT "gig_chat_reaction_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "gig_chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gig_chat_reaction"
  DROP CONSTRAINT IF EXISTS "gig_chat_reaction_userId_fkey",
  ADD CONSTRAINT "gig_chat_reaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gig_chat_read"
  DROP CONSTRAINT IF EXISTS "gig_chat_read_gigId_fkey",
  ADD CONSTRAINT "gig_chat_read_gigId_fkey"
    FOREIGN KEY ("gigId") REFERENCES "gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gig_chat_read"
  DROP CONSTRAINT IF EXISTS "gig_chat_read_userId_fkey",
  ADD CONSTRAINT "gig_chat_read_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
