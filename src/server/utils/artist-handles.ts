import type { PrismaClient } from "~Prisma/client";

export const HANDLE_REGEX = /^[a-z0-9_-]{3,30}$/;

/** Turn free text ("DJ Nova!") into a handle-shaped base ("dj-nova"). */
function handleBaseFrom(raw: string): string {
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return HANDLE_REGEX.test(base) ? base : "artist";
}

/** First free handle at or after `base`. */
export async function uniqueHandleFrom(
  db: PrismaClient,
  base: string,
): Promise<string> {
  const safeBase = handleBaseFrom(base);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? safeBase : `${safeBase}-${i}`;
    const exists = await db.artistProfile.findUnique({
      where: { handle: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${safeBase}-${Date.now().toString(36).slice(-4)}`;
}
