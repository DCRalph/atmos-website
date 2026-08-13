import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { DEFAULT_PASS_THEME } from "~/lib/ticketing/pass-theme";
import {
  eventHasPassVisibleChange,
  formatPassUpdateTag,
  listUpdatedPasses,
  parsePassesUpdatedSince,
  passUpdatedAt,
  type PassVisibleEventSnapshot,
  type RegisteredPassFreshness,
} from "./pass-updates";

const PASS_TYPE = "pass.nz.co.atmosmedia.ticket";
const OTHER_TYPE = "pass.nz.co.atmosmedia.other";

function at(iso: string): Date {
  return new Date(iso);
}

function snapshot(
  overrides: Partial<PassVisibleEventSnapshot> = {},
): PassVisibleEventSnapshot {
  return {
    name: "Friday Night",
    slug: "friday-night",
    timezone: "Pacific/Auckland",
    startsAt: at("2026-08-14T08:00:00.000Z"),
    doorsAt: at("2026-08-14T07:00:00.000Z"),
    venueName: "Neck of the Woods",
    venueAddress: "8 Nile Rd",
    isR18: true,
    passStripStyle: "HATCH",
    passAccentHex: null,
    passBackgroundHex: null,
    passForegroundHex: null,
    passLabelHex: null,
    ...overrides,
  };
}

