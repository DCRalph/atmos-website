import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { userHasRole } from "~/server/utils/roles";
import { logUserActivity } from "~/server/utils/activity-log";
import {
  DEFAULT_BLOCK_OVERRIDES,
  DEFAULT_THEME_TOKENS,
  parseBlockOverrides,
  parseTokens,
  zBlockOverrides,
  zThemeTokens,
} from "~/lib/creator-theme";
import { ActivityType, type PrismaClient } from "~Prisma/client";

/**
 * Resolve whether the current user can read the given theme.
 *
 * Readable when:
 *  - the theme is public or system (anyone, including anonymous), or
 *  - the caller is the owner, or
 *  - the caller is an admin.
 */
async function canReadTheme(
  ctx: {
    db: PrismaClient;
    session: { user: { id: string } } | null;
  },
  themeId: string,
): Promise<{ ok: true } | { ok: false; reason: "not-found" | "forbidden" }> {
  const theme = await ctx.db.creatorProfileTheme.findUnique({
    where: { id: themeId },
    select: { ownerUserId: true, isPublic: true, isSystem: true },
  });
  if (!theme) return { ok: false, reason: "not-found" };
  if (theme.isPublic || theme.isSystem) return { ok: true };
  if (!ctx.session?.user) return { ok: false, reason: "forbidden" };
  if (theme.ownerUserId === ctx.session.user.id) return { ok: true };
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    include: { roles: true },
  });
  if (user && userHasRole(user, "ADMIN")) return { ok: true };
  return { ok: false, reason: "forbidden" };
}

/** Assert the current user can edit (mutate) the given theme (owner or admin). */
async function assertCanEditTheme(
  ctx: {
    db: PrismaClient;
    session: { user: { id: string } } | null;
  },
  themeId: string,
): Promise<{ isAdmin: boolean; isOwner: boolean }> {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const [theme, user] = await Promise.all([
    ctx.db.creatorProfileTheme.findUnique({
      where: { id: themeId },
      select: { ownerUserId: true },
    }),
    ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: { roles: true },
    }),
  ]);
  if (!theme) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Theme not found" });
  }
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const isAdmin = userHasRole(user, "ADMIN");
  const isOwner = theme.ownerUserId === user.id;
  if (!isAdmin && !isOwner) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot edit this theme",
    });
  }
  return { isAdmin, isOwner };
}

const zThemeName = z.string().min(1).max(80);
const zThemeDesc = z.string().max(500).nullish();

