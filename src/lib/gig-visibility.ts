import { GigMode, GigStatus } from "~Prisma/browser";

/** How long before it starts an `AFFILIATED` gig appears on the site. */
export const AFFILIATED_LEAD_MS = 24 * 60 * 60 * 1000;

type GigVisibility = {
  status: GigStatus;
  mode: GigMode;
  gigStartTime: Date;
  gigEndTime?: Date | null;
};

/**
 * Why this gig is not on the public site, in the words an admin needs, or null
 * when the public can see it too.
 *
 * The forward-looking lists hand an admin rows nobody else gets: unpublished
 * gigs, and affiliated ones still further out than their lead time. That is on
 * purpose — the site is where the work gets checked — but a row that looks
 * exactly like every other row is a trap, so each of those carries this on its
 * card.
 *
 * This is `listVisibleTo` in `~/server/api/routers/gigs.ts` restated in
 * JavaScript, and the two drifting apart would mean a banner on a gig the
 * public can see, or worse, none on a gig they cannot. `gig-visibility.test.ts`
 * pins the boundaries.
 */
export function gigOffSiteNotice(
  gig: GigVisibility,
  now: Date = new Date(),
): string | null {
  if (gig.status !== GigStatus.PUBLISHED) {
    return "Draft. Nobody but an admin can see this.";
  }

  if (gig.mode !== GigMode.AFFILIATED) return null;

  // Nothing for one that has finished: it moves to the gigs page's affiliated
  // tab rather than off the site, so the public can see it there too.
  if (gig.gigStartTime.getTime() - now.getTime() > AFFILIATED_LEAD_MS) {
    return "Affiliated. Goes on the site a day before it starts.";
  }

  return null;
}
