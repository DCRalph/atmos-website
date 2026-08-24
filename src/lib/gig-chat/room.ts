/**
 * The chat room, as pure functions.
 *
 * Everything here is total and side-effect free, so the app, the web panel and
 * the server agree on what a room means without any of them owning the answer.
 * Kept out of `~/server` deliberately: the web panel is a client component and
 * the Expo bundle imports this directly, so nothing in here may touch Prisma,
 * the database or `server-only`.
 */

/**
 * The five, and only these five.
 *
 * A fixed set rather than a picker is what makes a reaction one tap and every
 * reaction countable: agreement, done, seen, a question, and a laugh is the
 * whole vocabulary a room running a door actually uses. The order is the order
 * they are drawn in, so chips never swap places between renders.
 */
export const REACTIONS = [
  "\u{1F44D}",
  "✅",
  "\u{1F440}",
  "❓",
  "\u{1F602}",
] as const;

export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: string): value is Reaction {
  return REACTIONS.some((emoji) => emoji === value);
}

/** Long enough for a paragraph about a broken reader, short enough to read. */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * How fresh a read mark has to be for somebody to count as looking at the room.
 *
 * The room screen refreshes its mark every few seconds while it is open, so
 * this is presence without a presence table. The cost of being wrong is one
 * unnecessary push, or one push missed by somebody who put their phone down
 * within the last half minute.
 */
export const ACTIVE_SECONDS = 30;

/** How far back a finished gig keeps its room on the list. */
export const ROOM_WINDOW_DAYS = 7;

export type ReactionRow = {
  emoji: string;
  userId: string;
  userName: string;
};

export type ReactionGroup = {
  emoji: Reaction;
  count: number;
  /** Whether the person looking is one of them, so the chip can read as a toggle. */
  mine: boolean;
  /** Who, for the long-press detail. In the order they reacted. */
  names: string[];
};

/**
 * Reaction rows into the chips under a message.
 *
 * Grouped in `REACTIONS` order rather than by count, because a chip that moves
 * when somebody else taps it is a chip you tap by mistake. Anything not in the
 * set is dropped: the server validates on the way in, so a stray emoji means an
 * older row from a set that has since changed, and silently ignoring it is
 * better than drawing something nobody can toggle off.
 */
export function groupReactions(
  rows: readonly ReactionRow[],
  viewerId: string,
): ReactionGroup[] {
  return REACTIONS.flatMap((emoji) => {
    const matching = rows.filter((row) => row.emoji === emoji);
    if (matching.length === 0) return [];
    return [
      {
        emoji,
        count: matching.length,
        mine: matching.some((row) => row.userId === viewerId),
        names: matching.map((row) => row.userName),
      },
    ];
  });
}

export type Member = {
  id: string;
  name: string;
  /** Null for somebody who has never opened the room. */
  lastReadAt: Date | null;
};

export type SeenBy = {
  /** Members past this message, excluding its author and the viewer. */
  names: string[];
  /** How many could have seen it — the room minus its author. */
  total: number;
};

/**
 * Who has read as far as a given message.
 *
 * The author is excluded from both halves, which is the difference between
 * "seen by 4 of 6" meaning something and meaning nothing: you have obviously
 * read your own message, and counting yourself makes every message look one
 * reader better than it is.
 */
export function seenBy(
  members: readonly Member[],
  message: { createdAt: Date; authorId: string },
): SeenBy {
  const others = members.filter((member) => member.id !== message.authorId);
  return {
    names: others
      .filter(
        (member) =>
          member.lastReadAt !== null &&
          member.lastReadAt.getTime() >= message.createdAt.getTime(),
      )
      .map((member) => member.name),
    total: others.length,
  };
}

/**
 * The last message the viewer sent, which is the only one worth drawing
 * receipts under.
 *
 * Receipts on every message is noise — the question a room actually asks is
 * "did anyone see the last thing I said". Returns null when the newest message
 * is not the viewer's, because receipts under a message with three replies
 * below it are answering a question nobody is still asking.
 */
export function receiptAnchorId<T extends { id: string; authorId: string }>(
  messages: readonly T[],
  viewerId: string,
): string | null {
  const last = messages.at(-1);
  return last && last.authorId === viewerId ? last.id : null;
}

/**
 * Whether two messages from the same person should draw as one block.
 *
 * Five minutes, and only within the same author: a follow-up thought is part of
 * the message before it, and re-stamping a name and a time on it costs a line
 * of screen for nothing. A gap longer than this is somebody coming back, which
 * is worth showing.
 */
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

export function continuesBlock(
  previous: { authorId: string; createdAt: Date } | undefined,
  message: { authorId: string; createdAt: Date },
): boolean {
  if (!previous) return false;
  if (previous.authorId !== message.authorId) return false;
  return (
    message.createdAt.getTime() - previous.createdAt.getTime() <
    GROUPING_WINDOW_MS
  );
}
