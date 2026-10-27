import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { dashboardOverview } from "~/server/dashboard";

export const dashboardRouter = createTRPCRouter({
  /** Everything `/admin` draws, for the signed-in admin. */
  overview: adminProcedure.query(({ ctx }) =>
    dashboardOverview(ctx.session.user.id),
  ),
});
