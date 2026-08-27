import type { GigScheduleKind } from "~Prisma/browser";

import {
  RUN_SHEET_TIMEZONE,
  formatCueTime,
  rowName,
  sortSchedule,
  type ScheduleRow,
} from "./schedule";

/**
 * A run sheet, as a file somebody else can read.
 *
 * The editor, the app and the cron sweep all read a run sheet through
 * `schedule.ts`; this is the fourth reader, and the only one that is not ours.
 * That makes it the one place where the shape is a promise: a venue with a
 * script pointed at last month's export should not be broken by a column added
 * to `GigScheduleItem` next week. So the payload is built by hand, key by key,
 * and `export.test.ts` fails if it grows one. `version` is there for the day it
 * has to change anyway.
 *
 * Rows come out in running order — the same order the editor and the app show,
 * because it is the same function. A set list is the rows with `kind: "SET"`;
 * there is no second array for it, since filtering one is easier than keeping
 * two in step.
 *
 * Times are ISO instants, which is the only unambiguous way to write one down.
 * `startsAtLocal` is beside each one because a run sheet is read at a venue by
 * somebody who wants "9:00pm", not an offset they have to do arithmetic on.
 *
 * Internal notes are included. Anything holding this file is trusted with them
 * — see the route, which is organiser-only for exactly that reason.
 */

/** Bumped when a key changes meaning or disappears. Additions do not bump it. */
export const RUN_SHEET_EXPORT_VERSION = 1;

/** What a row has to offer before it can be exported. */
export type RunSheetExportRow = Omit<ScheduleRow, "artists"> & {
  notes: string | null;
  artists: readonly { handle: string; displayName: string }[];
};

export type RunSheetExportGig = {
  id: string;
  title: string;
  subtitle: string;
  gigStartTime: Date;
  gigEndTime: Date | null;
};

export type RunSheetExportItem = {
  id: string;
  kind: GigScheduleKind;
  /** What a notification calls this row: a label, a billing, or the kind. */
  name: string;
  role: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** The same times as `timezone` reads them, e.g. "9:00pm". */
  startsAtLocal: string | null;
  endsAtLocal: string | null;
  artists: { handle: string; displayName: string }[];
  notes: string | null;
  /** Minutes before `startsAt` this row warns at. Empty warns on the cue only. */
  leadMinutes: number[];
};

export type RunSheetExport = {
  version: number;
  exportedAt: string;
  timezone: string;
  gig: {
    id: string;
    title: string;
    subtitle: string;
    startsAt: string;
    endsAt: string | null;
  };
  items: RunSheetExportItem[];
};

/** The keys the payload has. Asserted by the test. */
export const RUN_SHEET_EXPORT_KEYS = [
  "version",
  "exportedAt",
  "timezone",
  "gig",
  "items",
] as const;

/** The keys each row has. Asserted by the test. */
export const RUN_SHEET_EXPORT_ITEM_KEYS = [
  "id",
  "kind",
  "name",
  "role",
  "startsAt",
  "endsAt",
  "startsAtLocal",
  "endsAtLocal",
  "artists",
  "notes",
  "leadMinutes",
] as const;

export function toRunSheetExport(
  gig: RunSheetExportGig,
  rows: readonly RunSheetExportRow[],
  exportedAt = new Date(),
  timeZone: string = RUN_SHEET_TIMEZONE,
): RunSheetExport {
  const local = (at: Date | null) => (at ? formatCueTime(at, timeZone) : null);

  return {
    version: RUN_SHEET_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    timezone: timeZone,
    gig: {
      id: gig.id,
      title: gig.title,
      subtitle: gig.subtitle,
      startsAt: gig.gigStartTime.toISOString(),
      endsAt: gig.gigEndTime?.toISOString() ?? null,
    },
    items: sortSchedule(rows).map((row) => ({
      id: row.id,
      kind: row.kind,
      name: rowName(row),
      role: row.role,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      startsAtLocal: local(row.startsAt),
      endsAtLocal: local(row.endsAt),
      artists: row.artists.map((artist) => ({
        handle: artist.handle,
        displayName: artist.displayName,
      })),
      notes: row.notes,
      leadMinutes: [...row.leadMinutes],
    })),
  };
}

/**
 * What the downloaded file is called: `neon-church-2026-03-14-run-sheet.json`.
 *
 * Dated in the run sheet's timezone rather than UTC, because a 1am curfew in
 * Auckland is the previous day's gig everywhere else and nobody filing these
 * thinks of it as two nights.
 */
export function runSheetExportFilename(
  gig: Pick<RunSheetExportGig, "title" | "gigStartTime">,
  timeZone: string = RUN_SHEET_TIMEZONE,
): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(gig.gigStartTime);

  const slug =
    gig.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "gig";

  return `${slug}-${date}-run-sheet.json`;
}
