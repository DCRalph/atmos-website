import type { IdDocumentType } from "~Prisma/client";

/**
 * What a door needs to know about an identity document, once something has
 * read it.
 *
 * Deliberately **not** a reader. Reading a licence — turning a photograph of
 * laminated plastic into a name and a birthday — is a specialist job, and the
 * home-grown attempt that used to live here was not good enough to put in front
 * of a queue. That work belongs to an ID SDK; see `docs/ticketing/ID-CHECKS.md`
 * for the options and where the seam is.
 *
 * What survives is everything that was never optical in the first place: which
 * documents New Zealand law accepts, how old somebody is on a given night, and
 * whether the name on a card is the name on a ticket. None of that changes when
 * the reader does, which is exactly why it lives apart from it.
 *
 * Client-safe: pure functions, no imports beyond a Prisma *type*.
 */

/** The purchase age, and so the age an R18 event is asking about. */
export const MINIMUM_ENTRY_AGE = 18;

/**
 * The documents a door accepts, and whether New Zealand accepts each as proof
 * of age.
 *
 * `approvedEvidenceOfAge` is not our policy — it is the Sale and Supply of
 * Alcohol Regulations 2013, which name exactly three things a licensed premises
 * may accept: a New Zealand driver licence, a passport (any country), and the
 * Kiwi Access Card (with the old Hospitality NZ 18+ card still valid). An
 * Australian driver licence is a perfectly genuine document that is *not* on
 * that list, and a door accepting one is the licensee's problem, not the
 * holder's. So the door is told, rather than being left to remember.
 *
 * Shared by the entry form and the router that validates its choice, the same
 * way `DENY_REASONS` is.
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
// Age and expiry
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

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Strip a name to the letters, for comparison only. Never for display. */
export function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
 * So: the same letters in the same order is a match whatever the punctuation;
 * every word of the shorter name appearing in the longer is a match. A shared
 * surname and a shared first initial — "J Smith" against "JANE SMITH" — is
 * `PARTIAL`, worth a glance but not an accusation. Anything else is a real
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
