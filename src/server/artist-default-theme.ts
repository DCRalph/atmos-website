import "server-only";

import type { Prisma } from "~Prisma/client";

/**
 * The theme a new artist profile starts on: the oldest system theme.
 *
 * Profiles point at it rather than copying it, so editing that theme in the
 * admin changes every profile still on it. Null only while no system theme
 * exists, and a profile without a theme draws `DEFAULT_THEME`.
 */
export async function defaultArtistThemeId(
  db: Prisma.TransactionClient,
): Promise<string | null> {
  const theme = await db.artistProfileTheme.findFirst({
    where: { isSystem: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return theme?.id ?? null;
}
