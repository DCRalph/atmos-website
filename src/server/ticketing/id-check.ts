import "server-only";

import { createHmac } from "node:crypto";

import {
  type IdDocumentType,
  IdCheckResult,
  type PatronBan,
  type TicketDenyReason,
  TicketScanResult,
} from "~Prisma/client";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  ageAt,
  idDocumentLabel,
  isApprovedEvidenceOfAge,
  isExpired,
  matchNames,
  MINIMUM_ENTRY_AGE,
  type IdParseConfidence,
  type IdParseSource,
  type NameMatch,
  normaliseName,
  type ParsedIdDocument,
  parseIdDocument,
} from "~/lib/ticketing/id-documents";
import { deletePortrait, storePortrait } from "~/server/ticketing/id-photos";

/**
 * The ID decision.
 *
 * `scanTicket` in `./scan.ts` answers "is this ticket good". This answers "is
 * this person good", and the two are deliberately separate: a valid code is not
 * a valid person, and the door has always needed both. The shape here follows
 * that file closely on purpose — one call, one recorded row, an outcome written
 * for somebody reading a phone at arm's length in the dark.
 *
 * Three questions, in the order the door cares about them:
 *
 *  1. **Are they barred.** Outranks everything, including their age. A ban is
 *     Atmos-wide and survives the night it was issued, which is the whole
 *     reason this system exists — a refusal recorded against a *ticket* is
 *     invisible the following weekend.
 *  2. **Are they old enough.** Measured in the venue's timezone, because a door
 *     in Auckland at 1am on somebody's birthday is a door where they are
 *     eighteen and the UTC server thinks otherwise.
 *  3. **Do we know them.** How many times we have seen this document, whether
 *     it matches the ticket they just handed over, and whether it already got
 *     somebody in tonight.
 *
 * Every check is recorded, including the ones that read nothing — a wall of
 * `UNREADABLE` at 11pm is how you learn the torch is broken, which is the same
 * reasoning that makes `scanTicket` log its `NOT_FOUND`s.
 *
 * What this cannot do, and what the UI must never imply it does: detect a good
 * forgery. It reads what is printed and does the arithmetic. The person on the
 * door still has to look at the card.
 */

/** How long a patron record survives its last sighting. */
export const RETENTION_DAYS = 90;

/** Something the door should know that is not the headline verdict. */
export type IdWarning = {
  code:
    | "UNDERAGE"
    | "DOCUMENT_EXPIRED"
    | "NOT_APPROVED_EVIDENCE"
    | "ALREADY_USED_TONIGHT"
    | "NAME_MISMATCH"
    | "NAME_PARTIAL"
    | "PREVIOUSLY_REFUSED"
    | "UNCERTAIN_READING";
  /** Two or three words, for a chip on the verdict screen. */
  label: string;
  /** One sentence, written for a doorway. */
  detail: string;
};

export type StandingBan = {
  reason: TicketDenyReason;
  note: string | null;
  at: Date;
  expiresAt: Date | null;
  bannedByName: string | null;
  /**
   * Whether this ban is against the document in hand, or against somebody with
   * the same name and birthday holding a different one. The second is how a
   * barred person walks back in on a passport, and how an innocent namesake
   * gets stopped — so the door is told which it is looking at.
   */
  matchedOn: "DOCUMENT" | "NAME_AND_DOB";
};

export type IdCheckOutcome = {
  result: IdCheckResult;
  /** Whether the ID is a reason to let them in. Not a reason to keep them out. */
  ok: boolean;
  /** Two or three words, big, at the top. */
  headline: string;
  /** The sentence under it. */
  message: string;
  person: {
    patronId: string;
    fullName: string;
    /** `yyyy-mm-dd`. */
    dateOfBirth: string;
    ageYears: number;
    documentType: IdDocumentType;
    documentNumber: string | null;
    /** `yyyy-mm-dd`, when the document carried one. */
    expiry: string | null;
    expired: boolean;
    /** Where the stored portrait can be fetched from, by a door-authenticated client. */
    photoPath: string | null;
    firstSeenAt: Date;
    /** Checks before this one, across every event. */
    previousChecks: number;
    /** Nights they have been ID-checked at before tonight. */
    previousVisits: number;
    /** Times a door has turned them away, ever. */
    previousRefusals: number;
  } | null;
  /** Everything wrong, not only the worst of it. */
  warnings: IdWarning[];
  ban: StandingBan | null;
  /** Against the ticket this was checked from, when there was one. */
  nameMatch: NameMatch | null;
  ticketName: string | null;
  /** How the document was read, and how much the reading can be trusted. */
  readAs: IdParseSource | "MANUAL";
  confidence: IdParseConfidence;
  /** Readings a human has to confirm before the verdict means anything. */
  ambiguities: string[];
};

