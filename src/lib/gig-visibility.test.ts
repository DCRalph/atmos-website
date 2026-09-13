import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { AFFILIATED_LEAD_MS, gigOffSiteNotice } from "./gig-visibility";

/**
 * The banner an admin sees on a gig the public cannot. It has to agree with
 * `listVisibleTo` in `~/server/api/routers/gigs.ts`, which is the same rule as
 * a Prisma `where` and so cannot be asserted on directly. These are the
 * boundaries where the two would disagree first.
 */

const hours = (n: number) => n * 60 * 60 * 1000;
const at = (ms: number) => new Date(Date.now() + ms);

const normal = {
  status: "PUBLISHED",
  mode: "NORMAL",
  gigStartTime: at(hours(24 * 30)),
} as const;

const affiliated = (startsIn: number, endsIn?: number) =>
  ({
    status: "PUBLISHED",
    mode: "AFFILIATED",
    gigStartTime: at(startsIn),
    gigEndTime: endsIn === undefined ? null : at(endsIn),
  }) as const;

describe("gigOffSiteNotice", () => {
  test("a published normal gig is on the site, near or far", () => {
    assert.equal(gigOffSiteNotice(normal), null);
    assert.equal(
      gigOffSiteNotice({ ...normal, gigStartTime: at(-hours(24 * 30)) }),
      null,
    );
  });

  test("a draft is called a draft whatever its mode or date", () => {
    assert.match(
      gigOffSiteNotice({ ...normal, status: "DRAFT" }) ?? "",
      /^Draft\./,
    );
    assert.match(
      gigOffSiteNotice({ ...affiliated(hours(2)), status: "DRAFT" }) ?? "",
      /^Draft\./,
    );
  });

  test("an affiliated gig inside its window is on the site", () => {
    // A day out, on the night, and still running past its start.
    assert.equal(gigOffSiteNotice(affiliated(hours(20))), null);
    assert.equal(gigOffSiteNotice(affiliated(hours(1))), null);
    assert.equal(gigOffSiteNotice(affiliated(-hours(1), hours(3))), null);
  });

  test("an affiliated gig further out than the lead time is not yet on", () => {
    assert.match(
      gigOffSiteNotice(affiliated(AFFILIATED_LEAD_MS + hours(1))) ?? "",
      /Goes on the site/,
    );
  });

  test("an affiliated gig that has finished is off, and stays off", () => {
    assert.match(
      gigOffSiteNotice(affiliated(-hours(2))) ?? "",
      /now that it has finished/,
    );
    assert.match(
      gigOffSiteNotice(affiliated(-hours(24 * 365))) ?? "",
      /now that it has finished/,
    );
  });

  test("the end time decides, not the start", () => {
    // The gig began two hours ago and runs for another three. Comparing on the
    // start alone would call it finished and pull it off the site mid-set.
    assert.equal(gigOffSiteNotice(affiliated(-hours(2), hours(3))), null);
  });
});
