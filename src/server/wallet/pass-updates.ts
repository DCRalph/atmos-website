import {
  resolvePassTheme,
  type PassThemeFields,
} from "~/lib/ticketing/pass-theme";

/**
 * Apple's `passesUpdatedSince` / `lastUpdated` tags are opaque strings. We
 * emit millisecond timestamps so an event edit in the same second as a prior
 * ticket write still looks newer. Devices that already stored the old
 * unix-seconds tags keep working: those values are 10 digits, milliseconds
 * are 13.
 */
const MILLISECOND_TAG_THRESHOLD = 1_000_000_000_000;

export function parsePassesUpdatedSince(tag: string | null): Date | null {
  if (!tag) return null;
  const value = Number(tag);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(value < MILLISECOND_TAG_THRESHOLD ? value * 1000 : value);
}

export function formatPassUpdateTag(date: Date): string {
  return String(date.getTime());
}

/** The pass is as fresh as whichever of the ticket or its event changed last. */
export function passUpdatedAt(
  ticketUpdatedAt: Date,
  eventUpdatedAt: Date,
): Date {
  return ticketUpdatedAt.getTime() >= eventUpdatedAt.getTime()
    ? ticketUpdatedAt
    : eventUpdatedAt;
}

export function isPassNewerThan(updatedAt: Date, since: Date | null): boolean {
  if (!since) return true;
  return updatedAt.getTime() > since.getTime();
}

export type RegisteredPassFreshness = {
  serialNumber: string;
  passTypeIdentifier: string;
  ticketUpdatedAt: Date;
  eventUpdatedAt: Date;
};

/**
 * Decide which registered serials Apple should re-download.
 * `null` means HTTP 204 — nothing changed.
 */
export function listUpdatedPasses({
  registrations,
  passTypeIdentifier,
  passesUpdatedSince,
}: {
  registrations: RegisteredPassFreshness[];
  passTypeIdentifier: string;
  passesUpdatedSince: string | null;
}): { serialNumbers: string[]; lastUpdated: string } | null {
  const since = parsePassesUpdatedSince(passesUpdatedSince);

  const updated = registrations
    .filter(
      (registration) => registration.passTypeIdentifier === passTypeIdentifier,
    )
    .map((registration) => ({
      serialNumber: registration.serialNumber,
      updatedAt: passUpdatedAt(
        registration.ticketUpdatedAt,
        registration.eventUpdatedAt,
      ),
    }))
    .filter((pass) => isPassNewerThan(pass.updatedAt, since))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const latest = updated[0];
  if (!latest) return null;

  return {
    serialNumbers: updated.map((pass) => pass.serialNumber),
    lastUpdated: formatPassUpdateTag(latest.updatedAt),
  };
}

export type PassVisibleEventSnapshot = {
  name: string;
  slug: string;
  timezone: string;
  startsAt: Date;
  doorsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  isR18: boolean;
} & PassThemeFields;

const PASS_VISIBLE_SCALAR_KEYS = [
  "name",
  "slug",
  "timezone",
  "venueName",
  "venueAddress",
  "isR18",
] as const;

const PASS_THEME_KEYS = [
  "passStripStyle",
  "passAccentHex",
  "passBackgroundHex",
  "passForegroundHex",
  "passLabelHex",
] as const satisfies readonly (keyof PassThemeFields)[];

function sameInstant(
  left: Date | null | undefined,
  right: Date | null | undefined,
): boolean {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return left.getTime() === right.getTime();
}

function definedThemePatch(patch: PassThemeFields): PassThemeFields | null {
  const next: PassThemeFields = {};
  let any = false;
  for (const key of PASS_THEME_KEYS) {
    if (patch[key] !== undefined) {
      next[key] = patch[key];
      any = true;
    }
  }
  return any ? next : null;
}

/** True when a ticketed-event edit would change what a Wallet pass prints. */
export function eventHasPassVisibleChange(
  existing: PassVisibleEventSnapshot,
  patch: Partial<PassVisibleEventSnapshot>,
): boolean {
  for (const key of PASS_VISIBLE_SCALAR_KEYS) {
    if (patch[key] === undefined) continue;
    if (patch[key] !== existing[key]) return true;
  }

  if (
    patch.startsAt !== undefined &&
    !sameInstant(patch.startsAt, existing.startsAt)
  ) {
    return true;
  }
  if (
    patch.doorsAt !== undefined &&
    !sameInstant(patch.doorsAt, existing.doorsAt)
  ) {
    return true;
  }

  const themePatch = definedThemePatch(patch);
  if (themePatch) {
    const before = resolvePassTheme(existing);
    const after = resolvePassTheme({ ...existing, ...themePatch });
    if (
      before.stripStyle !== after.stripStyle ||
      before.accentHex !== after.accentHex ||
      before.backgroundHex !== after.backgroundHex ||
      before.foregroundHex !== after.foregroundHex ||
      before.labelHex !== after.labelHex
    ) {
      return true;
    }
  }

  return false;
}
