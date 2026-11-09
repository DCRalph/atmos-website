import "server-only";

import { UnsubscribeVia } from "~Prisma/client";
import { db } from "~/server/db";
import { readUnsubscribeToken } from "./links";
import { unsubscribe } from "./subscribers";

/**
 * The public side of an unsubscribe link: the preferences page and the
 * one-click button. Everything is keyed on the signed token, never on an
 * address someone types, so nobody can change another person's mail.
 */

/** Who a token is for, and which mailout's lists it came with. */
async function resolve(token: string) {
  const parsed = readUnsubscribeToken(token);
  if (!parsed) return null;
  const subscriber = await db.subscriber.findUnique({
    where: { id: parsed.subscriberId },
    select: { id: true, email: true },
  });
  if (!subscriber) return null;
  const mailout = parsed.mailoutId
    ? await db.mailout.findUnique({
        where: { id: parsed.mailoutId },
        select: { id: true, listIds: true },
      })
    : null;
  return { subscriber, mailout };
}

/**
 * What the page shows: every public list, and any private one this person is
 * on. Null for a link that is not ours or whose person was deleted.
 */
export async function loadPreferences(token: string) {
  const found = await resolve(token);
  if (!found) return null;
  const { subscriber, mailout } = found;

  const lists = await db.mailingList.findMany({
    where: {
      archivedAt: null,
      OR: [
        { public: true },
        { members: { some: { subscriberId: subscriber.id } } },
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      members: {
        where: { subscriberId: subscriber.id },
        select: { unsubscribedAt: true },
      },
    },
  });

  return {
    email: subscriber.email,
    /** The lists the email this link came in went to, to name up top. */
    fromListIds: mailout?.listIds ?? [],
    lists: lists.map(({ members, ...list }) => ({
      ...list,
      subscribed: members.length > 0 && !members[0]?.unsubscribedAt,
    })),
  };
}

export type Preferences = NonNullable<
  Awaited<ReturnType<typeof loadPreferences>>
>;

/** Turn one list on or off from the page. */
export async function setPreference(
  token: string,
  listId: string,
  subscribed: boolean,
) {
  const found = await resolve(token);
  if (!found) return false;
  const { subscriber, mailout } = found;

  if (!subscribed) {
    await unsubscribe(db, {
      subscriberId: subscriber.id,
      listIds: [listId],
      via: UnsubscribeVia.PAGE,
      mailoutId: mailout?.id ?? null,
    });
    return true;
  }

  // Joining is only offered for lists the page shows: public ones, or a
  // private one they were already on.
  const list = await db.mailingList.findFirst({
    where: {
      id: listId,
      archivedAt: null,
      OR: [
        { public: true },
        { members: { some: { subscriberId: subscriber.id } } },
      ],
    },
    select: { id: true },
  });
  if (!list) return false;
  await db.listMembership.upsert({
    where: {
      subscriberId_listId: { subscriberId: subscriber.id, listId: list.id },
    },
    create: {
      subscriberId: subscriber.id,
      listId: list.id,
      source: "preferences-page",
    },
    update: {
      source: "preferences-page",
      subscribedAt: new Date(),
      unsubscribedAt: null,
      unsubscribedVia: null,
      unsubscribedFromMailoutId: null,
    },
  });
  return true;
}

/** "Unsubscribe from everything" on the page. */
export async function unsubscribeEverything(token: string) {
  const found = await resolve(token);
  if (!found) return false;
  await unsubscribe(db, {
    subscriberId: found.subscriber.id,
    listIds: "all",
    via: UnsubscribeVia.PAGE,
    mailoutId: found.mailout?.id ?? null,
  });
  return true;
}

/**
 * A mail app's Unsubscribe button: off the lists that mailout went to, or
 * off everything for a link without one.
 */
export async function unsubscribeOneClick(token: string) {
  const found = await resolve(token);
  if (!found) return false;
  await unsubscribe(db, {
    subscriberId: found.subscriber.id,
    listIds: found.mailout?.listIds ?? "all",
    via: UnsubscribeVia.ONE_CLICK,
    mailoutId: found.mailout?.id ?? null,
  });
  return true;
}
