/**
 * What a ticket gets you past.
 *
 * The levels themselves live in the `AccessLevel` table, editable in admin.
 * Read them with `useAccessLevels` in the web and mobile apps and
 * `getLevels` / `resolveLevel` on the server. This module only holds the few
 * rules that don't depend on what is in the table.
 */

/** The level every tier and ticket starts on. Seeded, and never archived. */
export const DEFAULT_ACCESS_LEVEL = "GENERAL";

/** Everything above general admission is worth pointing at on a door screen. */
export function isElevated(value: string | null | undefined): boolean {
  return Boolean(value) && value !== DEFAULT_ACCESS_LEVEL;
}

/** What a badge needs to draw a level. */
export type AccessLevelBadge = {
  code: string;
  label: string;
  short: string;
  badgeBg: string;
  badgeFg: string;
};

/**
 * Index the levels list for pickers and badges.
 *
 * `all` is for filters over issued tickets, `active` is what a picker should
 * offer, and `level(code)` resolves any code, falling back to a plain badge of
 * the code itself while the list loads or for a level that was deleted.
 */
export function accessLevelLookup<
  T extends AccessLevelBadge & { archived: boolean },
>(all: T[]) {
  const byCode = new Map(all.map((level) => [level.code, level]));
  return {
    all,
    active: all.filter((level) => !level.archived),
    level: (code: string): AccessLevelBadge =>
      byCode.get(code) ?? {
        code,
        label: code,
        short: code.slice(0, 6),
        badgeBg: "#FFFFFF",
        badgeFg: "#000000",
      },
  };
}

/** What a lifetime pass is called wherever a tier name is printed. */
export const LIFETIME_TYPE_NAME = "Lifetime pass";

/**
 * What to call a ticket wherever a tier name used to be printed.
 *
 * A comp is minted rather than drawn, so it belongs to no tier and has no tier
 * name to show. It falls back to what it gets you past — an AAA comp reads
 * "Access all areas" instead of leaving a blank on a door screen. Callers
 * select `level: { select: { label: true } }` alongside the tier for this.
 *
 * A lifetime pass turning up at an event is a minted ticket too, and it says
 * so: the level is already on the badge beside it, and "Lifetime pass" is the
 * fact the door actually wants to read.
 */
export function ticketTypeName(ticket: {
  tier?: { name: string } | null;
  level: { label: string };
  lifetimeTicketId?: string | null;
}): string {
  if (ticket.lifetimeTicketId) return LIFETIME_TYPE_NAME;
  return ticket.tier?.name ?? ticket.level.label;
}
