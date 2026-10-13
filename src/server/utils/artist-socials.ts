import { TRPCError } from "@trpc/server";
import {
  getPlatform,
  resolveSocialPlatform,
  type SocialPlatformId,
} from "~/lib/social-pills";
import type { Prisma } from "~Prisma/client";

/**
 * Sets one platform's link on a profile without touching its other socials:
 * updates the existing row for that platform, adds one at the end, or removes
 * it when `url` is null. The stored `platform` is free text, so existing rows
 * are matched the same way the public page reads them.
 */
export async function setProfileSocial(
  tx: Prisma.TransactionClient,
  profileId: string,
  platformId: SocialPlatformId,
  url: string | null,
) {
  const socials = await tx.artistSocial.findMany({
    where: { profileId },
    orderBy: { sortOrder: "asc" },
  });
  const matches = socials.filter(
    (social) =>
      resolveSocialPlatform(social.platform, social.url)?.id === platformId,
  );
  const [existing, ...duplicates] = matches;

  if (duplicates.length || (existing && !url)) {
    await tx.artistSocial.deleteMany({
      where: {
        id: { in: (url ? duplicates : matches).map((social) => social.id) },
      },
    });
  }
  if (!url) return;
  if (existing) {
    if (existing.url !== url) {
      await tx.artistSocial.update({
        where: { id: existing.id },
        data: { url },
      });
    }
    return;
  }
  await tx.artistSocial.create({
    data: {
      profileId,
      platform: platformId,
      url,
      sortOrder: (socials.at(-1)?.sortOrder ?? -1) + 1,
    },
  });
}

/**
 * A handle ("@nova") or link typed into an admin form, as the canonical URL we
 * store. Empty input means "no link"; anything else that isn't recognisable is
 * rejected rather than saved as a broken link.
 */
export function socialUrlFromInput(
  platformId: SocialPlatformId,
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const platform = getPlatform(platformId);
  const url = platform.normalizeInput(trimmed);
  if (!url) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `That isn't a ${platform.name} handle or link`,
    });
  }
  return url;
}
