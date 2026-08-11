import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { userHasPermission } from "~/server/utils/permissions";
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
      },
    });

    if (!user) return null;

    const effectivePermissions = ALL_PERMISSIONS.filter((permission) =>
      userHasPermission(user, permission),
    );

    return { ...user, effectivePermissions };
  }),
});
