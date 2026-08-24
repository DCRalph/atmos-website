import "server-only";

import { db } from "~/server/db";
import { sendPush } from "~/server/push";
import { ACTIVE_SECONDS } from "~/lib/gig-chat/room";

/**
 * Who is in a gig's room, and telling them something was said.
 *
 * Membership is a rule rather than a table: every admin, plus the gig's
 * `GigNotifyRecipient` list. That list is the roster the run sheet already
 * sends cues to, so the people being told to be somewhere are exactly the
 * people who can talk about it, and there is one list to maintain instead of
 * two that drift. Granting somebody ADMIN puts them in every room with no
 * backfill; revoking it takes them out of every room with no cleanup.
 *
 * Notifications go through `sendPush` directly rather than through `publish`.
 * A chat message is not a topic broadcast — its audience is a named handful of
 * people, and a busy night's two hundred messages would bury the notification
 * history the admin reads to answer "what did we send".
 */

/** Every member of a gig's room, admins included. Deduplicated. */
export async function roomMemberIds(gigId: string): Promise<string[]> {
  const [admins, recipients] = await Promise.all([
    db.userPermissionAssignment.findMany({
      where: { permission: "ADMIN" },
      select: { userId: true },
    }),
    db.gigNotifyRecipient.findMany({
      where: { gigId },
      select: { userId: true },
    }),
  ]);

  return [
    ...new Set([
      ...admins.map((row) => row.userId),
      ...recipients.map((row) => row.userId),
    ]),
  ];
}

/**
 * Every gig the given person can see a room for.
 *
 * An admin gets every gig, so the answer is "all of them" rather than a list of
 * ids — returning ten thousand ids to then feed back into an `in` clause is a
 * round trip to say "no filter".
 */
export async function visibleGigFilter(
  userId: string,
): Promise<{ kind: "all" } | { kind: "some"; gigIds: string[] }> {
  const isAdmin = await db.userPermissionAssignment.findFirst({
    where: { userId, permission: "ADMIN" },
    select: { id: true },
  });
  if (isAdmin) return { kind: "all" };

  const recipients = await db.gigNotifyRecipient.findMany({
    where: { userId },
    select: { gigId: true },
  });
  return { kind: "some", gigIds: recipients.map((row) => row.gigId) };
}

/**
 * Push a message to the room, minus the people who do not need it.
 *
 * Three exclusions, in order of how obvious they are: the author, anybody who
 * muted the room, and anybody whose read mark is fresh enough that they are
 * plainly looking at the room right now. The last one is why `lastReadAt` is
 * refreshed by the room screen rather than only on open — it makes presence a
 * side effect of reading instead of a table to keep alive.
 */
export async function notifyRoom({
  gigId,
  gigTitle,
  authorId,
  authorName,
  body,
}: {
  gigId: string;
  gigTitle: string;
  authorId: string;
  authorName: string;
  body: string;
}): Promise<void> {
  const members = await roomMemberIds(gigId);
  const others = members.filter((id) => id !== authorId);
  if (others.length === 0) return;

  const marks = await db.gigChatRead.findMany({
    where: { gigId, userId: { in: others } },
    select: { userId: true, muted: true, lastReadAt: true },
  });

  const active = Date.now() - ACTIVE_SECONDS * 1000;
  const skip = new Set(
    marks
      .filter((mark) => mark.muted || mark.lastReadAt.getTime() >= active)
      .map((mark) => mark.userId),
  );

  const userIds = others.filter((id) => !skip.has(id));
  if (userIds.length === 0) return;

  await sendPush({
    audience: { kind: "users", userIds },
    // The gig names itself, because "Atmos" on a lock screen at 9pm does not
    // say which of two rooms just moved.
    title: gigTitle,
    body: `${authorName}: ${body}`,
    data: { url: `/(admin)/chat/${gigId}` },
    priority: "high",
  });
}

/**
 * How many messages each room has that this person has not read.
 *
 * One query for every room at once, rather than one per room: each gig
 * contributes its own `createdAt >` threshold to a single `OR`, which the
 * `(gigId, createdAt)` index answers directly. A gig with no read mark counts
 * everything, which is the right answer for a room somebody has never opened.
 *
 * Own messages never count. A room that says "1 unread" because you just spoke
 * in it is a room people learn to ignore.
 */
export async function unreadCounts(
  userId: string,
  gigIds: readonly string[],
): Promise<Map<string, number>> {
  if (gigIds.length === 0) return new Map();

  const marks = await db.gigChatRead.findMany({
    where: { userId, gigId: { in: [...gigIds] } },
    select: { gigId: true, lastReadAt: true },
  });
  const markFor = new Map(marks.map((mark) => [mark.gigId, mark.lastReadAt]));

  const rows = await db.gigChatMessage.groupBy({
    by: ["gigId"],
    where: {
      deletedAt: null,
      authorId: { not: userId },
      OR: gigIds.map((gigId) => {
        const mark = markFor.get(gigId);
        return mark ? { gigId, createdAt: { gt: mark } } : { gigId };
      }),
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.gigId, row._count._all]));
}

/**
 * Move somebody's read mark to now.
 *
 * `updateMany` with a `lt` guard rather than a plain update, so two requests
 * racing cannot leave the mark behind where it was: the later timestamp wins
 * and the earlier one matches nothing. A mark that goes backwards resurrects
 * unread counts somebody has already cleared, which is the one way a read
 * receipt can be actively worse than none.
 *
 * The upsert only runs when the guarded update matched nothing, which is either
 * a first read or a mark already ahead of now. `update: {}` covers the second
 * case without touching it.
 */
export async function markRoomRead(
  gigId: string,
  userId: string,
): Promise<void> {
  const now = new Date();

  const { count } = await db.gigChatRead.updateMany({
    where: { gigId, userId, lastReadAt: { lt: now } },
    data: { lastReadAt: now },
  });
  if (count > 0) return;

  await db.gigChatRead.upsert({
    where: { gigId_userId: { gigId, userId } },
    create: { gigId, userId, lastReadAt: now },
    update: {},
  });
}
