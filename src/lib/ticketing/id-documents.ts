import type { IdDocumentType } from "~Prisma/client";

/**
 * Reading an identity document from whatever the camera made of it.
 *
 * The devices do the optical work — Apple's Vision framework on the door app,
 * Tesseract in the browser — and both hand back the same thing: a bag of text
 * lines in roughly reading order. Turning that into a name and a date of birth
 * happens *here*, once, on the server, for two reasons that are worth stating
 * because they shaped everything below:
 *
 *  - The phone and the browser must never disagree about what `03/04/1999`
 *    means. One parser, one answer.
 *  - Templates need fixing at 2am when a new licence design turns up. This is a
 *    server deploy; a parser living in the app would be an App Store review.
 *
 * The one rule the whole file obeys: **never guess quietly.** Every reading
 * that could be wrong comes back with the doubt attached, and the door asks a
 * human. A wrong date of birth read confidently is worse than no date at all —
 * one of them turns somebody away for nothing, or lets a fifteen-year-old in.
 *
 * Client-safe: pure functions, no imports beyond a Prisma *type*.
 */

/** How sure the parser is, which decides whether staff must confirm. */
export type IdParseConfidence = "high" | "medium" | "low";

/** Which template read the document, kept so the UI can explain itself. */
export type IdParseSource = "MRZ" | "NZ_LICENCE" | "KIWI_ACCESS" | "GENERIC";

export type ParsedIdDocument = {
  documentType: IdDocumentType;
  documentNumber: string | null;
  familyName: string | null;
  givenNames: string | null;
  /** As it should appear on the door screen: `JANE ANNE SMITH`. */
  fullName: string | null;
  /** `yyyy-mm-dd`, or null when nothing plausible was found. */
  dateOfBirth: string | null;
  /** `yyyy-mm-dd`. Null is normal — most cards' expiry is not worth guessing at. */
  expiry: string | null;
  /** ISO-3166 alpha-3, from an MRZ. Null everywhere else. */
  nationality: string | null;
};

export type IdParseResult = {
  document: ParsedIdDocument;
  source: IdParseSource;
  confidence: IdParseConfidence;
  /**
   * Readings the door has to confirm rather than trust, each phrased for a
   * person standing in a doorway.
   */
  ambiguities: string[];
  /** Enough to run the checks on: a name and a date of birth. */
  usable: boolean;
};

/** The purchase age, and so the age an R18 event is asking about. */
export const MINIMUM_ENTRY_AGE = 18;

/** Nobody at a door is younger than this or older than that. Bounds a guess. */
const PLAUSIBLE_AGE_RANGE = { min: 14, max: 105 } as const;

/**
 * The documents this reads, and whether New Zealand accepts each as proof of
 * age.
 *
 * `approvedEvidenceOfAge` is not our policy — it is the Sale and Supply of
 * Alcohol Regulations 2013, which name exactly three things a licensed premises
 * may accept: a New Zealand driver licence, a passport (any country), and the
 * Kiwi Access Card (with the old Hospitality NZ 18+ card still valid). An
 * Australian driver licence is a perfectly genuine document that is *not* on
 * that list, and a door accepting one is the licensee's problem, not the
 * holder's. So the door is told, rather than being left to remember.
 *
 * Shared by the manual-entry picker and the router that validates its choice,
 * the same way `DENY_REASONS` is.
 */
export const ID_DOCUMENTS = [
  {
    value: "NZ_DRIVER_LICENCE",
    label: "NZ driver licence",
    approvedEvidenceOfAge: true,
  },
  { value: "NZ_PASSPORT", label: "NZ passport", approvedEvidenceOfAge: true },
  {
    value: "FOREIGN_PASSPORT",
    label: "Overseas passport",
    approvedEvidenceOfAge: true,
  },
  {
    value: "KIWI_ACCESS_CARD",
    label: "Kiwi Access Card",
    approvedEvidenceOfAge: true,
  },
  {
    value: "OTHER",
    label: "Something else",
    approvedEvidenceOfAge: false,
  },
] as const satisfies readonly {
  value: IdDocumentType;
  label: string;
  approvedEvidenceOfAge: boolean;
}[];

export const ID_DOCUMENT_TYPES = ID_DOCUMENTS.map(
  (document) => document.value,
) as [IdDocumentType, ...IdDocumentType[]];