function registration(
  overrides: Partial<RegisteredPassFreshness> & { serialNumber: string },
): RegisteredPassFreshness {
  return {
    passTypeIdentifier: PASS_TYPE,
    ticketUpdatedAt: at("2026-08-01T00:00:00.000Z"),
    eventUpdatedAt: at("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("parsePassesUpdatedSince", () => {
  test("treats legacy unix-second tags as seconds", () => {
    const parsed = parsePassesUpdatedSince("1755120000");
    assert.ok(parsed);
    assert.equal(parsed.getTime(), 1_755_120_000_000);
  });

  test("treats millisecond tags as milliseconds", () => {
    const parsed = parsePassesUpdatedSince("1755120000123");
    assert.ok(parsed);
    assert.equal(parsed.getTime(), 1_755_120_000_123);
  });

  test("returns null for missing or junk tags", () => {
    assert.equal(parsePassesUpdatedSince(null), null);
    assert.equal(parsePassesUpdatedSince(""), null);
    assert.equal(parsePassesUpdatedSince("nope"), null);
    assert.equal(parsePassesUpdatedSince("0"), null);
  });
});

describe("pass freshness", () => {
  test("uses the later of ticket and event timestamps", () => {
    const ticket = at("2026-08-10T00:00:00.000Z");
    const event = at("2026-08-14T00:00:00.000Z");
    assert.equal(passUpdatedAt(ticket, event).getTime(), event.getTime());
    assert.equal(passUpdatedAt(event, ticket).getTime(), event.getTime());
  });

  test("emits millisecond tags that stay newer than a legacy seconds tag", () => {
    const updatedAt = at("2026-08-14T08:00:00.500Z");
    const tag = formatPassUpdateTag(updatedAt);
    assert.equal(tag, String(updatedAt.getTime()));
    const since = parsePassesUpdatedSince(
      String(Math.floor(updatedAt.getTime() / 1000) - 1),
    );
    assert.ok(since);
    assert.ok(updatedAt.getTime() > since.getTime());
  });
});

describe("listUpdatedPasses", () => {
  const ticketA = registration({
    serialNumber: "ticket-a",
    ticketUpdatedAt: at("2026-08-10T00:00:00.000Z"),
    eventUpdatedAt: at("2026-08-14T08:00:00.000Z"),
  });
  const ticketB = registration({
    serialNumber: "ticket-b",
    ticketUpdatedAt: at("2026-08-14T09:00:00.000Z"),
    eventUpdatedAt: at("2026-08-01T00:00:00.000Z"),
  });
  const stale = registration({
    serialNumber: "ticket-stale",
    ticketUpdatedAt: at("2026-08-01T00:00:00.000Z"),
    eventUpdatedAt: at("2026-08-01T00:00:00.000Z"),
  });
  const otherType = registration({
    serialNumber: "ticket-other",
    passTypeIdentifier: OTHER_TYPE,
    eventUpdatedAt: at("2026-08-14T10:00:00.000Z"),
  });

  test("returns 204 when no serials match the pass type", () => {
    assert.equal(
      listUpdatedPasses({
        registrations: [otherType],
        passTypeIdentifier: PASS_TYPE,
        passesUpdatedSince: null,
      }),
      null,
    );
  });

  test("returns every serial of that type when the device has no prior tag", () => {
    const listed = listUpdatedPasses({
      registrations: [ticketA, ticketB, otherType],
      passTypeIdentifier: PASS_TYPE,
      passesUpdatedSince: null,
    });
    assert.ok(listed);
    assert.deepEqual(
      new Set(listed.serialNumbers),
      new Set(["ticket-a", "ticket-b"]),
    );
    assert.equal(
      listed.lastUpdated,
      formatPassUpdateTag(ticketB.ticketUpdatedAt),
    );
  });

  test("includes a pass when only the event changed after the device tag", () => {
    const eventOnly = registration({
      serialNumber: "ticket-event-only",
      ticketUpdatedAt: at("2026-07-01T00:00:00.000Z"),
      eventUpdatedAt: at("2026-08-14T08:00:00.000Z"),
    });
    const listed = listUpdatedPasses({
      registrations: [eventOnly, stale],
      passTypeIdentifier: PASS_TYPE,
      // Legacy seconds tag from after the ticket write, before the event edit.
      passesUpdatedSince: String(
        Math.floor(at("2026-08-01T12:00:00.000Z").getTime() / 1000),
      ),
    });
    assert.ok(listed);
    assert.deepEqual(listed.serialNumbers, ["ticket-event-only"]);
    assert.equal(
      listed.lastUpdated,
      formatPassUpdateTag(eventOnly.eventUpdatedAt),
    );
  });

  test("returns 204 when ticket and event are both older than the tag", () => {
    assert.equal(
      listUpdatedPasses({
        registrations: [stale],
        passTypeIdentifier: PASS_TYPE,
        passesUpdatedSince: formatPassUpdateTag(at("2026-08-14T00:00:00.000Z")),
      }),
      null,
    );
  });

  test("scopes to the requested pass type even if another type is newer", () => {
    const listed = listUpdatedPasses({
      registrations: [stale, otherType],
      passTypeIdentifier: PASS_TYPE,
      passesUpdatedSince: null,
    });
    assert.ok(listed);
    assert.deepEqual(listed.serialNumbers, ["ticket-stale"]);
  });
});

describe("eventHasPassVisibleChange", () => {
  const existing = snapshot();

  test("ignores capacity and other non-pass fields", () => {
    assert.equal(
      eventHasPassVisibleChange(existing, {
        name: existing.name,
      }),
      false,
    );
  });

  test("detects door time, timezone, R18, and slug changes", () => {
    assert.equal(
      eventHasPassVisibleChange(existing, {
        doorsAt: at("2026-08-14T07:30:00.000Z"),
      }),
      true,
    );
    assert.equal(
      eventHasPassVisibleChange(existing, { timezone: "Pacific/Chatham" }),
      true,
    );
    assert.equal(eventHasPassVisibleChange(existing, { isR18: false }), true);
    assert.equal(
      eventHasPassVisibleChange(existing, { slug: "friday-night-v2" }),
      true,
    );
  });

  test("does not treat the form's default theme as a change", () => {
    assert.equal(
      eventHasPassVisibleChange(existing, {
        passStripStyle: DEFAULT_PASS_THEME.stripStyle,
        passAccentHex: DEFAULT_PASS_THEME.accentHex,
        passBackgroundHex: DEFAULT_PASS_THEME.backgroundHex,
        passForegroundHex: DEFAULT_PASS_THEME.foregroundHex,
        passLabelHex: DEFAULT_PASS_THEME.labelHex,
      }),
      false,
    );
  });

  test("detects a real theme change", () => {
    assert.equal(
      eventHasPassVisibleChange(existing, { passAccentHex: "#ff00aa" }),
      true,
    );
  });

  test("ignores an identical startsAt rewrite", () => {
    assert.equal(
      eventHasPassVisibleChange(existing, {
        startsAt: at("2026-08-14T08:00:00.000Z"),
      }),
      false,
    );
  });
});
