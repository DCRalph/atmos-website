/**
 * Wall time at a venue, turned into an instant.
 *
 * A caption says "Friday 23 October, 10pm". That is 10pm in Auckland, and the
 * only way to store it correctly is to work out what Auckland's offset was on
 * that particular night — which changes twice a year. `Date` has no way to
 * parse a wall time in a zone that is not the host's, so this does it with the
 * one thing that does know: `Intl`.
 */

/** How far ahead of UTC `timeZone` was at `instant`, in milliseconds. */
function offsetAt(instant: Date, timeZone: string): number {
  // `en-CA` gives ISO-ish parts, which reassemble without any locale parsing.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const at = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // Midnight comes back as hour 24 in some environments; both mean the same day.
  const hour = at("hour") % 24;
  const asUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    hour,
    at("minute"),
    at("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * The instant at which the clock in `timeZone` reads `wall`.
 *
 * `wall` is `YYYY-MM-DDTHH:mm` with no offset. Returns null if it is not.
 *
 * The offset is applied, then re-checked against the result: the first guess
 * uses the offset in force at the wrong instant, which is off by an hour for
 * times within a day of a daylight saving change. One correction is enough,
 * because a second shift cannot happen inside that window.
 */
export function zonedWallTimeToDate(
  wall: string,
  timeZone: string,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall)) return null;

  const asUtc = new Date(`${wall}:00.000Z`);
  if (Number.isNaN(asUtc.getTime())) return null;

  const firstGuess = new Date(asUtc.getTime() - offsetAt(asUtc, timeZone));
  const corrected = new Date(asUtc.getTime() - offsetAt(firstGuess, timeZone));
  return corrected;
}

/** The inverse, for showing a stored instant back as venue wall time. */
export function dateToZonedWallTime(date: Date, timeZone: string): string {
  const shifted = new Date(date.getTime() + offsetAt(date, timeZone));
  return shifted.toISOString().slice(0, 16);
}