const DOCUMENT_LABELS = new Map(
  ID_DOCUMENTS.map((document) => [document.value, document.label]),
);

export function idDocumentLabel(type: IdDocumentType): string {
  return DOCUMENT_LABELS.get(type) ?? "Unknown document";
}

/** Whether this document may be accepted as proof of age on licensed premises. */
export function isApprovedEvidenceOfAge(type: IdDocumentType): boolean {
  return (
    ID_DOCUMENTS.find((document) => document.value === type)
      ?.approvedEvidenceOfAge ?? false
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Read a document from recognised text lines.
 *
 * Templates are tried best-first and the first one that produces a name and a
 * date of birth wins. The order is not stylistic: an MRZ carries its own check
 * digits, so when one parses it is *arithmetically* verified and needs no human
 * confirmation, while everything below it is pattern-matching on text an OCR
 * engine may have mangled.
 */
export function parseIdDocument(rawLines: readonly string[]): IdParseResult {
  const lines = tidy(rawLines);

  const mrz = parseMrz(lines);
  if (mrz) return mrz;

  const licence = parseNzDriverLicence(lines);
  if (licence) return licence;

  const kiwiAccess = parseKiwiAccessCard(lines);
  if (kiwiAccess) return kiwiAccess;

  return parseGeneric(lines);
}

/**
 * Normalise the raw lines without throwing anything away.
 *
 * Vision and Tesseract disagree about whitespace, and Tesseract in particular
 * emits empty lines and stray single characters where the card has a logo. The
 * collapsing here is deliberately gentle: uppercasing is safe because no
 * template below is case-sensitive, but nothing is *dropped* except blanks,
 * since a line that looks like noise to us may be the licence number.
 */
function tidy(rawLines: readonly string[]): string[] {
  return rawLines
    .flatMap((line) => line.split(/[\r\n]+/))
    .map((line) => line.replace(/\s+/g, " ").trim().toUpperCase())
    .filter((line) => line.length > 0);
}

// ---------------------------------------------------------------------------
// Machine-readable zones — passports, and the ID-1 cards that carry one
// ---------------------------------------------------------------------------

/**
 * The `<` filler is the giveaway. Real text almost never contains a run of
 * them, so this finds candidate MRZ lines without needing to know the format
 * first.
 */
const MRZ_LINE = /^[A-Z0-9<]{28,50}$/;

/**
 * ICAO 9303 check digit: weights cycle 7, 3, 1; letters are 10–35; `<` is zero.
 */
function mrzCheckDigit(value: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    const digit =
      char === "<"
        ? 0
        : char >= "0" && char <= "9"
          ? char.charCodeAt(0) - 48
          : char >= "A" && char <= "Z"
            ? char.charCodeAt(0) - 55
            : 0;
    sum += digit * weights[index % 3]!;
  }
  return sum % 10;
}

/**
 * Undo the substitutions OCR makes in a field that can only hold digits.
 *
 * This is the difference between an MRZ that verifies and one that doesn't:
 * `O` for `0` in a date of birth is the single most common misread, and
 * without this repair a perfectly good passport falls through to the guessy
 * templates below.
 */
function digitsOnly(value: string): string {
  return value
    .replace(/O|Q|D/g, "0")
    .replace(/I|L/g, "1")
    .replace(/Z/g, "2")
    .replace(/S/g, "5")
    .replace(/G/g, "6")
    .replace(/B/g, "8");
}

/** The mirror repair, for a field that can only hold letters. */
function lettersOnly(value: string): string {
  return value
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/2/g, "Z")
    .replace(/5/g, "S")
    .replace(/8/g, "B");
}

/**
 * `YYMMDD` from an MRZ, to `yyyy-mm-dd`.
 *
 * The century is inferred: a birth year cannot be in the future, so anything
 * past this year is last century. Expiry dates are always this one — a passport
 * expiring in 1998 is not something a door will ever be handed.
 */
function mrzDate(value: string, kind: "birth" | "expiry"): string | null {
  const digits = digitsOnly(value);
  if (!/^\d{6}$/.test(digits)) return null;

  const yy = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));

  const currentYy = new Date().getUTCFullYear() % 100;
  const year =
    kind === "birth" ? (yy <= currentYy ? 2000 + yy : 1900 + yy) : 2000 + yy;

  return isoDate(year, month, day);
}

