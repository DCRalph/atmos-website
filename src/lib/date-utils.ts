/**
 * Date and time utility functions for managing conversions between UTC and user's local timezone
 */

/**
 * Converts a local date (from date picker) to UTC at midnight for database storage.
 * This ensures dates are stored consistently in UTC regardless of user's timezone.
 *
 * @param localDate - Date object in user's local timezone
 * @returns Date object in UTC at midnight
 *
 * @example
 * const localDate = new Date(2024, 0, 15); // Jan 15, 2024 in user's timezone
 * const utcDate = localDateToUTC(localDate); // Jan 15, 2024 00:00:00 UTC
 */
export function localDateToUTC(localDate: Date): Date {
  return new Date(
    Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * Converts a UTC date (from database) to a local date for display/editing.
 * The Date object will represent the same moment in time but in the user's timezone.
 *
 * @param utcDate - Date object in UTC (from database)
 * @returns Date object in user's local timezone
 *
 * @example
 * const utcDate = new Date("2024-01-15T00:00:00Z"); // UTC
 * const localDate = utcDateToLocal(utcDate); // Same moment, local timezone
 */
export function utcDateToLocal(utcDate: Date): Date {
  // Date objects are already timezone-aware, so we just return a new Date
  // that represents the same moment in time
  return new Date(utcDate);
}

/**
 * Gets the current UTC date at midnight.
 * Useful for date comparisons in UTC.
 *
 * @returns Date object representing today at 00:00:00 UTC
 */
export function getUTCToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * Gets the current UTC date/time.
 *
 * @returns Date object representing current UTC time
 */
export function getUTCNow(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}

/**
 * Creates a UTC date at a specific time.
 *
 * @param year - Year
 * @param month - Month (0-11)
 * @param date - Day of month
 * @param hours - Hours (0-23), default 0
 * @param minutes - Minutes (0-59), default 0
 * @param seconds - Seconds (0-59), default 0
 * @returns Date object in UTC
 */
export function createUTCDate(
  year: number,
  month: number,
  date: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
): Date {
  return new Date(Date.UTC(year, month, date, hours, minutes, seconds));
}

/**
 * Gets the user's timezone (client-side only).
 * Returns undefined on the server.
 *
 * @returns User's timezone string (e.g., "America/New_York") or undefined on server
 */
export function getUserTimezone(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Formats a date in the user's local timezone.
 * Works on both client and server, but server will use server's timezone.
 *
 * @param date - Date to format
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 *
 * @example
 * formatDateInUserTimezone(date, { month: "short", day: "numeric", year: "numeric" })
 */
export function formatDateInUserTimezone(
  date: Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const timezone = getUserTimezone();
  return date.toLocaleDateString(undefined, {
    ...options,
    ...(timezone && { timeZone: timezone }),
  });
}

/**
 * Formats a date with a consistent format for display.
 * Uses user's timezone on client, server timezone on server.
 *
 * @param date - Date to format
 * @param format - Format style: "short" (Jan 15, 2024) or "long" (January 15, 2024)
 * @returns Formatted date string
 */
export function formatDate(
  date: Date,
  format: "short" | "long" | "extra-short" = "short",
): string {
  let options: Intl.DateTimeFormatOptions = {};

  switch (format) {
    case "short":
      options = { month: "short", day: "numeric", year: "numeric" };
      break;
    case "long":
      options = { month: "long", day: "numeric", year: "numeric" };
      break;
    case "extra-short":
      options = { month: "short", day: "numeric" };
      break;
  }

  return formatDateInUserTimezone(date, options);
}

/**
 * Formats a datetime with time for display.
 * Uses user's timezone on client, server timezone on server.
 *
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Formatted datetime string
 *
 * @example
 * formatDateTime(date, { includeSeconds: false }) // "Jan 15, 2024 at 6:00 PM"
 */
export function formatDateTime(
  date: Date,
  options: { includeSeconds?: boolean; includeDate?: boolean } = {},
): string {
  const { includeSeconds = false, includeDate = true } = options;
  const timezone = getUserTimezone();

  const dateOptions: Intl.DateTimeFormatOptions = {
    ...(includeDate && {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds && { second: "2-digit" }),
    ...(timezone && { timeZone: timezone }),
  };

  return date.toLocaleString(undefined, dateOptions);
}

/**
 * Formats just the time portion of a datetime.
 *
 * @param date - Date to format
 * @param includeSeconds - Whether to include seconds
 * @returns Formatted time string (e.g., "6:00 PM")
 */
export function formatTime(date: Date, includeSeconds = false): string {
  const timezone = getUserTimezone();
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds && { second: "2-digit" }),
    ...(timezone && { timeZone: timezone }),
  });
}

/**
 * Gets the start of a date range for "today" queries.
 * Returns yesterday at 5am UTC if current time is before 5am UTC,
 * otherwise returns today at midnight UTC.
 *
 * @returns Date object representing the start of the "today" range in UTC
 */
export function getTodayRangeStart(): Date {
  const now = getUTCNow();
  const today = getUTCToday();
  const currentHourUTC = now.getUTCHours();

  if (currentHourUTC < 5) {
    // Before 5am UTC: include yesterday from 5am UTC onwards
    return createUTCDate(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - 1,
      5,
      0,
      0,
    );
  } else {
    // After 5am UTC: only include today's gigs
    return today;
  }
}

/**
 * Gets the end of a date range for "today" queries.
 * Returns tomorrow at midnight UTC.
 *
 * @returns Date object representing the end of the "today" range in UTC
 */
export function getTodayRangeEnd(): Date {
  const today = getUTCToday();
  return createUTCDate(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + 1,
    0,
    0,
    0,
  );
}

/**
 * Whether a gig is happening right about now: from the day before it until 5am
 * the day after.
 *
 * This is a narrow window, not "is in the future". It was called
 * `isGigUpcoming`, and the name cost us: a gig two months out is not in this
 * window, so anything reading it as "upcoming or past" labelled every future
 * gig as past. If you want that question, use `isGigPast`.
 *
 * @param gig - Gig object with gigStartTime (required) and optional gigEndTime
 * @returns true while the gig is on, false before and after
 */
export function isGigHappeningNow(gig: {
  gigStartTime: Date;
  gigEndTime?: Date | null;
}): boolean {
  const now = getUTCNow();

  // Determine the reference date/time for the gig
  // Use end time if available (most accurate), otherwise use start time
  const gigReferenceDate = gig.gigStartTime;

  // Calculate the day before the gig (at midnight UTC)
  const dayBefore = new Date(
    Date.UTC(
      gigReferenceDate.getUTCFullYear(),
      gigReferenceDate.getUTCMonth(),
      gigReferenceDate.getUTCDate() - 1,
      0,
      0,
      0,
      0,
    ),
  );

  // Calculate the day after the gig at 5am UTC (cutoff time)
  const dayAfter5am = new Date(
    Date.UTC(
      gigReferenceDate.getUTCFullYear(),
      gigReferenceDate.getUTCMonth(),
      gigReferenceDate.getUTCDate() + 1,
      5,
      0,
      0,
      0,
    ),
  );

  // Gig is upcoming if we're between the day before and the day after at 5am
  // return true;
  return now >= dayBefore && now < dayAfter5am;
}

/**
 * Whether a gig has finished.
 *
 * The end time when there is one, the start when there is not. A gig that began
 * at 10pm and runs until 2am is not past at 11pm, which is what comparing
 * against the start alone used to claim.
 *
 * This is the single answer to "past or upcoming". Anything asking that question
 * should call this rather than derive its own, which is how a December gig came
 * to be labelled past.
 */
export function isGigPast(gig: {
  gigStartTime: Date;
  gigEndTime?: Date | null;
}): boolean {
  return (gig.gigEndTime ?? gig.gigStartTime) < getUTCNow();
}