export const creatorThemesRouter = createTRPCRouter({
  // ---------- Reads ----------

  /** Themes owned by the current user. */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.creatorProfileTheme.findMany({
      where: { ownerUserId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { profiles: true } },
      },
    });
  }),

  /** Themes visible to the public / browse list. */
  listPublic: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          includeSystem: z.boolean().default(true),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim().toLowerCase();
      const includeSystem = input?.includeSystem ?? true;
      return ctx.db.creatorProfileTheme.findMany({
        where: {
          OR: [
            { isPublic: true },
            ...(includeSystem ? [{ isSystem: true }] : []),
          ],
          ...(search
            ? {
                AND: {
                  OR: [
                    {
                      name: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      description: {
                        contains: search,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              }
            : {}),
        },
        orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
        take: input?.limit ?? 50,
        include: {
          owner: { select: { id: true, name: true, image: true } },
          _count: { select: { profiles: true } },
        },
      });
    }),

  /** A single theme, readable if public/system, owned, or admin. */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const check = await canReadTheme(ctx, input.id);
      if (!check.ok) {
        if (check.reason === "not-found") {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.creatorProfileTheme.findUnique({
        where: { id: input.id },
        include: {
          owner: {
            select: { id: true, name: true, image: true },
          },
          _count: { select: { profiles: true } },
        },
      });
    }),

  // ---------- Mutations ----------

  /** Create a new private theme owned by the caller. */
  create: protectedProcedure
    .input(
      z.object({
        name: zThemeName,
        description: zThemeDesc,
        tokens: zThemeTokens.optional(),
        blockOverrides: zBlockOverrides.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.creatorProfileTheme.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          ownerUserId: ctx.session.user.id,
          isPublic: false,
          isSystem: false,
          tokens: (input.tokens ?? DEFAULT_THEME_TOKENS) as object,
          blockOverrides: (input.blockOverrides ??
            DEFAULT_BLOCK_OVERRIDES) as object,
        },
      });
      await logUserActivity(
        ActivityType.CREATOR_THEME_CREATED,
        `Created creator theme "${created.name}"`,
        ctx.session.user.id,
        undefined,
        { themeId: created.id },
      );
      return created;
    }),

  /** Update an existing theme (owner or admin). */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: zThemeName.optional(),
          description: zThemeDesc,
          tokens: zThemeTokens.optional(),
          blockOverrides: zBlockOverrides.optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanEditTheme(ctx, input.id);
      const updated = await ctx.db.creatorProfileTheme.update({
        where: { id: input.id },
        data: {
          ...(input.data.name !== undefined ? { name: input.data.name } : {}),
          ...(input.data.description !== undefined
            ? { description: input.data.description ?? null }
            : {}),
          ...(input.data.tokens !== undefined
            ? { tokens: input.data.tokens as object }
            : {}),
          ...(input.data.blockOverrides !== undefined
            ? { blockOverrides: input.data.blockOverrides as object }
            : {}),
        },
      });
      await logUserActivity(
        ActivityType.CREATOR_THEME_UPDATED,
        `Updated creator theme "${updated.name}"`,
        ctx.session.user.id,
        undefined,
        { themeId: updated.id },
      );
      return updated;
    }),

  /** Toggle a theme between private / public (owner or admin). */
  setVisibility: protectedProcedure
    .input(z.object({ id: z.string(), isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanEditTheme(ctx, input.id);
      const updated = await ctx.db.creatorProfileTheme.update({
        where: { id: input.id },
        data: { isPublic: input.isPublic },
      });
      await logUserActivity(
        input.isPublic
          ? ActivityType.CREATOR_THEME_PUBLISHED
          : ActivityType.CREATOR_THEME_UNPUBLISHED,
        `${input.isPublic ? "Published" : "Unpublished"} creator theme "${updated.name}"`,
        ctx.session.user.id,
        undefined,
        { themeId: updated.id },
      );
      return updated;
    }),

  /** Admin-only: toggle `isSystem` flag (used to mark starter themes). */
  setSystem: adminProcedure
    .input(z.object({ id: z.string(), isSystem: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.creatorProfileTheme.update({
        where: { id: input.id },
        data: { isSystem: input.isSystem },
      });
      await logUserActivity(
        ActivityType.CREATOR_THEME_UPDATED,
        `${input.isSystem ? "Marked" : "Unmarked"} theme "${updated.name}" as system`,
        ctx.session.user.id,
        undefined,
        { themeId: updated.id, isSystem: input.isSystem },
      );
      return updated;
    }),

  /**
   * Fork any readable theme into a new private theme owned by the caller.
   * Used by the "Duplicate and customize" button on public themes.
   */
  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: zThemeName.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const check = await canReadTheme(ctx, input.id);
      if (!check.ok) {
        throw new TRPCError({
          code: check.reason === "not-found" ? "NOT_FOUND" : "FORBIDDEN",
        });
      }
      const source = await ctx.db.creatorProfileTheme.findUnique({
        where: { id: input.id },
      });
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const tokens = parseTokens(source.tokens);
      const blockOverrides = parseBlockOverrides(source.blockOverrides);
      const created = await ctx.db.creatorProfileTheme.create({
        data: {
          name: input.name ?? `${source.name} (copy)`,
          description: source.description,
          ownerUserId: ctx.session.user.id,
          isPublic: false,
          isSystem: false,
          tokens: tokens as object,
          blockOverrides: blockOverrides as object,
        },
      });
      await logUserActivity(
        ActivityType.CREATOR_THEME_DUPLICATED,
        `Duplicated theme "${source.name}" into "${created.name}"`,
        ctx.session.user.id,
        undefined,
        { themeId: created.id, sourceThemeId: source.id },
      );
      return created;
    }),

  /** Delete a theme (owner or admin). Profiles referencing it are set null via FK. */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanEditTheme(ctx, input.id);
      const theme = await ctx.db.creatorProfileTheme.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, isSystem: true },
      });
      if (!theme) throw new TRPCError({ code: "NOT_FOUND" });
      if (theme.isSystem) {
        // Require admin explicit flow: unmark system first
        const user = await ctx.db.user.findUnique({
          where: { id: ctx.session.user.id },
          include: { roles: true },
        });
        if (!user || !userHasRole(user, "ADMIN")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "System themes cannot be deleted by their owner.",
          });
        }
      }
      await ctx.db.creatorProfileTheme.delete({ where: { id: theme.id } });
      await logUserActivity(
        ActivityType.CREATOR_THEME_DELETED,
        `Deleted creator theme "${theme.name}"`,
        ctx.session.user.id,
        undefined,
        { themeId: theme.id },
      );
      return { ok: true as const };
    }),

  // ---------- Admin-only global list ----------

  listAll: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          visibility: z
            .enum(["all", "private", "public", "system"])
            .default("all"),
          ownerUserId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim().toLowerCase();
      const visibility = input?.visibility ?? "all";
      return ctx.db.creatorProfileTheme.findMany({
        where: {
          ...(visibility === "private" ? { isPublic: false, isSystem: false } : {}),
          ...(visibility === "public" ? { isPublic: true } : {}),
          ...(visibility === "system" ? { isSystem: true } : {}),
          ...(input?.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
          ...(search
            ? {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    description: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
        include: {
          owner: {
            select: { id: true, name: true, email: true, image: true },
          },
          _count: { select: { profiles: true } },
        },
      });
    }),
});
