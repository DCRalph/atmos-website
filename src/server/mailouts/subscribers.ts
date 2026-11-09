import "server-only";

import {
  SuppressionReason,
  type Prisma,
  type UnsubscribeVia,
} from "~Prisma/client";
import { normaliseEmail } from "~/lib/mailouts/emails";
import { db } from "~/server/db";

/**
 * Every write that puts someone on a list, takes them off, or stops mail to
 * them. Signup forms, checkout, the photo signup, imports, the preferences
 * page and the Resend webhook all come through here, so the rules about who
 * can be put back on a list live in one place.
 */

type Client = Prisma.TransactionClient;

/** The list every public signup joins unless told otherwise. */
export const NEWSLETTER = "newsletter";

/** A list by slug. The newsletter is made on first use, so a fresh database
 * (or a local one) still takes signups. */
async function listBySlug(client: Client, slug: string) {
  if (slug === NEWSLETTER) {
    return client.mailingList.upsert({
      where: { slug },
      create: { slug, name: "Newsletter" },
      update: {},
    });
  }
  const list = await client.mailingList.findUnique({ where: { slug } });
  if (!list || list.archivedAt) throw new Error(`No mailing list "${slug}"`);
  return list;
}

/**
 * Put someone on a list. `source` is the consent on record: where they were
 * and what they did ("newsletter-form", "checkout:<eventId>").
 *
 * Someone who left the list is only put back when they asked again
 * themselves (`rejoin`, the default for signups). An import or an admin
 * never undoes an unsubscribe.
 */
export async function subscribe(
  client: Client,
  {
    email,
    list,
    source,
    rejoin = true,
  }: { email: string; list: string; source: string; rejoin?: boolean },
): Promise<"joined" | "rejoined" | "already" | "left"> {
  const address = normaliseEmail(email);
  const mailingList = await listBySlug(client, list);
  const subscriber = await client.subscriber.upsert({
    where: { email: address },
    create: { email: address },
    update: {},
    select: { id: true },
  });
  const key = {
    subscriberId_listId: {
      subscriberId: subscriber.id,
      listId: mailingList.id,
    },
  };
  const existing = await client.listMembership.findUnique({ where: key });

  if (!existing) {
    await client.listMembership.create({
      data: { subscriberId: subscriber.id, listId: mailingList.id, source },
    });
    return "joined";
  }
  if (!existing.unsubscribedAt) return "already";
  if (!rejoin) return "left";

  await client.listMembership.update({
    where: key,
    data: {
      source,
      subscribedAt: new Date(),
      unsubscribedAt: null,
      unsubscribedVia: null,
      unsubscribedFromMailoutId: null,
    },
  });
  return "rejoined";
}

/** Take someone off some lists, or every list. Lists they already left keep
 * the reason they left for. */
export async function unsubscribe(
  client: Client,
  {
    subscriberId,
    listIds,
    via,
    mailoutId = null,
  }: {
    subscriberId: string;
    listIds: string[] | "all";
    via: UnsubscribeVia;
    mailoutId?: string | null;
  },
) {
  const { count } = await client.listMembership.updateMany({
    where: {
      subscriberId,
      unsubscribedAt: null,
      ...(listIds === "all" ? {} : { listId: { in: listIds } }),
    },
    data: {
      unsubscribedAt: new Date(),
      unsubscribedVia: via,
      unsubscribedFromMailoutId: mailoutId,
    },
  });
  return count;
}

/** Stop all marketing to an address: a hard bounce or a spam complaint. The
 * first reason sticks, except that a complaint replaces a bounce, since only
 * a bounce can be cleared by an admin. */
export async function suppress(
  client: Client,
  subscriberId: string,
  reason: SuppressionReason,
) {
  await client.subscriber.updateMany({
    where:
      reason === SuppressionReason.COMPLAINED
        ? {
            id: subscriberId,
            OR: [
              { suppressedAt: null },
              { suppressedReason: { not: SuppressionReason.COMPLAINED } },
            ],
          }
        : { id: subscriberId, suppressedAt: null },
    data: { suppressedAt: new Date(), suppressedReason: reason },
  });
}

/** Addresses per query when importing, well inside Postgres's bind limit. */
const IMPORT_CHUNK = 2000;

/**
 * Add many addresses to one list at once. Nobody who left the list or is
 * suppressed is added; they come back counted instead, so the admin can see
 * why the list did not grow by as many as they pasted.
 */
export async function importToList(
  listId: string,
  emails: string[],
  source: string,
) {
  const counts = { added: 0, already: 0, left: 0, suppressed: 0 };
  const addresses = [...new Set(emails.map(normaliseEmail))];

  for (let i = 0; i < addresses.length; i += IMPORT_CHUNK) {
    const chunk = addresses.slice(i, i + IMPORT_CHUNK);
    await db.$transaction(async (tx) => {
      await tx.subscriber.createMany({
        data: chunk.map((email) => ({ email })),
        skipDuplicates: true,
      });
      const subscribers = await tx.subscriber.findMany({
        where: { email: { in: chunk } },
        select: {
          id: true,
          suppressedAt: true,
          memberships: {
            where: { listId },
            select: { unsubscribedAt: true },
          },
        },
      });

      const toAdd: string[] = [];
      for (const subscriber of subscribers) {
        const membership = subscriber.memberships[0];
        if (membership?.unsubscribedAt) counts.left += 1;
        else if (membership) counts.already += 1;
        else if (subscriber.suppressedAt) counts.suppressed += 1;
        else toAdd.push(subscriber.id);
      }
      await tx.listMembership.createMany({
        data: toAdd.map((subscriberId) => ({ subscriberId, listId, source })),
        skipDuplicates: true,
      });
      counts.added += toAdd.length;
    });
  }

  return counts;
}
