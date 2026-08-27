import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  RUN_SHEET_EXPORT_ITEM_KEYS,
  RUN_SHEET_EXPORT_KEYS,
  runSheetExportFilename,
  toRunSheetExport,
  type RunSheetExportGig,
  type RunSheetExportRow,
} from "./export";

/** NZDT, so the local times below are the ones a person at the venue reads. */
const at = (iso: string) => new Date(`${iso}+13:00`);

const gig: RunSheetExportGig = {
  id: "gig1",
  title: "Neon Church",
  subtitle: "Autumn residency",
  gigStartTime: at("2026-03-14T21:00:00"),
  gigEndTime: at("2026-03-15T03:00:00"),
};

function row(
  over: Partial<RunSheetExportRow> & { id: string },
): RunSheetExportRow {
  return {
    kind: "SET",
    label: null,
    role: null,
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
    leadMinutes: [5],
    artists: [],
    notes: null,
    ...over,
  };
}

const exportedAt = new Date("2026-03-13T00:00:00Z");

describe("payload", () => {
  test("has exactly the promised keys", () => {
    const result = toRunSheetExport(gig, [row({ id: "a" })], exportedAt);

    assert.deepEqual(Object.keys(result), [...RUN_SHEET_EXPORT_KEYS]);
    assert.deepEqual(Object.keys(result.gig), [
      "id",
      "title",
      "subtitle",
      "startsAt",
      "endsAt",
    ]);
    assert.deepEqual(Object.keys(result.items[0]!), [
      ...RUN_SHEET_EXPORT_ITEM_KEYS,
    ]);
  });

  /**
   * The route hands over whole Prisma rows. A column added to
   * `GigScheduleItem` must not ride along into a file somebody forwards.
   */
  test("drops anything the row carries that the shape does not name", () => {
    const carrying = {
      ...row({ id: "a" }),
      gigId: "gig1",
      createdAt: new Date(),
      internalRating: 3,
    };

    const [item] = toRunSheetExport(gig, [carrying], exportedAt).items;

    assert.deepEqual(Object.keys(item!), [...RUN_SHEET_EXPORT_ITEM_KEYS]);
  });
});

describe("rows", () => {
  test("come out in running order, named the way a cue names them", () => {
    const result = toRunSheetExport(
      gig,
      [
        row({
          id: "set",
          startsAt: at("2026-03-14T23:00:00"),
          sortOrder: 2,
          artists: [
            { handle: "nova", displayName: "Nova" },
            { handle: "kessler", displayName: "Kessler" },
          ],
        }),
        row({
          id: "doors",
          kind: "DOORS",
          startsAt: at("2026-03-14T21:00:00"),
          sortOrder: 1,
        }),
        row({ id: "brief", kind: "CUSTOM", label: "Crew brief", sortOrder: 9 }),
      ],
      exportedAt,
    );

    assert.deepEqual(
      result.items.map((item) => [item.id, item.name]),
      [
        ["doors", "Doors"],
        ["set", "Nova b2b Kessler"],
        // Untimed rows keep their manual order, after everything timed.
        ["brief", "Crew brief"],
      ],
    );
  });

  test("carry both the instant and the local time", () => {
    const [item] = toRunSheetExport(
      gig,
      [
        row({
          id: "set",
          startsAt: at("2026-03-14T23:30:00"),
          endsAt: at("2026-03-15T00:45:00"),
        }),
      ],
      exportedAt,
    ).items;

    assert.equal(item!.startsAt, "2026-03-14T10:30:00.000Z");
    assert.equal(item!.startsAtLocal, "11:30 pm");
    assert.equal(item!.endsAtLocal, "12:45 am");
  });

  test("leave an untimed row's times null rather than inventing them", () => {
    const [item] = toRunSheetExport(gig, [row({ id: "a" })], exportedAt).items;

    assert.equal(item!.startsAt, null);
    assert.equal(item!.startsAtLocal, null);
    assert.equal(item!.endsAt, null);
    assert.equal(item!.endsAtLocal, null);
  });
});

describe("filename", () => {
  test("slugs the title and dates the gig where the gig is", () => {
    assert.equal(
      runSheetExportFilename({
        title: "Neon Church: Vol. 3!",
        // Midday on the 15th in Auckland is still the 14th in UTC.
        gigStartTime: at("2026-03-15T12:00:00"),
      }),
      "neon-church-vol-3-2026-03-15-run-sheet.json",
    );
  });

  test("survives a title with nothing sluggable in it", () => {
    assert.equal(
      runSheetExportFilename({
        title: "???",
        gigStartTime: at("2026-03-14T21:00:00"),
      }),
      "gig-2026-03-14-run-sheet.json",
    );
  });
});