/** `SMITH<<JANE<ANNE<<<` → the two halves of a name. */
function mrzNames(field: string): { familyName: string; givenNames: string } {
  const [family = "", given = ""] = field.split("<<");
  return {
    familyName: mrzWords(family),
    givenNames: mrzWords(given),
  };
}

function mrzWords(value: string): string {
  return lettersOnly(value).replace(/</g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parse any of the three ICAO layouts.
 *
 * TD3 is the passport everyone has seen; TD1 is the ID-1 card (three lines of
 * thirty) and TD2 the in-between size. All three are handled because "which
 * shape of MRZ is this" is not a question the door should have to answer, and
 * the check digits make a wrong guess self-detecting anyway.
 */
function parseMrz(lines: readonly string[]): IdParseResult | null {
  const candidates = lines
    .map((line) => line.replace(/\s/g, ""))
    .filter((line) => MRZ_LINE.test(line) && line.includes("<"));

  for (let index = 0; index < candidates.length; index += 1) {
    const first = candidates[index]!;
    const second = candidates[index + 1];
    const third = candidates[index + 2];

    if (first.length >= 42 && second && second.length >= 42) {
      const parsed = parseTd3(first, second);
      if (parsed) return parsed;
    }
    if (
      first.length >= 28 &&
      first.length <= 32 &&
      second &&
      third &&
      second.length >= 28
    ) {
      const parsed = parseTd1(first, second, third);
      if (parsed) return parsed;
    }
    if (first.length >= 34 && first.length <= 38 && second) {
      const parsed = parseTd2(first, second);
      if (parsed) return parsed;
    }
  }

  return null;
}

/**
 * Build the result shared by all three MRZ layouts.
 *
 * `checksPassed` is what separates a verified read from a hopeful one. A single
 * failed check digit does not throw the read away — the other fields may still
 * be right, and staff can confirm — but it does drop the confidence, which is
 * what makes the UI stop and ask.
 */
function mrzResult(parts: {
  documentType: IdDocumentType;
  documentNumber: string;
  familyName: string;
  givenNames: string;
  dateOfBirth: string;
  expiry: string | null;
  nationality: string | null;
  checksPassed: boolean;
}): IdParseResult {
  const fullName = joinName(parts.givenNames, parts.familyName);

  return {
    document: {
      documentType: parts.documentType,
      documentNumber: parts.documentNumber || null,
      familyName: parts.familyName || null,
      givenNames: parts.givenNames || null,
      fullName,
      dateOfBirth: parts.dateOfBirth,
      expiry: parts.expiry,
      nationality: parts.nationality,
    },
    source: "MRZ",
    confidence: parts.checksPassed ? "high" : "medium",
    ambiguities: parts.checksPassed
      ? []
      : [
          "The passport's own check digits didn't add up — confirm the details.",
        ],
    usable: Boolean(fullName && parts.dateOfBirth),
  };
}

/**
 * One MRZ field, repaired if it can only hold digits, and its check digit.
 *
 * The repair has to happen *before* the arithmetic rather than after. A date of
 * birth misread as `9OO115` fails its own check digit; `900115` passes it. In
 * this order the check digit is what confirms the repair was right — a wrong
 * substitution simply fails here — which is the difference between a verified
 * read and a hopeful one.
 */
function verifiedField(
  field: string,
  checkChar: string | undefined,
  kind: "digits" | "mixed",
): { value: string; passed: boolean } {
  // Document numbers are alphanumeric, so there is no safe repair for them:
  // `S` really might be an `S`.
  const value = kind === "digits" ? digitsOnly(field) : field;
  return {
    value,
    passed: mrzCheckDigit(value) === Number(digitsOnly(checkChar ?? "")),
  };
}

/** The passport book: two lines of 44. */
function parseTd3(line1: string, line2: string): IdParseResult | null {
  if (!line1.startsWith("P")) return null;

  const number = verifiedField(line2.slice(0, 9), line2[9], "mixed");
  const birth = verifiedField(line2.slice(13, 19), line2[19], "digits");
  const expires = verifiedField(line2.slice(21, 27), line2[27], "digits");

  const dateOfBirth = mrzDate(birth.value, "birth");
  if (!dateOfBirth) return null;

  const nationality = lettersOnly(line2.slice(10, 13));
  const { familyName, givenNames } = mrzNames(line1.slice(5));

  return mrzResult({
    documentType: nationality === "NZL" ? "NZ_PASSPORT" : "FOREIGN_PASSPORT",
    documentNumber: number.value.replace(/</g, ""),
    familyName,
    givenNames,
    dateOfBirth,
    expiry: mrzDate(expires.value, "expiry"),
    nationality,
    checksPassed: number.passed && birth.passed && expires.passed,
  });
}

/** The ID-1 card: three lines of 30. */
function parseTd1(
  line1: string,
  line2: string,
  line3: string,
): IdParseResult | null {
  const number = verifiedField(line1.slice(5, 14), line1[14], "mixed");
  const birth = verifiedField(line2.slice(0, 6), line2[6], "digits");
  const expires = verifiedField(line2.slice(8, 14), line2[14], "digits");

  const dateOfBirth = mrzDate(birth.value, "birth");
  if (!dateOfBirth) return null;

  const { familyName, givenNames } = mrzNames(line3);

  return mrzResult({
    documentType: "OTHER",
    documentNumber: number.value.replace(/</g, ""),
    familyName,
    givenNames,
    dateOfBirth,
    expiry: mrzDate(expires.value, "expiry"),
    nationality: lettersOnly(line2.slice(15, 18)),
    checksPassed: number.passed && birth.passed && expires.passed,
  });
}

/** The in-between size: two lines of 36. */
function parseTd2(line1: string, line2: string): IdParseResult | null {
  const number = verifiedField(line2.slice(0, 9), line2[9], "mixed");
  const birth = verifiedField(line2.slice(13, 19), line2[19], "digits");
  const expires = verifiedField(line2.slice(21, 27), line2[27], "digits");

  const dateOfBirth = mrzDate(birth.value, "birth");
  if (!dateOfBirth) return null;

  const nationality = lettersOnly(line2.slice(10, 13));
  const { familyName, givenNames } = mrzNames(line1.slice(5));

  return mrzResult({
    documentType: !line1.startsWith("P")
      ? "OTHER"
      : nationality === "NZL"
        ? "NZ_PASSPORT"
        : "FOREIGN_PASSPORT",
    documentNumber: number.value.replace(/</g, ""),
    familyName,
    givenNames,
    dateOfBirth,
    expiry: mrzDate(expires.value, "expiry"),
    nationality,
    checksPassed: number.passed && birth.passed && expires.passed,
  });
}

// ---------------------------------------------------------------------------
// The New Zealand driver licence
// ---------------------------------------------------------------------------

/** Two letters and six digits, e.g. `AB123456`. */
const NZ_LICENCE_NUMBER = /\b([A-Z]{2}\d{6})\b/;

/**
 * The numbered fields the licence borrows from the European convention:
 * 1 surname, 2 first names, 3 date of birth, 4a issued, 4b expires, 5 the card
 * number. The label may sit on its own line or share one with its value
 * depending on how the OCR engine chopped the card up, so both are handled.
 */
function fieldAfterLabel(
  lines: readonly string[],
  label: RegExp,
): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const match = label.exec(line);
    if (!match) continue;

    const inline = line.slice(match.index + match[0].length).trim();
    if (inline.length > 0) return inline;

    const next = lines[index + 1];
    if (next && !/^\d[A-Z]?[.\s]/.test(next)) return next.trim();
  }
  return null;
}

