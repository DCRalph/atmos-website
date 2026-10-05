/**
 * App Review demo data, so a reviewer can see every screen with something in it.
 *
 *   APP_REVIEW_PASSWORD=... bun run db:seed-app-review
 *
 * Run it before every App Store submission. It is safe to re-run, and re-running
 * is the point: it puts back whatever the last reviewer changed (check-ins, door
 * sales, ID checks) and moves the demo night forward so it is never in the past.
 *
 * What it writes, all against the production database (see `.env`):
 *
 *  - **A customer account** holding two tickets to the demo night, so the
 *    Tickets tab, the QR code and Add to Apple Wallet all render.
 *  - **A door staff account**, rostered as a manager on the demo night only. It
 *    reaches door mode, the run sheet and the Tap to Pay guides, and nothing
 *    else: no organiser or admin permission, so it cannot see a real event, a
 *    real guest list or the web admin.
 *  - **The demo night**: a draft gig (invisible to the public everywhere) with a
 *    run sheet, and an unlisted ticket event with a guest list, a few people
 *    already in, and tiers to sell at the door.
 *
 * Every ticket is a comp, so no fake revenue reaches the analytics. The run
 * sheet has no recipients, so its cues never push to anybody. ID checks a
 * reviewer makes are removed with the night, patrons included.
 *
 * Nothing here sends email: accounts are written directly rather than through
 * sign-up, which would send a verification email.
 */
import { hashPassword } from "better-auth/crypto";

import type { Prisma } from "~Prisma/client";
import { db } from "~/server/db";
import { issueComp } from "~/server/ticketing/comps";

const PASSWORD = process.env.APP_REVIEW_PASSWORD;
if (!PASSWORD || PASSWORD.length < 8) {
  throw new Error("Set APP_REVIEW_PASSWORD (8+ characters) to run this.");
}

const CUSTOMER = {
  email: "review-customer@atmosmedia.co.nz",
  name: "App Review",
};
const DOOR = {
  email: "review-door@atmosmedia.co.nz",
  name: "App Review Door",
};

const GIG_ID = "app-review-demo";
const EVENT_SLUG = "app-review-demo";
const EVENT_NAME = "Atmos Demo Night";

/** People on the door list. Emails are on example.com, which can never receive mail. */
const GUESTS: { name: string; accessLevel: string; admitted?: boolean }[] = [
  { name: "Aroha Ngata", accessLevel: "GENERAL", admitted: true },
  { name: "Ben Carter", accessLevel: "GENERAL", admitted: true },
  { name: "Chloe Wu", accessLevel: "VIP", admitted: true },
  { name: "Daniel Fale", accessLevel: "GENERAL" },
  { name: "Ella Thompson", accessLevel: "GENERAL" },
  { name: "Finn O'Brien", accessLevel: "CREW", admitted: true },
  { name: "Grace Kim", accessLevel: "GENERAL" },
  { name: "Hemi Walker", accessLevel: "GUEST" },
  { name: "Isla Patel", accessLevel: "VIP" },
  { name: "Jack Robinson", accessLevel: "GENERAL" },
  { name: "Kiri Tane", accessLevel: "GENERAL" },
  { name: "Liam Nguyen", accessLevel: "GUEST" },
];

const HOUR = 60 * 60 * 1000;

/**
 * A Saturday about six months out, 08:00 UTC — 9pm in Wellington over summer,
 * 8pm in winter. Far enough that a review never outlives it, and far enough
 * that the lock-screen run sheet (which looks 12 hours ahead) never picks it up
 * on an organiser's phone.
 */
function demoNight(): Date {
  const date = new Date(Date.now() + 26 * 7 * 24 * HOUR);
  date.setUTCDate(date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7));
  date.setUTCHours(8, 0, 0, 0);
  return date;
}

/** Create or reset an email/password account, verified and without any permission. */
async function upsertAccount({ email, name }: { email: string; name: string }) {
  const password = await hashPassword(PASSWORD!);
  const user = await db.user.upsert({
    where: { email },
    update: { name, emailVerified: true },
    create: { id: crypto.randomUUID(), email, name, emailVerified: true },
  });

  await db.userPermissionAssignment.deleteMany({ where: { userId: user.id } });
  // Unseen again, so the door account gets the Tap to Pay launch splash on
  // sign-in, as Apple's checklist (3.2, 6.2) wants every eligible user to.
  await db.tapToPayAnnouncement.deleteMany({ where: { userId: user.id } });

  const credential = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (credential) {
    await db.account.update({
      where: { id: credential.id },
      data: { password },
    });
  } else {
    await db.account.create({
      data: {
        id: crypto.randomUUID(),
        // better-auth keys a credential account by the user's own id.
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password,
      },
    });
  }
  return user;
}

/**
 * Remove the previous demo event and everything a reviewer did to it.
 *
 * Tickets and order lines go first: they hold the tiers with `Restrict`, and
 * the event's cascade would otherwise try to drop a tier somebody still points
 * at.
 */
async function removeDemoEvent() {
  const event = await db.ticketEvent.findUnique({
    where: { slug: EVENT_SLUG },
    select: { id: true },
  });
  if (!event) return;

  await db.$transaction([
    // People a reviewer ID-checked here and nowhere else. `some` as well as
    // `every`, or a real patron whose checks have all been purged would match.
    db.patron.deleteMany({
      where: {
        checks: { some: { eventId: event.id }, every: { eventId: event.id } },
      },
    }),
    db.patronBan.deleteMany({ where: { eventId: event.id } }),
    db.ticket.deleteMany({ where: { eventId: event.id } }),
    db.ticketOrderItem.deleteMany({ where: { order: { eventId: event.id } } }),
    db.ticketEvent.delete({ where: { id: event.id } }),
  ]);
}

