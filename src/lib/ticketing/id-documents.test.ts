import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { ageAt, isExpired, matchNames, parseIdDocument } from "./id-documents";

/**
 * The parser's job is to be right or to say it isn't sure. These tests are
 * mostly about the second half — the cases where a confident wrong answer would
 * turn somebody away at a door, or let a fifteen-year-old past one.
 */

/** A real TD3 passport MRZ, check digits and all. Jane Anne Smith, 15/01/1990. */
const PASSPORT_MRZ = [
  "P<NZLSMITH<<JANE<ANNE<<<<<<<<<<<<<<<<<<<<<<<",
  "LA12345675NZL9001158M3001019<<<<<<<<<<<<<<06",
];

/** An NZ driver licence as Vision typically returns it: labels, then values. */
const NZ_LICENCE = [
  "NEW ZEALAND",
  "DRIVER LICENCE",
  "1. SMITH",
  "2. JANE ANNE",
  "3. 15 JAN 1990",
  "4a. 01.03.2020",
  "4b. 01.03.2030",
  "5. AB123456",
  "9. C1 D",
];

describe("passport MRZ", () => {
  test("reads the whole document and trusts it", () => {
    const result = parseIdDocument(PASSPORT_MRZ);

    assert.equal(result.source, "MRZ");
    assert.equal(result.confidence, "high");
    assert.equal(result.usable, true);
    assert.deepEqual(result.ambiguities, []);
    assert.equal(result.document.documentType, "NZ_PASSPORT");
    assert.equal(result.document.documentNumber, "LA1234567");
    assert.equal(result.document.familyName, "SMITH");
    assert.equal(result.document.givenNames, "JANE ANNE");
    assert.equal(result.document.fullName, "JANE ANNE SMITH");
    assert.equal(result.document.dateOfBirth, "1990-01-15");
    assert.equal(result.document.expiry, "2030-01-01");
    assert.equal(result.document.nationality, "NZL");
  });

  test("a foreign passport is told apart from a New Zealand one", () => {
    const result = parseIdDocument([
      PASSPORT_MRZ[0]!.replace("NZL", "AUS"),
      PASSPORT_MRZ[1]!.replace("NZL", "AUS"),
    ]);
    assert.equal(result.document.documentType, "FOREIGN_PASSPORT");
  });

  test("repairs the letter-for-digit misreads OCR makes", () => {
    // `O` for `0` in the date of birth, which is the most common one by far.
    const mangled = [
      PASSPORT_MRZ[0]!,
      PASSPORT_MRZ[1]!.replace("9001158", "9OO1158"),
    ];
    const result = parseIdDocument(mangled);

    assert.equal(result.document.dateOfBirth, "1990-01-15");
    assert.equal(result.confidence, "high");
  });

  test("a broken check digit still reads, but stops being trusted", () => {
    const tampered = [
      PASSPORT_MRZ[0]!,
      // Move the birthday a decade without fixing the check digit — exactly
      // what a doctored MRZ looks like.
      PASSPORT_MRZ[1]!.replace("9001158", "8001158"),
    ];
    const result = parseIdDocument(tampered);

    assert.equal(result.source, "MRZ");
    assert.equal(result.confidence, "medium");
    assert.equal(result.ambiguities.length, 1);
    assert.match(result.ambiguities[0]!, /check digits/);
  });
});

describe("NZ driver licence", () => {
  test("reads the numbered fields", () => {
    const result = parseIdDocument(NZ_LICENCE);

    assert.equal(result.source, "NZ_LICENCE");
    assert.equal(result.usable, true);
    assert.equal(result.document.documentType, "NZ_DRIVER_LICENCE");
    assert.equal(result.document.familyName, "SMITH");
    assert.equal(result.document.givenNames, "JANE ANNE");
    assert.equal(result.document.dateOfBirth, "1990-01-15");
    assert.equal(result.document.expiry, "2030-03-01");
    assert.equal(result.document.documentNumber, "AB123456");
  });

  test("is never trusted the way an MRZ is — there is no checksum on the card", () => {
    assert.notEqual(parseIdDocument(NZ_LICENCE).confidence, "high");
  });

  test("finds the birthday when the labels didn't survive the camera", () => {
    const result = parseIdDocument([
      "NEW ZEALAND DRIVER LICENCE",
      "SMITH",
      "JANE ANNE",
      "15 JAN 1990",
      "01.03.2020",
      "01.03.2030",
      "AB123456",
    ]);

    // The oldest plausible date wins: issue and expiry are both recent.
    assert.equal(result.document.dateOfBirth, "1990-01-15");
    assert.equal(result.document.fullName, "JANE ANNE SMITH");
    assert.equal(result.document.documentNumber, "AB123456");
  });

  test("the card's own words are never mistaken for a name", () => {
    const result = parseIdDocument(NZ_LICENCE);
    assert.notEqual(result.document.familyName, "NEW ZEALAND");
    assert.notEqual(result.document.givenNames, "DRIVER LICENCE");
  });
});

describe("ambiguous dates", () => {
  test("a numeric day under 13 is flagged rather than guessed", () => {
    const result = parseIdDocument([
      "NEW ZEALAND DRIVER LICENCE",
      "1. SMITH",
      "2. JANE",
      "3. 03/04/1999",
    ]);

    // Read the New Zealand way, but the doubt goes to the door.
    assert.equal(result.document.dateOfBirth, "1999-04-03");
    assert.equal(result.ambiguities.length, 1);
    assert.match(result.ambiguities[0]!, /03\/04\/1999/);
    assert.match(result.ambiguities[0]!, /04\/03\/1999/);
  });

  test("a day over 12 settles the order by itself", () => {
    const result = parseIdDocument([
      "NEW ZEALAND DRIVER LICENCE",
      "1. SMITH",
      "2. JANE",
      "3. 23/04/1999",
    ]);

    assert.equal(result.document.dateOfBirth, "1999-04-23");
    assert.deepEqual(result.ambiguities, []);
  });

  test("a written month is never ambiguous", () => {
    const result = parseIdDocument([
      "NEW ZEALAND DRIVER LICENCE",
      "1. SMITH",
      "2. JANE",
      "3. 03 APR 1999",
    ]);

    assert.equal(result.document.dateOfBirth, "1999-04-03");
    assert.deepEqual(result.ambiguities, []);
  });

  test("an impossible date is refused rather than rolled into the next month", () => {
    const result = parseIdDocument(["31/02/1999", "SMITH", "JANE"]);
    assert.equal(result.document.dateOfBirth, null);
    assert.equal(result.usable, false);
  });
});

describe("unreadable input", () => {
  test("nothing usable comes back as nothing, not as a guess", () => {
    const result = parseIdDocument(["", "   ", "|||", "8"]);
    assert.equal(result.usable, false);
    assert.equal(result.document.dateOfBirth, null);
  });
});

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