function looksLikeNzLicence(lines: readonly string[]): boolean {
  const text = lines.join(" ");
  return (
    (text.includes("DRIVER") && text.includes("LICEN")) ||
    (/\b4A\b/.test(text) && /\b4B\b/.test(text)) ||
    (NZ_LICENCE_NUMBER.test(text) && text.includes("NEW ZEALAND"))
  );
}

function parseNzDriverLicence(lines: readonly string[]): IdParseResult | null {
  if (!looksLikeNzLicence(lines)) return null;

  const ambiguities: string[] = [];

  const familyName = cleanNameLine(fieldAfterLabel(lines, /^1[.:\s]/));
  const givenNames = cleanNameLine(fieldAfterLabel(lines, /^2[.:\s]/));
  const birthField = fieldAfterLabel(lines, /^3[.:\s]/);
  const expiryField = fieldAfterLabel(lines, /^4B[.:\s]/);
  const numberField = fieldAfterLabel(lines, /^5[.:\s]/);

  const birth = birthField ? readDate(birthField) : null;
  if (birth?.ambiguous) {
    const [year, month, day] = birth.iso.split("-");
    ambiguities.push(
      `Read the date of birth as ${day}/${month}/${year} (day/month) — confirm it isn't ${month}/${day}/${year}.`,
    );
  }
  // Fall back to a whole-card sweep. A licence whose numbered labels didn't
  // survive the OCR still usually gives up its dates, and the oldest plausible
  // one is the date of birth.
  const dateOfBirth =
    birth?.iso ?? oldestPlausibleBirthDate(lines, ambiguities);
  if (!dateOfBirth) return null;

  const documentNumber =
    NZ_LICENCE_NUMBER.exec(numberField ?? "")?.[1] ??
    NZ_LICENCE_NUMBER.exec(lines.join(" "))?.[1] ??
    null;

  const names = resolveNames(familyName, givenNames, lines);
  const fullName = joinName(names.givenNames, names.familyName);

  return {
    document: {
      documentType: "NZ_DRIVER_LICENCE",
      documentNumber,
      familyName: names.familyName,
      givenNames: names.givenNames,
      fullName,
      dateOfBirth,
      expiry: expiryField ? (readDate(expiryField)?.iso ?? null) : null,
      nationality: null,
    },
    source: "NZ_LICENCE",
    // Never "high": there is no checksum on this card. Even a clean read is a
    // read, and the door confirms it against the face in front of them.
    confidence: names.confident && birth ? "medium" : "low",
    ambiguities,
    usable: Boolean(fullName && dateOfBirth),
  };
}

