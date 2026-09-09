import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { isGigHappeningNow, isGigPast } from "./date-utils";

/**
 * Past or upcoming, which the admin list, the gig page and the artist pages all
 * ask. It was answered by `isGigUpcoming`, which despite the name only covered
 * the night of the gig, so everything further out than a day read as past.
 */

const hours = (n: number) => n * 60 * 60 * 1000;
const from = (ms: number) => new Date(Date.now() + ms);

describe("isGigPast", () => {
  test("a gig months away is not past", () => {
    assert.equal(isGigPast({ gigStartTime: from(hours(24 * 90)) }), false);
  });

  test("a gig that has been and gone is past", () => {
    assert.equal(isGigPast({ gigStartTime: from(-hours(24 * 30)) }), true);
  });

  test("a gig still running is not past, even though it started", () => {
    assert.equal(
      isGigPast({
        gigStartTime: from(-hours(1)),
        gigEndTime: from(hours(3)),
      }),
      false,
    );
  });

  test("with no end time, the start decides", () => {
    assert.equal(
      isGigPast({ gigStartTime: from(-hours(1)), gigEndTime: null }),
      true,
    );
    assert.equal(
      isGigPast({ gigStartTime: from(hours(1)), gigEndTime: null }),
      false,
    );
  });

  test("the end time wins over the start when both are there", () => {
    assert.equal(
      isGigPast({
        gigStartTime: from(-hours(6)),
        gigEndTime: from(-hours(2)),
      }),
      true,
    );
  });
});

describe("isGigHappeningNow", () => {
  test("is a window, not the whole future", () => {
    // The distinction the naming bug turned on: far-future gigs are not "now",
    // and that must never again be read as "past".
    const distant = { gigStartTime: from(hours(24 * 90)) };
    assert.equal(isGigHappeningNow(distant), false);
    assert.equal(isGigPast(distant), false);
  });

  test("covers tonight", () => {
    assert.equal(isGigHappeningNow({ gigStartTime: from(hours(3)) }), true);
  });
});
