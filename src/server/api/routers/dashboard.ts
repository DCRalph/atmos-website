import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { dashboardOverview } from "~/server/dashboard";
import { userHasPermission } from "~/server/utils/permissions";

export const dashboardRouter = createTRPCRouter({
  /** Everything `/admin` draws, for the signed-in admin. */
  overview: adminProcedure.query(async ({ ctx }) => ({
    ...(await dashboardOverview(ctx.session.user.id)),
    /** Superadmins can mark the team's tasks done without taking them. */
    superadmin: userHasPermission(ctx.user, "SUPERADMIN"),
  })),
});