// ---------------------------------------------------------------------------
// The Kiwi Access Card
// ---------------------------------------------------------------------------

function parseKiwiAccessCard(lines: readonly string[]): IdParseResult | null {
  const text = lines.join(" ");
  if (!text.includes("KIWI ACCESS") && !/\b18\s*\+/.test(text)) return null;

  const ambiguities: string[] = [];
  const dateOfBirth = oldestPlausibleBirthDate(lines, ambiguities);
  if (!dateOfBirth) return null;

  const names = resolveNames(null, null, lines);
  const fullName = joinName(names.givenNames, names.familyName);

  return {
    document: {
      documentType: "KIWI_ACCESS_CARD",
      documentNumber: null,
      familyName: names.familyName,
      givenNames: names.givenNames,
      fullName,
      dateOfBirth,
      expiry: null,
      nationality: null,
    },
    source: "KIWI_ACCESS",
    confidence: "low",
    ambiguities,
    usable: Boolean(fullName && dateOfBirth),
  };
}

// ---------------------------------------------------------------------------
// Last resort
// ---------------------------------------------------------------------------

/**
 * Anything else: a foreign licence, a card we have no template for, or a photo
 * of an NZ licence that came out too badly to recognise as one.
 *
 * Always returns something, and always at low confidence, because the whole
 * method is inference — the oldest plausible date is the birthday, the longest
 * run of letters is the name. That is good enough to *offer* to a staffer for
 * confirmation and nowhere near good enough to act on unread, which is exactly
 * what `confidence: "low"` tells the UI.
 */
function parseGeneric(lines: readonly string[]): IdParseResult {
  const ambiguities: string[] = [];
  const dateOfBirth = oldestPlausibleBirthDate(lines, ambiguities);
  const names = resolveNames(null, null, lines);
  const fullName = joinName(names.givenNames, names.familyName);

  if (dateOfBirth && fullName) {
    ambiguities.push(
      "This document wasn't recognised — check every field before admitting.",
    );
  }

  return {
    document: {
      documentType: "OTHER",
      documentNumber: null,
      familyName: names.familyName,
      givenNames: names.givenNames,
      fullName,
      dateOfBirth,
      expiry: null,
      nationality: null,
    },
    source: "GENERIC",
    confidence: "low",
    ambiguities,
    usable: Boolean(fullName && dateOfBirth),
  };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  SEPT: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const NUMERIC_DATE = /\b(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})\b/g;
const NAMED_DATE = /\b(\d{1,2})[.\-\s]?([A-Z]{3,4})[.\-\s]?(\d{4})\b/g;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

/** One date found in the text, and whether its day/month order is settled. */
type DateReading = { iso: string; ambiguous: boolean };