/** What the client sends: raw OCR, or fields a staffer typed or corrected. */
export type IdReading =
  | { kind: "ocr"; lines: string[] }
  | {
      kind: "fields";
      documentType: IdDocumentType;
      documentNumber?: string | null;
      fullName: string;
      /** `yyyy-mm-dd`. */
      dateOfBirth: string;
      expiry?: string | null;
    };

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

function identitySecret(): string {
  // Falls back the way the rest of the ticketing secrets do. Rotating it
  // orphans every patron record and every ban attached to one, so it is set
  // once and left alone.
  const secret = env.PATRON_ID_SECRET ?? env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "PATRON_ID_SECRET (or BETTER_AUTH_SECRET) must be set before ID checks can run.",
    );
  }
  return secret;
}

/**
 * The lookup key for a person.
 *
 * A document number is the strong form: it is stable, unique, and the same card
 * always produces the same key. When a staffer has typed a name and a birthday
 * without a number — which happens, on a card the camera could not read — the
 * key falls back to the name and the birthday together. Weaker, and it will
 * miss somebody who spells their name differently next time, but it beats
 * minting a fresh stranger on every check.
 *
 * Hashed rather than stored raw as the key so that the index this is looked up
 * by is not itself a list of document numbers.
 */
function identityHash(document: {
  documentType: IdDocumentType;
  documentNumber: string | null;
  fullName: string;
  dateOfBirth: string;
}): string {
  const material = document.documentNumber
    ? `doc:${document.documentType}:${document.documentNumber.toUpperCase().replace(/\s/g, "")}`
    : `name:${normaliseName(document.fullName)}:${document.dateOfBirth}`;

  return createHmac("sha256", identitySecret())
    .update(material)
    .digest("base64url");
}

/**
 * Whatever the client sent, as a parse result.
 *
 * Camera and keyboard converge here so that everything downstream — the age
 * arithmetic, the ban lookup, the record — cannot tell them apart and cannot
 * therefore treat them differently. A staffer reading the card themselves is
 * the most reliable input this system has; it is also the slowest, which is why
 * it is the fallback rather than the flow.
 */
function readingToParse(reading: IdReading): {
  document: ParsedIdDocument;
  source: IdParseSource | "MANUAL";
  confidence: IdParseConfidence;
  ambiguities: string[];
} {
  if (reading.kind === "ocr") return parseIdDocument(reading.lines);

  return {
    document: {
      documentType: reading.documentType,
      documentNumber: reading.documentNumber ?? null,
      familyName: null,
      givenNames: null,
      fullName: reading.fullName.trim(),
      dateOfBirth: reading.dateOfBirth,
      expiry: reading.expiry ?? null,
      nationality: null,
    },
    source: "MANUAL",
    confidence: "high",
    ambiguities: [],
  };
}

