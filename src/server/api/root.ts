import { crewRouter } from "~/server/api/routers/crew";
import { contentRouter } from "~/server/api/routers/content";
import { gigsRouter } from "~/server/api/routers/gigs";
import { merchRouter } from "~/server/api/routers/merch";
import { contactRouter } from "~/server/api/routers/contact";
import { userRouter } from "~/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  crew: crewRouter,
  content: contentRouter,
  gigs: gigsRouter,
  merch: merchRouter,
  contact: contactRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
