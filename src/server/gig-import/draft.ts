import "server-only";

import type { GigExtraction } from "~/lib/gig-import/extraction";
import { zonedWallTimeToDate } from "~/lib/gig-import/zoned-time";
import { RUN_SHEET_TIMEZONE } from "~/lib/run-sheet/schedule";
import type { PrismaClient } from "~Prisma/client";

/**
 * The step between "what the model said" and "what the database can hold".
 *
 * Everything here is a lookup or a conversion, never a judgement: wall times
 * become instants, tag names become tag ids, handles become creator profiles.
 * Anything that does not resolve is returned as itself rather than dropped, so
 * the wizard can show the admin what it could not place instead of quietly
 * losing a name off the bill.
 */

/** One slot on the bill, after handles have been looked up. */
export type ResolvedSlot = {
  /** Matched profiles, in billing order. Empty when nothing matched. */
  creatorProfileIds: string[];
  /** How the caption billed them, for a slot that has no matched profile. */
  label: string | null;
  role: string | null;
  /** Handles with no profile. These are what step three asks about. */
  unmatchedHandles: string[];
};

export type ResolvedExtraction = {
  title: string;
  subtitle: string;
  shortDescription: string;
  descriptionText: string;
  ticketLink: string | null;
  startsAt: Date;
  endsAt: Date | null;
  /**
   * True when no date was found at all. The gig is created as a to-be-announced
   * so `gigStartTime`, which cannot be null, holds a stand-in the site already
   * knows to hide rather than a date nobody chose.
   */
  dateUnknown: boolean;
  tagIds: string[];
  /** Tag names the post used that the site has no tag for. Never created. */
  unmatchedTagNames: string[];
  slots: ResolvedSlot[];
  /** Every handle across every slot that has no profile, deduplicated. */
  unmatchedHandles: string[];
};

const clean = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, " ").trim() ?? "";

/** Instagram handles are case-insensitive and often written with the @ on. */
const normalizeHandle = (handle: string): string =>
  handle.trim().replace(/^@+/, "").toLowerCase();

/** A bare domain in a caption is still a link; a nonsense string is not. */
function normalizeUrl(raw: string | null): string | null {
  const value = clean(raw);
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function resolveExtraction(
  db: PrismaClient,
  extraction: GigExtraction,
  /** The post's own timestamp, the stand-in when no date was found. */
  postedAt: Date,
): Promise<ResolvedExtraction> {
  const startsAt = extraction.startsAt.value
    ? zonedWallTimeToDate(extraction.startsAt.value, RUN_SHEET_TIMEZONE)
    : null;
  const endsAt = extraction.endsAt.value
    ? zonedWallTimeToDate(extraction.endsAt.value, RUN_SHEET_TIMEZONE)
    : null;

  const wantedTagNames = (extraction.tags.value ?? [])
    .map(clean)
    .filter(Boolean);
  const tags =
    wantedTagNames.length > 0
      ? await db.gigTag.findMany({
          where: { name: { in: wantedTagNames, mode: "insensitive" } },
          select: { id: true, name: true },
        })
      : [];
  const tagByName = new Map(
    tags.map((tag) => [tag.name.toLowerCase(), tag.id] as const),
  );

  const entries = extraction.lineUp.value ?? [];
  const allHandles = Array.from(
    new Set(entries.flatMap((entry) => entry.handles.map(normalizeHandle))),
  ).filter(Boolean);

  const profiles =
    allHandles.length > 0
      ? await db.creatorProfile.findMany({
          where: { handle: { in: allHandles, mode: "insensitive" } },
          select: { id: true, handle: true },
        })
      : [];
  const profileByHandle = new Map(
    profiles.map((profile) => [profile.handle.toLowerCase(), profile.id]),
  );

  const slots: ResolvedSlot[] = entries.map((entry) => {
    const handles = entry.handles.map(normalizeHandle).filter(Boolean);
    return {
      creatorProfileIds: handles.flatMap(
        (handle) => profileByHandle.get(handle) ?? [],
      ),
      label: clean(entry.name) || null,
      role: clean(entry.role) || null,
      unmatchedHandles: handles.filter(
        (handle) => !profileByHandle.has(handle),
      ),
    };
  });

  return {
    title: clean(extraction.title.value) || "Untitled gig",
    subtitle: clean(extraction.venue.value) || "Venue to be confirmed",
    shortDescription: clean(extraction.shortDescription.value),
    descriptionText: extraction.description.value?.trim() ?? "",
    ticketLink: normalizeUrl(extraction.ticketUrl.value),
    startsAt: startsAt ?? postedAt,
    endsAt,
    dateUnknown: startsAt === null,
    tagIds: wantedTagNames.flatMap(
      (name) => tagByName.get(name.toLowerCase()) ?? [],
    ),
    unmatchedTagNames: wantedTagNames.filter(
      (name) => !tagByName.has(name.toLowerCase()),
    ),
    slots,
    unmatchedHandles: Array.from(
      new Set(slots.flatMap((slot) => slot.unmatchedHandles)),
    ),
  };
}