/** `yyyy-mm-dd` → the midnight-UTC `DateTime` the column holds. */
function toDateColumn(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** The column back to `yyyy-mm-dd`. */
function fromDateColumn(value: Date): string {
  return value.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

export async function checkIdentity({
  eventId,
  ticketId,
  reading,
  portrait,
  checkedByUserId,
  deviceLabel,
}: {
  eventId: string;
  ticketId?: string | null;
  reading: IdReading;
  /** The cropped face as base64 JPEG, cropped on the device. */
  portrait?: string | null;
  checkedByUserId: string;
  deviceLabel?: string | null;
}): Promise<IdCheckOutcome> {
  const event = await db.ticketEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: { id: true, isR18: true, timezone: true },
  });

  const parsed = readingToParse(reading);
  const { document } = parsed;
  // Pulled out rather than read off `document` throughout: the awaits below
  // would otherwise widen these back to nullable at every use.
  const fullName = document.fullName;
  const birthDate = document.dateOfBirth;

  // Nothing to check, but the attempt still happened and still gets recorded.
  if (!fullName || !birthDate) {
    await db.idCheck
      .create({
        data: {
          eventId,
          ticketId: ticketId ?? null,
          result: IdCheckResult.UNREADABLE,
          documentType: document.documentType,
          checkedByUserId,
          deviceLabel: deviceLabel ?? null,
        },
      })
      .catch(() => undefined);

    return {
      result: IdCheckResult.UNREADABLE,
      ok: false,
      headline: "Couldn't read it",
      message:
        "Try again with the card flat and the light off the plastic, or type the details in.",
      person: null,
      warnings: [],
      ban: null,
      nameMatch: null,
      ticketName: null,
      readAs: parsed.source,
      confidence: parsed.confidence,
      ambiguities: parsed.ambiguities,
    };
  }

  const now = new Date();
  const ageYears = ageAt(birthDate, now, event.timezone);
  const expired = isExpired(document.expiry, now, event.timezone);
  const documentHash = identityHash({
    documentType: document.documentType,
    documentNumber: document.documentNumber,
    fullName,
    dateOfBirth: birthDate,
  });

  const ticket = ticketId
    ? await db.ticket.findUnique({
        where: { id: ticketId },
        select: { attendeeName: true, order: { select: { buyerName: true } } },
      })
    : null;
  const ticketName = ticket?.attendeeName ?? ticket?.order.buyerName ?? null;
  const nameMatch = matchNames(fullName, ticketName);

  const { patron, previous } = await db.$transaction(async (tx) => {
    const existing = await tx.patron.findUnique({
      where: { documentHash },
      select: { id: true, photoKey: true, checkCount: true },
    });

    // Counted before this check is written, so "previously" means what it says.
    const priorChecks = existing
      ? await tx.idCheck.findMany({
          where: { patronId: existing.id },
          select: { eventId: true, ticketId: true },
          // Bounded: a regular is not going to have thousands, and the counts
          // below are a summary rather than an audit.
          take: 500,
        })
      : [];

    /**
     * Upsert rather than the read above deciding between create and update.
     *
     * Two doors can scan the same person in the same second — a queue splits,
     * somebody walks from one scanner to the other — and both would find
     * nothing and both would insert, with one of them dying on the unique
     * index. An upsert is a single `INSERT … ON CONFLICT DO UPDATE`, so the
     * second one lands as an update instead of an error. The read above stays,
     * because the counts reported back have to be from *before* this check.
     */
    const row = await tx.patron.upsert({
      where: { documentHash },
      create: {
        documentHash,
        documentType: document.documentType,
        documentNumber: document.documentNumber,
        documentExpiry: document.expiry ? toDateColumn(document.expiry) : null,
        fullName,
        givenNames: document.givenNames,
        familyName: document.familyName,
        dateOfBirth: toDateColumn(birthDate),
        firstSeenAt: now,
        lastSeenAt: now,
        checkCount: 1,
        purgeAfter: retentionHorizon(now),
      },
      update: {
        // Refreshed from the document every time: a renewed card carries a new
        // expiry, and a married name is the name they will give next.
        documentType: document.documentType,
        documentNumber: document.documentNumber,
        documentExpiry: document.expiry ? toDateColumn(document.expiry) : null,
        fullName,
        givenNames: document.givenNames,
        familyName: document.familyName,
        dateOfBirth: toDateColumn(birthDate),
        lastSeenAt: now,
        checkCount: { increment: 1 },
        purgeAfter: retentionHorizon(now),
      },
    });

    return {
      patron: row,
      previous: {
        checks: existing?.checkCount ?? 0,
        events: new Set(
          priorChecks
            .map((check) => check.eventId)
            .filter((id) => id !== eventId),
        ).size,
        ticketIds: priorChecks
          .map((check) => check.ticketId)
          .filter((id): id is string => id !== null),
        // One document, two tickets, one night. A re-check of the *same*
        // ticket is just staff scanning twice and is not a flag.
        usedTonight: priorChecks.some(
          (check) =>
            check.eventId === eventId &&
            check.ticketId !== null &&
            check.ticketId !== ticketId,
        ),
      },
    };
  });

  const [ban, previousRefusals] = await Promise.all([
    findStandingBan({
      patronId: patron.id,
      familyName: patron.familyName,
      dateOfBirth: patron.dateOfBirth,
    }),
    countRefusals(previous.ticketIds),
  ]);

  // Kept outside the transaction above on purpose: an S3 write is a network
  // call, and holding a row lock open across one is how a busy door ends up
  // queueing behind a slow bucket.
  const storedPhotoKey = portrait
    ? ((await storePortrait({
        patronId: patron.id,
        base64: portrait,
        replacing: patron.photoKey,
      })) ?? patron.photoKey)
    : patron.photoKey;

  if (storedPhotoKey !== patron.photoKey) {
    await db.patron.update({
      where: { id: patron.id },
      data: { photoKey: storedPhotoKey },
    });
  }

  const approvedEvidence = isApprovedEvidenceOfAge(document.documentType);

  const warnings = collectWarnings({
    isR18: event.isR18,
    ageYears,
    expired,
    approvedEvidence,
    documentType: document.documentType,
    usedTonight: previous.usedTonight,
    nameMatch,
    ticketName,
    previousRefusals,
    ambiguities: parsed.ambiguities,
    confidence: parsed.confidence,
  });

  const result = decide({
    isR18: event.isR18,
    ageYears,
    expired,
    approvedEvidence,
    banned: ban !== null,
    usedTonight: previous.usedTonight,
    nameMatch,
  });

  await db.idCheck.create({
    data: {
      eventId,
      patronId: patron.id,
      ticketId: ticketId ?? null,
      result,
      ageYears,
      documentType: document.documentType,
      checkedByUserId,
      deviceLabel: deviceLabel ?? null,
    },
  });

  // A ban is the one state that outlives the retention window: a record we let
  // expire is a ban that stops working the moment it would matter.
  if (ban) {
    await db.patron.update({
      where: { id: patron.id },
      data: { purgeAfter: null },
    });
  }

  const wording = phrase({ result, ageYears, ban, isR18: event.isR18 });

  return {
    result,
    ok: result === IdCheckResult.PASS,
    headline: wording.headline,
    message: wording.message,
    person: {
      patronId: patron.id,
      fullName: patron.fullName,
      dateOfBirth: fromDateColumn(patron.dateOfBirth),
      ageYears,
      documentType: patron.documentType,
      documentNumber: patron.documentNumber,
      expiry: patron.documentExpiry
        ? fromDateColumn(patron.documentExpiry)
        : null,
      expired,
      photoPath: storedPhotoKey ? patronPhotoPath(patron.id) : null,
      firstSeenAt: patron.firstSeenAt,
      previousChecks: previous.checks,
      previousVisits: previous.events,
      previousRefusals,
    },
    warnings,
    ban,
    nameMatch,
    ticketName,
    readAs: parsed.source,
    confidence: parsed.confidence,
    ambiguities: parsed.ambiguities,
  };
}

