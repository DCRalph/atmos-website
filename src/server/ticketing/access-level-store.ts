import "server-only";

import { db } from "~/server/db";
import { ACCESS_LEVELS } from "~/lib/ticketing/access-levels";

/**
 * Access levels, read from the table that replaced the enum.
 *
 * Cached for a short window rather than per request: a pass build and a door
 * screen both want this, it changes about as often as someone edits it in
 * admin, and a stale label for a minute is cheaper than a query on every scan.
 */

export type ResolvedLevel = {
  code: string;
  label: string;
  short: string;
  badgeBg: string;
  badgeFg: string;
  passAccent: string | null;
  rank: number;
  /**
   * `rank` normalised to 0–1 across the levels that exist, which is what
   * decides how far a pass's accent floods its band. Derived rather than
   * stored, so adding a level in the middle re-spaces the rest automatically.
   */
  intensity: number;
};

const TTL_MS = 60_000;

let cache: { at: number; levels: ResolvedLevel[] } | null = null;

/** The built-in six, for a database that has not been migrated yet. */
function fallback(): ResolvedLevel[] {
  const max = Math.max(1, ACCESS_LEVELS.length - 1);
  return ACCESS_LEVELS.map((level, index) => ({
    code: level.value,
    label: level.label,
    short: level.short,
    badgeBg: level.badgeBg,
    badgeFg: level.badgeFg,
    passAccent: level.passAccent,
    rank: index,
    intensity: index / max,
  }));
}

export async function getLevels(): Promise<ResolvedLevel[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.levels;

  try {
    const rows = await db.accessLevel.findMany({
      orderBy: [{ rank: "asc" }, { code: "asc" }],
    });
    if (rows.length === 0) return fallback();

    const maxRank = Math.max(1, ...rows.map((r) => r.rank));
    const levels: ResolvedLevel[] = rows.map((row) => ({
      code: row.code,
      label: row.label,
      short: row.short,
      badgeBg: row.badgeBg,
      badgeFg: row.badgeFg,
      passAccent: row.passAccent,
      rank: row.rank,
      intensity: Math.min(1, Math.max(0, row.rank / maxRank)),
    }));

    cache = { at: Date.now(), levels };
    return levels;
  } catch {
    // A pass is worth more than a perfect label — if the table is missing or
    // unreachable, fall back to the built-ins rather than failing the download.
    return fallback();
  }
}

/**
 * One level by code.
 *
 * An unknown code resolves to a neutral entry rather than throwing: a ticket
 * issued against a level that was later hard-deleted still has to render.
 */
export async function resolveLevel(code: string): Promise<ResolvedLevel> {
  const levels = await getLevels();
  return (
    levels.find((level) => level.code === code) ??
    levels[0] ?? {
      code,
      label: code,
      short: code.slice(0, 6),
      badgeBg: "#FFFFFF",
      badgeFg: "#000000",
      passAccent: null,
      rank: 0,
      intensity: 0,
    }
  );
}

/** Called after an admin edit so the next read is not a minute stale. */
export function invalidateLevels(): void {
  cache = null;
}
