import "server-only";

import { TRPCError } from "@trpc/server";
import { uploadPresets, type UploadPresetName } from "~/lib/uploads/presets";
import { userHasEffectivePermission } from "~/server/utils/permissions";
import { resolveTargetProfileId } from "~/server/utils/creator-profile-access";
import type { PrismaClient } from "~Prisma/client";

/**
 * Decides whether the signed-in user may upload through a preset, and turns
 * the context they sent into the resolved context the preset's `forId` and
 * `keyPrefix` functions expect.
 *
 * Every preset must appear in `resolvers` below — the type of `resolvers`
 * makes adding a preset without an access rule a compile error.
 */

export type UploadAuthContext = {
  db: PrismaClient;
  session: { user: { id: string } } | null;
};

type Resolver = (
  ctx: UploadAuthContext,
  context: Record<string, unknown>,
) => Promise<Record<string, string>>;

/** Reads a string field from an already zod-validated context. */
const str = (context: Record<string, unknown>, key: string, fallback = "") =>
  typeof context[key] === "string" ? context[key] : fallback;

/** Verifies a gig exists before we start writing objects under its prefix. */
const resolveGig: Resolver = async (ctx, context) => {
  const gigId = str(context, "gigId");
  const gig = await ctx.db.gig.findUnique({
    where: { id: gigId },
    select: { id: true },
  });
  if (!gig) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
  }
  return { gigId: gig.id };
};

/** Resolves "my profile" and enforces owner-or-admin on an explicit one. */
const resolveProfile: Resolver = async (ctx, context) => {
  const raw = context.profileId;
  const { profileId } = await resolveTargetProfileId(
    ctx,
    typeof raw === "string" && raw.length > 0 ? raw : undefined,
  );
  return { profileId };
};

const resolvers: Record<UploadPresetName, Resolver> = {
  gigMedia: resolveGig,
  gigPoster: resolveGig,
  creatorAvatar: resolveProfile,
  creatorBanner: resolveProfile,
  creatorThemeBackground: resolveProfile,
  creatorBlockImage: resolveProfile,
  mediaLibrary: async (_ctx, context) => ({
    category: str(context, "category", "library"),
  }),
};

/**
 * Throws unless the user clears the preset's role bar, then returns the
 * resolved context.
 */
export const authorizeUpload = async (
  presetName: UploadPresetName,
  rawContext: unknown,
  ctx: UploadAuthContext,
): Promise<{ userId: string; context: Record<string, string> }> => {
  const preset = uploadPresets[presetName];

  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    include: { permissions: true, legacyRoles: true },
  });
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const [isAdmin, isCreator] = await Promise.all([
    userHasEffectivePermission(user, "ADMIN", ctx.db),
    userHasEffectivePermission(user, "CREATOR", ctx.db),
  ]);

  if (preset.access === "admin" && !isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required to upload here",
    });
  }
  if (preset.access === "creator" && !isCreator) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Creator or Admin access required to upload here",
    });
  }

  const parsed = preset.context.safeParse(rawContext ?? {});
  if (!parsed.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid upload context for "${presetName}": ${parsed.error.issues
        .map((i) => i.message)
        .join(", ")}`,
    });
  }

  const resolved = await resolvers[presetName](ctx, parsed.data);

  // Re-validate the resolved shape so `forId`/`keyPrefix` can trust their input.
  const resolvedSchema = preset.resolved ?? preset.context;
  const check = resolvedSchema.safeParse(resolved);
  if (!check.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Upload context for "${presetName}" failed to resolve`,
    });
  }

  return { userId: user.id, context: resolved };
};