/**
 * Every date in a piece of text, in no particular order.
 *
 * New Zealand writes `DD/MM/YYYY`, and that is what a bare numeric date is
 * taken to be — but when both numbers are 12 or less the reading is genuinely
 * ambiguous with the American order, and a card issued overseas may well be in
 * it. Rather than pick and hope, the doubt travels with the reading and the
 * door confirms it. `03/04/1999` is either the 3rd of April or the 4th of
 * March, and on the wrong side of a birthday that is the difference between
 * admitting somebody and turning them away.
 *
 * A written month settles the order by itself, which is why `12 MAR 1999` is
 * never flagged and `12/03/1999` always is.
 */
function readDates(text: string): DateReading[] {
  const readings: DateReading[] = [];
  const add = (iso: string | null, ambiguous: boolean) => {
    if (iso) readings.push({ iso, ambiguous });
  };

  for (const match of text.matchAll(NAMED_DATE)) {
    const month = MONTHS[match[2]!];
    if (month) add(isoDate(Number(match[3]), month, Number(match[1])), false);
  }

  for (const match of text.matchAll(ISO_DATE)) {
    add(isoDate(Number(match[1]), Number(match[2]), Number(match[3])), false);
  }

  for (const match of text.matchAll(NUMERIC_DATE)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);

    // Above twelve it can only be a day, so the order settles itself.
    if (first > 12) add(isoDate(year, second, first), false);
    else if (second > 12) add(isoDate(year, first, second), false);
    else add(isoDate(year, second, first), true);
  }

  return readings;
}

/** The first date in a labelled field — `3. 12 MAR 1999`. */
function readDate(text: string): DateReading | null {
  return readDates(text)[0] ?? null;
}

/**
 * Sweep every line for dates and take the oldest one that could be a birthday.
 *
 * Cards carry issue dates, expiry dates and sometimes a card-version date, and
 * all of them are recent. A date of birth is the only one that lands decades
 * ago, so "oldest, within a plausible human lifetime" identifies it without
 * needing to know which labelled field it came from — which is what makes this
 * the fallback when the labels themselves didn't survive the camera.
 */
