import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Prisma } from "~Prisma/client";
import { db } from "~/server/db";

/**
 * Access levels, read from the table that replaced the enum.
 *
 * Read fresh every time. Only pass builds and emails come here, and a wallet
 * pass refetched right after a level edit has to print the new label, not one
 * a warm server instance remembered.
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

export async function getLevels(): Promise<ResolvedLevel[]> {
  const rows = await db.accessLevel.findMany({
    orderBy: [{ rank: "asc" }, { code: "asc" }],
  });

  const maxRank = Math.max(1, ...rows.map((r) => r.rank));
  return rows.map((row) => ({
    code: row.code,
    label: row.label,
    short: row.short,
    badgeBg: row.badgeBg,
    badgeFg: row.badgeFg,
    passAccent: row.passAccent,
    rank: row.rank,
    intensity: Math.min(1, Math.max(0, row.rank / maxRank)),
  }));
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
    levels.find((level) => level.code === code) ?? {
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

/** A level code in router input. Whether it exists is `assertIssuableLevels`. */
export const accessLevelCode = z.string().trim().toUpperCase().min(2).max(24);

/**
 * Refuse to put anything new on a level that doesn't exist or was archived.
 *
 * Only for codes being newly assigned: a tier or ticket already sitting on an
 * archived level keeps it, so callers pass just the codes that changed.
 */
export async function assertIssuableLevels(
  client: Pick<Prisma.TransactionClient, "accessLevel">,
  codes: Iterable<string>,
): Promise<void> {
  const wanted = [...new Set(codes)];
  if (wanted.length === 0) return;

  const found = await client.accessLevel.findMany({
    where: { code: { in: wanted }, archived: false },
    select: { code: true },
  });
  const issuable = new Set(found.map((level) => level.code));
  const missing = wanted.find((code) => !issuable.has(code));
  if (missing) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The ${missing} access level isn't available.`,
    });
  }
}
