/**
 * Date formatting for ticketing, always in the event's own timezone.
 *
 * Everything is stored in UTC. Rendering a door time as "9:00 PM" when the
 * server happens to be in UTC and the venue is in Auckland is exactly the kind
 * of bug that puts people outside a locked door, so every formatter here takes
 * the zone explicitly. NZ daylight saving shifts by an hour twice a year and
 * `Intl` handles that correctly; manual offset arithmetic does not.
 *
 * Client-safe.
 */

export const DEFAULT_EVENT_TIMEZONE = "Pacific/Auckland";

function fmt(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-NZ", { ...options, timeZone }).format(
    date,
  );
}

/** `Sat 14 Mar` */
export function formatEventDate(
  date: Date,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): string {
  return fmt(date, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** `Sat 14 March 2026` */
export function formatEventDateLong(
  date: Date,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): string {
  return fmt(date, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** `9:00 pm` */
export function formatEventTime(
  date: Date,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): string {
  return fmt(date, timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .replace(/ /g, " ")
    .toLowerCase();
}

/** `Sat 14 Mar, 9:00 pm` */
export function formatEventDateTime(
  date: Date,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): string {
  return `${formatEventDate(date, timeZone)}, ${formatEventTime(date, timeZone)}`;
}

/** `2026-03-14` in the event's zone — for grouping and CSV columns. */
export function eventDayKey(
  date: Date,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): string {
  return fmt(date, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .split("/")
    .reverse()
    .join("-");
}

/**
 * "14 minutes ago" — the phrasing the scanner uses when a ticket has already
 * been through the door. Short and unambiguous under pressure.
 */
export function formatTimeAgo(from: Date, now: Date = new Date()): string {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - from.getTime()) / 1000),
  );

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  if (hours < 24) {
    if (remainderMinutes === 0)
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    return `${hours}h ${remainderMinutes}m ago`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** `4:32` — countdown for the checkout hold timer. */
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
