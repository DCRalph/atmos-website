import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { userHasEffectivePermission } from "~/server/utils/permissions";
import type { UserPermission } from "~Prisma/client";

const ALL_PERMISSIONS: UserPermission[] = [
  "EVENT_ORGANISER",
  "CREATOR",
  "ADMIN",
];

export const userRouter = createTRPCRouter({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) {
      return null;
    }

    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        permissions: { select: { permission: true } },
        legacyRoles: { select: { role: true } },
      },
    });

    if (!user) return null;

    const effectivePermissions = (
      await Promise.all(
        ALL_PERMISSIONS.map(async (permission) => ({
          permission,
          granted: await userHasEffectivePermission(user, permission, ctx.db),
        })),
      )
    )
      .filter((result) => result.granted)
      .map((result) => result.permission);

    const { legacyRoles, ...safeUser } = user;
    void legacyRoles;
    return { ...safeUser, effectivePermissions };
  }),
});
