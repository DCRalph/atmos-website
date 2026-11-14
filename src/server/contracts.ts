import "server-only";

import { cache } from "react";

import { hireDetails, performerDetails } from "~/lib/contracts";
import { sortSchedule } from "~/lib/run-sheet/schedule";
import { db } from "~/server/db";

/**
 * Reads for the contract pages under /admin/contracts. None of these check
 * who is asking: every page that calls them calls `requireAdmin` first.
 */

/** How far back the Contracts page still lists a gig or a hire, for paperwork done late. */
const LOOKBACK_DAYS = 14;

const lineItems = {
  select: { quantity: true, gearItem: { select: { name: true } } },
  orderBy: { createdAt: "asc" },
} as const;

/**
 * The performer agreement for one artist in one set (a `GigSetArtist` id), or
 * null if there is no such slot. Cached so a page and its metadata share a read.
 */
export const getPerformerContract = cache(
  async (setArtistId: string, atmosContact: string) => {
    const setArtist = await db.gigSetArtist.findUnique({
      where: { id: setArtistId },
      select: {
        artistProfile: {
          select: {
            displayName: true,
            user: { select: { name: true, email: true } },
          },
        },
        item: {
          select: {
            startsAt: true,
            endsAt: true,
            gig: {
              select: {
                title: true,
                gigStartTime: true,
                venue: { select: { name: true, address: true } },
              },
            },
          },
        },
      },
    });
    return setArtist ? performerDetails(setArtist, atmosContact) : null;
  },
);

/** The equipment hire agreement for one rental request, or null if it is gone. */
export const getHireContract = cache(async (rentalId: string) => {
  const rental = await db.rental.findUnique({
    where: { id: rentalId },
    select: {
      userName: true,
      contactInfo: true,
      startDate: true,
      endDate: true,
      discountedDailyPrice: true,
      estimatedTotalPrice: true,
      gearPackage: { select: { items: lineItems } },
      rentalItems: lineItems,
    },
  });
  return rental ? hireDetails(rental) : null;
});

/**
 * Everything a contract can be generated for right now: the sets on recent and
 * upcoming gigs, and the hire requests that have not been turned down.
 */
export async function listContractSources() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  const [gigs, rentals] = await Promise.all([
    db.gig.findMany({
      where: {
        gigStartTime: { gte: since },
        scheduleItems: { some: { kind: "SET", artists: { some: {} } } },
      },
      orderBy: { gigStartTime: "asc" },
      select: {
        id: true,
        title: true,
        gigStartTime: true,
        scheduleItems: {
          where: { kind: "SET", artists: { some: {} } },
          select: {
            id: true,
            startsAt: true,
            sortOrder: true,
            artists: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                artistProfile: { select: { displayName: true } },
              },
            },
          },
        },
      },
    }),
    db.rental.findMany({
      where: { endDate: { gte: since }, status: { not: "REJECTED" } },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        userName: true,
        startDate: true,
        endDate: true,
        status: true,
        gearPackage: { select: { name: true } },
      },
    }),
  ]);

  return {
    gigs: gigs.map((gig) => ({
      ...gig,
      scheduleItems: sortSchedule(gig.scheduleItems),
    })),
    rentals,
  };
}
