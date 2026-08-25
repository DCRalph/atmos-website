import "server-only";

import { db } from "~/server/db";

/**
 * Delete my account, without deleting the books.
 *
 * App Store Guideline 5.1.1(v) requires an app that creates accounts to let
 * somebody destroy one from inside the app. Most of that is already handled by
 * the schema: sessions, OAuth accounts, device tokens, chat and claim requests
 * all cascade off `User`, and creator profiles and activity logs go to null.
 *
 * What the schema cannot decide is what happens to a purchase. `TicketOrder`
 * carries no foreign key to `User` on purpose — an order is a financial record
 * and has to outlive the account that made it, both to reconcile against Stripe
 * and because IRD expects seven years of them. So orders are *detached and
 * scrubbed* rather than dropped: the order number, the amounts, the GST and the
 * event stay; the name, the email and the phone number do not.
 *
 * Attendee names are the one deliberate exception, and only for events that
 * have not happened yet. That name is what the door compares against the ID in
 * somebody's hand. Wiping it would take a ticket the person still holds and
 * still intends to use and quietly make it fail at the door — which is a worse
 * outcome, for them, than the thing deletion is protecting them from. It is
 * scrubbed the moment the event is over.
 *
 * Called from better-auth's `user.deleteUser.beforeDelete` hook, so it runs
 * inside the same delete that tears the account down. Throwing here aborts the
 * deletion, which is the behaviour we want: a half-deleted account with live
 * personal data on it is the one outcome worth failing loudly over.
 */
export async function anonymiseAndDeleteUser(userId: string): Promise<void> {
  const now = new Date();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = user?.email.toLowerCase() ?? null;

  const orders = await db.ticketOrder.findMany({
    where: { userId },
    select: { id: true, event: { select: { endsAt: true, startsAt: true } } },
  });

  const orderIds = orders.map((order) => order.id);

  // An event with no explicit end is over once it has started — the run sheets
  // set `endsAt`, but older events predate it.
  const finishedOrderIds = orders
    .filter((order) => (order.event.endsAt ?? order.event.startsAt) < now)
    .map((order) => order.id);

  await db.$transaction([
    // The buyer's details, on every order they made. `userId` goes with them:
    // leaving it would point at a row that is about to stop existing.
    db.ticketOrder.updateMany({
      where: { userId },
      data: {
        userId: null,
        buyerEmail: null,
        buyerName: null,
        buyerPhone: null,
        ipAddress: null,
        marketingOptIn: false,
      },
    }),

    // Sales they took on a door handset stay in the takings; the attribution
    // does not, because it would point at nobody.
    db.ticketOrder.updateMany({
      where: { soldByUserId: userId },
      data: { soldByUserId: null },
    }),

    ...(finishedOrderIds.length > 0
      ? [
          db.ticket.updateMany({
            where: { orderId: { in: finishedOrderIds } },
            data: { attendeeName: null, attendeeEmail: null },
          }),
        ]
      : []),

    // Delivery logs are a record of mail sent to an address we are removing.
    ...(orderIds.length > 0
      ? [db.ticketEmailLog.deleteMany({ where: { orderId: { in: orderIds } } })]
      : []),

    // No foreign key on this one either, so a roster row would outlive the
    // account and put a ghost on a door team.
    db.ticketEventStaff.deleteMany({ where: { userId } }),

    // Keyed on the address rather than the account, so it has to be found by
    // the address. Deleted outright: an unsubscribe flag on a row whose only
    // content is an email address keeps the email address.
    ...(email
      ? [
          db.newsletterSubscription.deleteMany({
            where: { email: { equals: email, mode: "insensitive" } },
          }),
        ]
      : []),
  ]);
}