/** Where a door-authenticated client can fetch this patron's portrait. */
export function patronPhotoPath(patronId: string): string {
  return `/api/door/patron-photo/${patronId}`;
}

function retentionHorizon(from: Date): Date {
  return new Date(from.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Trying it without doing it
// ---------------------------------------------------------------------------

/** What a read produced, and what it *would* have decided. */
export type IdPreview = {
  document: ParsedIdDocument;
  readAs: IdParseSource | "MANUAL";
  confidence: IdParseConfidence;
  ambiguities: string[];
  /** Null when no date of birth could be read. */
  ageYears: number | null;
  expired: boolean;
  approvedEvidence: boolean;
  /** The verdict a real check would return right now. */
  wouldBe: IdCheckResult;
  warnings: IdWarning[];
  /** Whether this document already has a record, without creating one. */
  known: {
    patronId: string;
    fullName: string;
    checkCount: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
  } | null;
  ban: StandingBan | null;
};

/**
 * Read a document without recording anything.
 *
 * The same relationship `inspectTicket` has to `scanTicket`: every other path
 * in this file writes a row, and this one must not. Somebody testing whether
 * the parser copes with a new licence design should not be creating patron
 * records for a colleague's driver licence, arming a 90-day retention clock on
 * them, or putting rows into the very count the door reads back.
 *
 * The verdict is phrased as what a real check *would* return, computed by the
 * same `decide` the real path uses, so a test can never say one thing and the
 * door another.
 */
export async function previewIdentity({
  reading,
  isR18,
  timeZone,
}: {
  reading: IdReading;
  /** Whether to judge it against an R18 event's rules. */
  isR18: boolean;
  timeZone: string;
}): Promise<IdPreview> {
  const parsed = readingToParse(reading);
  const { document } = parsed;
  const now = new Date();

  const approvedEvidence = isApprovedEvidenceOfAge(document.documentType);
  const ageYears = document.dateOfBirth
    ? ageAt(document.dateOfBirth, now, timeZone)
    : null;
  const expired = isExpired(document.expiry, now, timeZone);

  if (!document.fullName || !document.dateOfBirth || ageYears === null) {
    return {
      document,
      readAs: parsed.source,
      confidence: parsed.confidence,
      ambiguities: parsed.ambiguities,
      ageYears,
      expired,
      approvedEvidence,
      wouldBe: IdCheckResult.UNREADABLE,
      warnings: [],
      known: null,
      ban: null,
    };
  }

  const documentHash = identityHash({
    documentType: document.documentType,
    documentNumber: document.documentNumber,
    fullName: document.fullName,
    dateOfBirth: document.dateOfBirth,
  });

  const existing = await db.patron.findUnique({
    where: { documentHash },
    select: {
      id: true,
      fullName: true,
      checkCount: true,
      firstSeenAt: true,
      lastSeenAt: true,
      familyName: true,
      dateOfBirth: true,
    },
  });

  // Same two-route lookup the real check runs, so a test shows the namesake
  // match as well rather than pretending only the document matters.
  const ban = existing
    ? await findStandingBan({
        patronId: existing.id,
        familyName: existing.familyName,
        dateOfBirth: existing.dateOfBirth,
      })
    : await findStandingBan({
        patronId: null,
        familyName: document.familyName,
        dateOfBirth: toDateColumn(document.dateOfBirth),
      });

  return {
    document,
    readAs: parsed.source,
    confidence: parsed.confidence,
    ambiguities: parsed.ambiguities,
    ageYears,
    expired,
    approvedEvidence,
    wouldBe: decide({
      isR18,
      ageYears,
      expired,
      approvedEvidence,
      banned: ban !== null,
      usedTonight: false,
      nameMatch: null,
    }),
    warnings: collectWarnings({
      isR18,
      ageYears,
      expired,
      approvedEvidence,
      documentType: document.documentType,
      usedTonight: false,
      nameMatch: null,
      ticketName: null,
      previousRefusals: 0,
      ambiguities: parsed.ambiguities,
      confidence: parsed.confidence,
    }),
    known: existing
      ? {
          patronId: existing.id,
          fullName: existing.fullName,
          checkCount: existing.checkCount,
          firstSeenAt: existing.firstSeenAt,
          lastSeenAt: existing.lastSeenAt,
        }
      : null,
    ban,
  };
}

// ---------------------------------------------------------------------------
// The three questions
// ---------------------------------------------------------------------------

/**
 * The ban standing against this person right now, by either route.
 *
 * The document is checked first and is the answer we want. Failing that, a
 * matching surname *and* date of birth is checked too, because the obvious way
 * around a ban held against a driver licence is to come back with a passport.
 * That second match is reported as what it is rather than dressed up as the
 * first — the door is looking at a face and can settle it, but only if it is
 * told which kind of match it has.
 */
async function findStandingBan({
  patronId,
  familyName,
  dateOfBirth,
}: {
  /** Null when nothing has been recorded for this document yet — a preview. */
  patronId: string | null;
  familyName: string | null;
  dateOfBirth: Date;
}): Promise<StandingBan | null> {
  const active = {
    liftedAt: null,
    startsAt: { lte: new Date() },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };

  if (patronId) {
    const own = await db.patronBan.findFirst({
      where: { patronId, ...active },
      orderBy: { createdAt: "desc" },
    });
    if (own) return toStandingBan(own, "DOCUMENT");
  }

  if (!familyName) return null;

  const namesake = await db.patronBan.findFirst({
    where: {
      ...active,
      patron: {
        familyName,
        dateOfBirth,
        ...(patronId ? { id: { not: patronId } } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return namesake ? toStandingBan(namesake, "NAME_AND_DOB") : null;
}

async function toStandingBan(
  ban: PatronBan,
  matchedOn: StandingBan["matchedOn"],
): Promise<StandingBan> {
  // `createdByUserId` is a plain column, like `TicketScan.scannedByUserId`, so
  // the name behind it needs a lookup. It matters: "banned by" is the first
  // thing a manager asks when somebody argues at the door.
  const staff = await db.user.findUnique({
    where: { id: ban.createdByUserId },
    select: { name: true },
  });

  return {
    reason: ban.reason,
    note: ban.note,
    at: ban.startsAt,
    expiresAt: ban.expiresAt,
    bannedByName: staff?.name ?? null,
    matchedOn,
  };
}

/** How many times a door has turned this person away, across every ticket. */
async function countRefusals(ticketIds: string[]): Promise<number> {
  if (ticketIds.length === 0) return 0;
  return db.ticketScan.count({
    where: {
      ticketId: { in: ticketIds },
      result: TicketScanResult.DENIED,
    },
  });
}

/**
 * The single verdict, from the worst thing found.
 *
 * Ordered by what would stop the door letting them in. A ban outranks an age
 * problem because it applies whatever their birthday says; an age problem
 * outranks an expired card because the card being out of date is a paperwork
 * fault and being sixteen is not.
 */
function decide({
  isR18,
  ageYears,
  expired,
  approvedEvidence,
  banned,
  usedTonight,
  nameMatch,
}: {
  isR18: boolean;
  ageYears: number;
  expired: boolean;
  approvedEvidence: boolean;
  banned: boolean;
  usedTonight: boolean;
  nameMatch: NameMatch | null;
}): IdCheckResult {
  if (banned) return IdCheckResult.BANNED;
  if (isR18 && ageYears < MINIMUM_ENTRY_AGE) return IdCheckResult.UNDERAGE;
  // Both of the next two are only failures where age is the question. At an
  // all-ages event an out-of-date card is a curiosity, not a refusal.
  if (isR18 && !approvedEvidence) return IdCheckResult.NOT_APPROVED_EVIDENCE;
  if (isR18 && expired) return IdCheckResult.DOCUMENT_EXPIRED;
  if (usedTonight) return IdCheckResult.ALREADY_USED_TONIGHT;
  if (nameMatch === "MISMATCH") return IdCheckResult.NAME_MISMATCH;
  return IdCheckResult.PASS;
}

/** Everything the door should know, whether or not it drove the verdict. */
function collectWarnings({
  isR18,
  ageYears,
  expired,
  approvedEvidence,
  documentType,
  usedTonight,
  nameMatch,
  ticketName,
  previousRefusals,
  ambiguities,
  confidence,
}: {
  isR18: boolean;
  ageYears: number;
  expired: boolean;
  approvedEvidence: boolean;
  documentType: IdDocumentType;
  usedTonight: boolean;
  nameMatch: NameMatch | null;
  ticketName: string | null;
  previousRefusals: number;
  ambiguities: string[];
  confidence: IdParseConfidence;
}): IdWarning[] {
  const warnings: IdWarning[] = [];

  if (isR18 && ageYears < MINIMUM_ENTRY_AGE) {
    warnings.push({
      code: "UNDERAGE",
      label: `${ageYears} years old`,
      detail: `This is an R18 event and they are ${MINIMUM_ENTRY_AGE - ageYears} year${MINIMUM_ENTRY_AGE - ageYears === 1 ? "" : "s"} short.`,
    });
  }

  if (!approvedEvidence) {
    warnings.push({
      code: "NOT_APPROVED_EVIDENCE",
      label: "Not accepted ID",
      detail: `A ${idDocumentLabel(documentType).toLowerCase()} isn't approved evidence of age here. New Zealand accepts a NZ driver licence, a passport, or a Kiwi Access Card.`,
    });
  }

  if (expired) {
    warnings.push({
      code: "DOCUMENT_EXPIRED",
      label: "Expired ID",
      detail:
        "An expired document isn't approved evidence of age. Their birthday is still readable, so this is a judgement call.",
    });
  }

  if (usedTonight) {
    warnings.push({
      code: "ALREADY_USED_TONIGHT",
      label: "Used tonight",
      detail:
        "This ID was already checked against a different ticket tonight. Somebody may be passing it back out the door.",
    });
  }

  if (nameMatch === "MISMATCH" && ticketName) {
    warnings.push({
      code: "NAME_MISMATCH",
      label: "Not their ticket",
      detail: `The ticket is in the name of ${ticketName}.`,
    });
  }

  if (nameMatch === "PARTIAL" && ticketName) {
    warnings.push({
      code: "NAME_PARTIAL",
      label: "Name is close",
      detail: `Close to the ticket name (${ticketName}) but not the same — worth a look.`,
    });
  }

  if (previousRefusals > 0) {
    warnings.push({
      code: "PREVIOUSLY_REFUSED",
      label:
        previousRefusals === 1
          ? "Refused before"
          : `Refused ${previousRefusals}×`,
      detail:
        "A door has turned this person away before. Not a ban — a manager can look up why.",
    });
  }

  for (const ambiguity of ambiguities) {
    warnings.push({
      code: "UNCERTAIN_READING",
      label: "Check the reading",
      detail: ambiguity,
    });
  }

  if (confidence === "low" && ambiguities.length === 0) {
    warnings.push({
      code: "UNCERTAIN_READING",
      label: "Check the reading",
      detail:
        "This document wasn't recognised outright. Read the details back off the card before acting on them.",
    });
  }

  return warnings;
}

/** The words on the screen. Short, and never containing a time. */
function phrase({
  result,
  ageYears,
  ban,
  isR18,
}: {
  result: IdCheckResult;
  ageYears: number;
  ban: StandingBan | null;
  isR18: boolean;
}): { headline: string; message: string } {
  switch (result) {
    case IdCheckResult.BANNED:
      return {
        headline: "Banned",
        message:
          ban?.matchedOn === "NAME_AND_DOB"
            ? "Somebody with this name and birthday is barred, on a different document. Check the photo before acting."
            : (ban?.note ?? "This person is barred from Atmos events."),
      };
    case IdCheckResult.UNDERAGE:
      return {
        headline: `${ageYears} — underage`,
        message: `R18 event. They are ${MINIMUM_ENTRY_AGE - ageYears} year${MINIMUM_ENTRY_AGE - ageYears === 1 ? "" : "s"} under.`,
      };
    case IdCheckResult.DOCUMENT_EXPIRED:
      return {
        headline: "ID expired",
        message:
          "Not approved evidence of age. They read as old enough, but the card is out of date.",
      };
    case IdCheckResult.NOT_APPROVED_EVIDENCE:
      return {
        headline: "Not accepted ID",
        message:
          "Only a NZ driver licence, a passport or a Kiwi Access Card counts as proof of age here.",
      };
    case IdCheckResult.ALREADY_USED_TONIGHT:
      return {
        headline: "Seen tonight",
        message:
          "This ID has already been checked against another ticket tonight.",
      };
    case IdCheckResult.NAME_MISMATCH:
      return {
        headline: "Different name",
        message: "The ID doesn't match the name on the ticket.",
      };
    case IdCheckResult.UNREADABLE:
      return {
        headline: "Couldn't read it",
        message: "Nothing usable came off the card.",
      };
    default:
      return {
        headline: isR18 ? `${ageYears} — over 18` : "ID checked",
        message: "Nothing standing against them.",
      };
  }
}

// ---------------------------------------------------------------------------
// Bans
// ---------------------------------------------------------------------------

export async function banPatron({
  patronId,
  reason,
  note,
  expiresAt,
  eventId,
  createdByUserId,
}: {
  patronId: string;
  reason: TicketDenyReason;
  note?: string | null;
  /** Null is permanent. */
  expiresAt?: Date | null;
  eventId?: string | null;
  createdByUserId: string;
}): Promise<{ banId: string; patronName: string }> {
  return db.$transaction(async (tx) => {
    const patron = await tx.patron.findUniqueOrThrow({
      where: { id: patronId },
      select: { fullName: true },
    });

    const ban = await tx.patronBan.create({
      data: {
        patronId,
        reason,
        note: note?.trim() ? note.trim() : null,
        expiresAt: expiresAt ?? null,
        eventId: eventId ?? null,
        createdByUserId,
      },
      select: { id: true },
    });

    // Held out of the nightly purge for as long as it stands. A ban whose
    // record expired would be a ban that silently stopped working.
    await tx.patron.update({
      where: { id: patronId },
      data: { purgeAfter: null },
    });

    return { banId: ban.id, patronName: patron.fullName };
  });
}

/**
 * Take a ban back.
 *
 * Append-only, like every other undo in the door: the row stays, `liftedAt`
 * is stamped on it, and the history keeps both halves of the story. The
 * retention clock restarts from here, so lifting a ban is also what lets the
 * record expire normally again.
 */
export async function liftBan({
  banId,
  note,
  liftedByUserId,
}: {
  banId: string;
  note?: string | null;
  liftedByUserId: string;
}): Promise<{ patronId: string; patronName: string }> {
  return db.$transaction(async (tx) => {
    const ban = await tx.patronBan.update({
      where: { id: banId },
      data: {
        liftedAt: new Date(),
        liftedByUserId,
        liftedNote: note?.trim() ? note.trim() : null,
      },
      select: {
        patronId: true,
        patron: { select: { fullName: true, lastSeenAt: true } },
      },
    });

    const stillBanned = await tx.patronBan.count({
      where: {
        patronId: ban.patronId,
        liftedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (stillBanned === 0) {
      await tx.patron.update({
        where: { id: ban.patronId },
        data: { purgeAfter: retentionHorizon(new Date()) },
      });
    }

    return { patronId: ban.patronId, patronName: ban.patron.fullName };
  });
}

// ---------------------------------------------------------------------------
// Looking somebody up
// ---------------------------------------------------------------------------

/** Recent checks are a summary, not an audit — the `IdCheck` table is that. */
const DOSSIER_VISIT_LIMIT = 20;

/**
 * Everything held about one person, for the sheet behind a verdict and for the
 * admin screen.
 *
 * This is also the answer to "what do you have on me". Somebody has the right
 * to ask, and a manager needs to be able to read it back to them without
 * running a query by hand — so every field stored is a field shown here,
 * including the date the record is due to be deleted.
 */
export async function patronDossier(patronId: string): Promise<{
  id: string;
  fullName: string;
  dateOfBirth: string;
  documentType: IdDocumentType;
  documentLabel: string;
  documentNumber: string | null;
  expiry: string | null;
  photoPath: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  checkCount: number;
  /** When this record is deleted. Null while a ban holds it open. */
  purgeAfter: Date | null;
  bans: {
    id: string;
    reason: TicketDenyReason;
    note: string | null;
    startsAt: Date;
    expiresAt: Date | null;
    createdByName: string | null;
    liftedAt: Date | null;
    liftedByName: string | null;
    liftedNote: string | null;
    /** Standing right now, as opposed to lifted or expired. */
    active: boolean;
  }[];
  visits: {
    at: Date;
    result: IdCheckResult;
    eventName: string;
    deviceLabel: string | null;
  }[];
} | null> {
  const patron = await db.patron.findUnique({
    where: { id: patronId },
    include: {
      bans: { orderBy: { createdAt: "desc" } },
      checks: {
        orderBy: { createdAt: "desc" },
        take: DOSSIER_VISIT_LIMIT,
        select: {
          createdAt: true,
          result: true,
          deviceLabel: true,
          event: { select: { name: true } },
        },
      },
    },
  });
  if (!patron) return null;

  // Both `createdByUserId` and `liftedByUserId` are plain columns, following
  // the rest of the door's tables, so the names are one lookup rather than a
  // join — and a ban is unreadable without them.
  const staffIds = [
    ...new Set(
      patron.bans
        .flatMap((ban) => [ban.createdByUserId, ban.liftedByUserId])
        .filter((id): id is string => id !== null),
    ),
  ];
  const staff = await db.user.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(staff.map((user) => [user.id, user.name]));
  const now = new Date();

  return {
    id: patron.id,
    fullName: patron.fullName,
    dateOfBirth: fromDateColumn(patron.dateOfBirth),
    documentType: patron.documentType,
    documentLabel: idDocumentLabel(patron.documentType),
    documentNumber: patron.documentNumber,
    expiry: patron.documentExpiry
      ? fromDateColumn(patron.documentExpiry)
      : null,
    photoPath: patron.photoKey ? patronPhotoPath(patron.id) : null,
    firstSeenAt: patron.firstSeenAt,
    lastSeenAt: patron.lastSeenAt,
    checkCount: patron.checkCount,
    purgeAfter: patron.purgeAfter,
    bans: patron.bans.map((ban) => ({
      id: ban.id,
      reason: ban.reason,
      note: ban.note,
      startsAt: ban.startsAt,
      expiresAt: ban.expiresAt,
      createdByName: nameById.get(ban.createdByUserId) ?? null,
      liftedAt: ban.liftedAt,
      liftedByName: ban.liftedByUserId
        ? (nameById.get(ban.liftedByUserId) ?? null)
        : null,
      liftedNote: ban.liftedNote,
      active:
        ban.liftedAt === null &&
        ban.startsAt <= now &&
        (ban.expiresAt === null || ban.expiresAt > now),
    })),
    visits: patron.checks.map((check) => ({
      at: check.createdAt,
      result: check.result,
      eventName: check.event.name,
      deviceLabel: check.deviceLabel,
    })),
  };
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

/**
 * Delete patron records that have outlived their window.
 *
 * Run nightly from the ticketing sweep. This is the half of the system that
 * makes the rest of it defensible: names, birthdays and faces belonging to
 * members of the public are kept for as long as there is a reason and no
 * longer. The `IdCheck` rows survive with their `patronId` nulled, so the
 * night's counts still add up after the people in them are gone.
 *
 * A ban held against somebody sets `purgeAfter` to null and so is never swept.
 */
export async function purgeExpiredPatrons(limit = 500): Promise<number> {
  const due = await db.patron.findMany({
    where: { purgeAfter: { lt: new Date() } },
    select: { id: true, photoKey: true },
    take: limit,
  });
  if (due.length === 0) return 0;

  // Photos first: a row deleted before its object leaves an orphan nobody will
  // ever find again, which is exactly the thing this function exists to prevent.
  for (const patron of due) {
    await deletePortrait(patron.photoKey);
  }

  const { count } = await db.patron.deleteMany({
    where: { id: { in: due.map((patron) => patron.id) } },
  });
  return count;
}

/**
 * Delete one person's record on request, ban or no ban.
 *
 * The Privacy Act route: somebody asks what is held about them and to have it
 * removed. Kept separate from the sweep because it is a decision somebody makes
 * and therefore something to log.
 */
export async function purgePatron(patronId: string): Promise<void> {
  const patron = await db.patron.findUnique({
    where: { id: patronId },
    select: { photoKey: true },
  });
  if (!patron) return;

  await deletePortrait(patron.photoKey);
  await db.patron.delete({ where: { id: patronId } });
}