function oldestPlausibleBirthDate(
  lines: readonly string[],
  ambiguities: string[],
): string | null {
  const today = isoFromDate(new Date());

  const plausible = lines
    .flatMap((line) => readDates(line))
    .filter((reading) => {
      const age = yearsBetween(reading.iso, today);
      return age >= PLAUSIBLE_AGE_RANGE.min && age <= PLAUSIBLE_AGE_RANGE.max;
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const chosen = plausible[0];
  if (!chosen) return null;

  if (chosen.ambiguous) {
    const [year, month, day] = chosen.iso.split("-");
    ambiguities.push(
      `Read the date of birth as ${day}/${month}/${year} (day/month) — confirm it isn't ${month}/${day}/${year}.`,
    );
  }
  // Distinct dates, not distinct readings: the same birthday found twice by two
  // patterns is agreement, not confusion.
  if (new Set(plausible.map((reading) => reading.iso)).size > 1) {
    ambiguities.push(
      "More than one date on this card could be a birthday — check the one shown.",
    );
  }

  return chosen.iso;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  // Reject the 31st of February and friends: `Date` would roll them forward
  // into March and hand back a date that was never on the card.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Words printed on cards that are never part of somebody's name. */
const NOT_A_NAME = new Set([
  "NEW ZEALAND",
  "NEW ZEALAND DRIVER LICENCE",
  "DRIVER LICENCE",
  "DRIVERS LICENCE",
  "DRIVER LICENSE",
  "AOTEAROA",
  "KIWI ACCESS CARD",
  "KIWI ACCESS",
  "PASSPORT",
  "IDENTITY CARD",
  "SURNAME",
  "GIVEN NAMES",
  "FIRST NAMES",
  "DATE OF BIRTH",
  "SIGNATURE",
  "CONDITIONS",
  "CLASSES",
  "DONOR",
  "ORGAN DONOR",
  "EXPIRES",
  "ISSUED",
  "CARD VERSION",
  "ADDRESS",
]);

const NAME_LINE = /^[A-Z][A-Z '\-.]{1,40}$/;

function cleanNameLine(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[^A-Z '\-.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2) return null;
  if (NOT_A_NAME.has(cleaned)) return null;
  return cleaned;
}

/**
 * Settle on a surname and given names.
 *
 * When the labelled fields came through, they are believed. When they didn't,
 * the card is scanned for lines that look like a name — and the *first* such
 * line is taken as the surname, because every document this file targets prints
 * the surname above the given names.
 */
function resolveNames(
  familyName: string | null,
  givenNames: string | null,
  lines: readonly string[],
): {
  familyName: string | null;
  givenNames: string | null;
  confident: boolean;
} {
  if (familyName && givenNames) {
    return { familyName, givenNames, confident: true };
  }

  const candidates = lines
    .map((line) => cleanNameLine(line))
    .filter((line): line is string => line !== null && NAME_LINE.test(line));

  return {
    familyName: familyName ?? candidates[0] ?? null,
    givenNames: givenNames ?? candidates[1] ?? null,
    confident: false,
  };
}

function joinName(
  givenNames: string | null,
  familyName: string | null,
): string | null {
  const joined = [givenNames, familyName].filter(Boolean).join(" ").trim();
  return joined.length > 0 ? joined : null;
}

// ---------------------------------------------------------------------------
// Age, expiry, and matching a name to a ticket
// ---------------------------------------------------------------------------

/**
 * Today's date where the event is, as `yyyy-mm-dd`.
 *
 * A door in Auckland at 1am on somebody's birthday is a door where they are
 * eighteen. The server is in UTC, where it is still yesterday and they are not.
 * `en-CA` is used because it formats as ISO, which is the only reason to reach
 * for that locale anywhere.
 */
export function localDateIn(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function isoFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Whole years between two `yyyy-mm-dd` dates. Calendar arithmetic, not division. */
function yearsBetween(from: string, to: string): number {
  const [fromYear = 0, fromMonth = 0, fromDay = 0] = from
    .split("-")
    .map(Number);
  const [toYear = 0, toMonth = 0, toDay = 0] = to.split("-").map(Number);

  let years = toYear - fromYear;
  if (toMonth < fromMonth || (toMonth === fromMonth && toDay < fromDay)) {
    years -= 1;
  }
  return years;
}

/** How old they are at the door, in the venue's timezone. */
export function ageAt(dateOfBirth: string, at: Date, timeZone: string): number {
  return yearsBetween(dateOfBirth, localDateIn(at, timeZone));
}

/** Whether the document has expired, by the venue's calendar. */
export function isExpired(
  expiry: string | null,
  at: Date,
  timeZone: string,
): boolean {
  if (!expiry) return false;
  return expiry < localDateIn(at, timeZone);
}

/** Strip a name to the letters, for comparison only. Never for display. */
export function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type NameMatch = "MATCH" | "PARTIAL" | "MISMATCH";

/**
 * Does the name on the ID belong to the name on the ticket?
 *
 * Deliberately generous, because the alternative is worse. Tickets are bought
 * in a hurry on a phone: "Jane Smith" for a passport reading "JANE ANNE MARY
 * SMITH", a middle name dropped, a hyphen missing. Flagging all of those as
 * mismatches would train staff to tap past the warning, and then it catches
 * nothing at all.
 *
 * So: every word of the shorter name appearing in the longer is a match. A
 * shared surname and a shared first initial — "J Smith" against "JANE SMITH" —
 * is `PARTIAL`, worth a glance but not an accusation. Anything else is a real
 * mismatch, and by then it usually is one.
 */
export function matchNames(
  idName: string | null,
  ticketName: string | null,
): NameMatch | null {
  if (!idName || !ticketName) return null;

  const idWords = normaliseName(idName).split(" ").filter(Boolean);
  const ticketWords = normaliseName(ticketName).split(" ").filter(Boolean);
  if (idWords.length === 0 || ticketWords.length === 0) return null;

  // Same letters in the same order is the same name, whatever the card did
  // with hyphens and apostrophes: `O'BRIEN-SMITH` and `OBrien Smith` differ
  // only in punctuation the person typing a ticket had no reason to reproduce.
  if (idWords.join("") === ticketWords.join("")) return "MATCH";

  const idSet = new Set(idWords);
  const ticketSet = new Set(ticketWords);

  const ticketInId = ticketWords.every((word) => idSet.has(word));
  const idInTicket = idWords.every((word) => ticketSet.has(word));
  if (ticketInId || idInTicket) return "MATCH";

  const sharedSurname =
    idWords[idWords.length - 1] === ticketWords[ticketWords.length - 1];
  const sharedInitial = idWords[0]?.[0] === ticketWords[0]?.[0];
  if (sharedSurname && sharedInitial) return "PARTIAL";

  return "MISMATCH";
}
