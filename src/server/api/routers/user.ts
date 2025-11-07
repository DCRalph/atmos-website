import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) {
      return null;
    }

    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
      },
    });

    return user;
  }),
});

