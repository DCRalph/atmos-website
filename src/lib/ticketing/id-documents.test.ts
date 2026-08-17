import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { ageAt, isExpired, matchNames } from "./id-documents";

/**
 * The parts of an ID check that no reader is responsible for.
 *
 * Whatever ends up reading the card — an SDK, a staffer typing — these are the
 * rules applied to what it produces, and they are the ones where being subtly
 * wrong turns somebody away for nothing or lets a seventeen-year-old past.
 */

describe("ageAt", () => {
  const auckland = "Pacific/Auckland";

  test("counts whole years", () => {
    assert.equal(
      ageAt("1990-01-15", new Date("2026-08-17T00:00:00Z"), auckland),
      36,
    );
  });

  test("they are eighteen on their birthday, not the day after", () => {
    // 1am in Auckland on the day itself — which is still the previous day in
    // UTC, and the whole reason the timezone is passed in.
    const atTheDoor = new Date("2026-01-14T12:00:00Z");
    assert.equal(ageAt("2008-01-15", atTheDoor, auckland), 18);
    assert.equal(ageAt("2008-01-15", atTheDoor, "UTC"), 17);
  });

  test("the day before their birthday they are still seventeen", () => {
    assert.equal(
      ageAt("2008-01-15", new Date("2026-01-13T12:00:00Z"), auckland),
      17,
    );
  });
});

describe("isExpired", () => {
  const auckland = "Pacific/Auckland";

  test("an expiry in the past has expired", () => {
    assert.equal(
      isExpired("2024-03-01", new Date("2026-08-17T00:00:00Z"), auckland),
      true,
    );
  });

  test("a card expiring today is still good today", () => {
    assert.equal(
      isExpired("2026-08-17", new Date("2026-08-17T05:00:00Z"), auckland),
      false,
    );
  });

  test("no expiry is not an expired card", () => {
    assert.equal(isExpired(null, new Date(), auckland), false);
  });
});

describe("matchNames", () => {
  test("a middle name on the ID and not on the ticket still matches", () => {
    assert.equal(matchNames("JANE ANNE SMITH", "Jane Smith"), "MATCH");
  });

  test("order and case are irrelevant", () => {
    assert.equal(matchNames("SMITH JANE", "jane smith"), "MATCH");
  });

  test("accents and hyphens don't break a match", () => {
    assert.equal(
      matchNames("RENÉE O'BRIEN-SMITH", "Renee OBrien Smith"),
      "MATCH",
    );
  });

  test("an initial against a first name is worth a glance, not an accusation", () => {
    assert.equal(matchNames("JANE SMITH", "J Smith"), "PARTIAL");
  });

  test("a different person is a mismatch", () => {
    assert.equal(matchNames("JANE SMITH", "Peter Jones"), "MISMATCH");
  });

  test("nothing to compare against is not a mismatch", () => {
    assert.equal(matchNames("JANE SMITH", null), null);
    assert.equal(matchNames(null, "Jane Smith"), null);
  });
});
