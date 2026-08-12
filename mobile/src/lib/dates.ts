import { format, formatDistanceToNowStrict, isToday, isTomorrow } from "date-fns";

/** "Fri 12 Sep", or "Tonight" / "Tomorrow" when that is more useful. */
export function formatGigDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (isToday(date)) return "Tonight";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE d MMM");
}

export function formatGigTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "h:mmaaa");
}

export function formatGigDateLong(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "EEEE d MMMM yyyy");
}

/** "3 minutes ago" — matches the door's phrasing on the web. */
export function formatTimeAgo(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${formatDistanceToNowStrict(date)} ago`;
}

/** mm:ss, for the checkout hold countdown. */
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