async function main() {
  const startsAt = demoNight();
  const at = (hours: number) => new Date(startsAt.getTime() + hours * HOUR);

  const customer = await upsertAccount(CUSTOMER);
  const door = await upsertAccount(DOOR);

  // ------------------------------------------------------------- the gig
  // Draft, so it is absent from every public list, the website and the app's
  // gig pages. It exists for the run sheet, which hangs off a gig.
  const gig = {
    title: EVENT_NAME,
    subtitle: "App Review demo",
    shortDescription: "A demo event for App Store review. Not a real show.",
    status: "DRAFT" as const,
    gigStartTime: startsAt,
    gigEndTime: at(5),
  };
  await db.gig.upsert({
    where: { id: GIG_ID },
    update: gig,
    create: { id: GIG_ID, ...gig },
  });

  await db.gigScheduleItem.deleteMany({ where: { gigId: GIG_ID } });
  await db.gigScheduleItem.createMany({
    data: (
      [
        { kind: "LOAD_IN", label: "Load in", startsAt: at(-3), sortOrder: 0 },
        {
          kind: "SOUND_CHECK",
          label: "Sound check",
          startsAt: at(-2),
          sortOrder: 1,
        },
        { kind: "DOORS", label: "Doors", startsAt: at(0), sortOrder: 2 },
        {
          kind: "SET",
          label: "Demo DJ One",
          role: "Warm up",
          startsAt: at(0),
          endsAt: at(1.5),
          sortOrder: 3,
        },
        {
          kind: "SET",
          label: "Demo DJ Two",
          role: "Support",
          startsAt: at(1.5),
          endsAt: at(3),
          sortOrder: 4,
        },
        {
          kind: "SET",
          label: "Demo DJ Three",
          role: "Headliner",
          startsAt: at(3),
          endsAt: at(4.75),
          sortOrder: 5,
        },
        { kind: "CURFEW", label: "Curfew", startsAt: at(5), sortOrder: 6 },
      ] satisfies Omit<Prisma.GigScheduleItemCreateManyInput, "gigId">[]
    ).map((row) => ({ ...row, gigId: GIG_ID })),
  });

  // ----------------------------------------------------------- the event
  await removeDemoEvent();

  const event = await db.ticketEvent.create({
    data: {
      slug: EVENT_SLUG,
      name: EVENT_NAME,
      gigId: GIG_ID,
      shortDescription: gig.shortDescription,
      venueName: "Atmos Demo Venue",
      venueAddress: "Cuba Street, Wellington",
      doorsAt: startsAt,
      startsAt,
      endsAt: at(5),
      status: "PUBLISHED",
      publishedAt: new Date(),
      // Listed nowhere. Door mode and the Tickets tab find it by roster and by
      // order, not through a listing.
      visibility: "UNLISTED",
      capacity: 300,
      reentryAllowed: true,
      isR18: true,
      tiers: {
        create: [
          {
            name: "General Admission",
            priceCents: 3000,
            allocation: 250,
            accessLevel: "GENERAL",
            sortOrder: 0,
          },
          {
            name: "VIP",
            priceCents: 6000,
            allocation: 50,
            accessLevel: "VIP",
            sortOrder: 1,
          },
        ],
      },
      staff: {
        create: { userId: door.id, role: "MANAGER", createdBy: door.id },
      },
    },
  });

  // ------------------------------------------------------------- tickets
  const yours = await issueComp({
    eventId: event.id,
    recipientName: CUSTOMER.name,
    recipientEmail: CUSTOMER.email,
    accessLevel: "GENERAL",
    handouts: [{ accessLevel: "GENERAL", quantity: 1 }],
    notes: "App Review demo",
    issuedByUserId: door.id,
  });
  await db.ticketOrder.update({
    where: { id: yours.orderId },
    data: { userId: customer.id },
  });
  // Named, as if already handed on. Unnamed, the ticket reads "No name on this
  // ticket" and sends a reviewer looking for a rename that lives on the web.
  await db.ticket.updateMany({
    where: { hostTicketId: yours.hostTicketId },
    data: { attendeeName: "Sam Taylor", sentAt: new Date() },
  });

  for (const [index, guest] of GUESTS.entries()) {
    const comp = await issueComp({
      eventId: event.id,
      recipientName: guest.name,
      recipientEmail: `guest${index + 1}@example.com`,
      accessLevel: guest.accessLevel,
      notes: "App Review demo",
      issuedByUserId: door.id,
    });
    if (guest.admitted) {
      await db.ticketScan.create({
        data: {
          ticketId: comp.hostTicketId,
          eventId: event.id,
          result: "ADMITTED",
          scannedByUserId: door.id,
          deviceLabel: "Demo handset",
        },
      });
    }
  }

  console.log(`Demo night: ${startsAt.toISOString()} (event ${event.id})`);
  console.log(
    `Customer:   ${CUSTOMER.email} — order ${yours.orderNumber}, ${yours.ticketCount} tickets`,
  );
  console.log(
    `Door staff: ${DOOR.email} — manager on ${EVENT_NAME}, ${GUESTS.length} guests`,
  );
}

await main();
await db.$disconnect();
