/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";

import { SHARE_TOKEN_HEADER } from "~/lib/ticketing/share-link";
import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { userHasPermission } from "~/server/utils/permissions";
import type { UserPermission } from "~Prisma/client";
import type { ApiCaller } from "~/server/api-keys";
import { DEVELOPER_API_USER_ID } from "~/lib/developer/system-user";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: {
  headers: Headers;
  resHeaders?: Headers;
}) => {
  const session = await auth.api.getSession({ headers: opts.headers });
  return {
    db,
    session,
    /**
     * Set only by the developer API, which calls procedures as the Developer
     * API system user on behalf of this key. See `~/server/developer-api`.
     */
    apiCaller: null as ApiCaller | null,
    ...opts,
  };
};

/**
 * Static facts about a procedure, readable without calling it.
 *
 * `permission` is stamped by `permissionProcedure`, so every procedure built on
 * `adminProcedure` and friends carries the permission it checks. Will GPT reads
 * it to decide which procedures it can be offered (see `~/server/will-gpt`).
 */
export type ProcedureMeta = { permission?: UserPermission };

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<ProcedureMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      const zod = error.cause instanceof ZodError ? error.cause : null;
      return {
        ...shape,
        // A validation failure's own message is the issues as JSON, which
        // toasts and form errors would show verbatim. Forms that want the
        // detail read `zodError`; everyone else gets a sentence.
        message: zod
          ? "Some of those details don't look right. Check them and try again."
          : shape.message,
        data: {
          ...shape.data,
          zodError: zod ? zod.flatten() : null,
        },
      };
    },
  });

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * The signed-in user with their permissions, as every permission check reads
 * them.
 *
 * The Developer API system user holds no permission rows, so it can never
 * sign in as anything or show up in a staff list. During a developer API call
 * it is handed ADMIN, never SUPERADMIN: what it can then reach is limited to
 * the endpoints in `~/server/developer-api`, each behind its own scope.
 */
async function loadUser(ctx: {
  db: typeof db;
  apiCaller: ApiCaller | null;
  session: { user: { id: string } };
}) {
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    include: { permissions: true },
  });
  if (!user || !ctx.apiCaller || user.id !== DEVELOPER_API_USER_ID) {
    return user;
  }
  return {
    ...user,
    permissions: [
      {
        id: "developer-api",
        userId: user.id,
        permission: "ADMIN" as const,
        createdAt: user.createdAt,
        createdBy: null,
      },
    ],
  };
}

/**
 * Artist procedure
 *
 * Only accessible to users with the ARTIST permission or full ADMIN access.
 */
function permissionProcedure(permission: UserPermission) {
  return protectedProcedure.meta({ permission }).use(async ({ ctx, next }) => {
    const user = await loadUser(ctx);

    const hasPermission = user ? userHasPermission(user, permission) : false;
    if (!user || !hasPermission) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `${permission.replaceAll("_", " ").toLowerCase()} permission required`,
      });
    }

    const isAdmin =
      permission === "ADMIN" ? true : userHasPermission(user, "ADMIN");

    return next({
      ctx: {
        ...ctx,
        user,
        isAdmin,
      },
    });
  });
}

export const artistProcedure = permissionProcedure("ARTIST");

export const eventOrganiserProcedure = permissionProcedure("EVENT_ORGANISER");

/**
 * Event viewer procedure
 *
 * The read-only organiser pages. Admins and event organisers see every event;
 * anybody else sees only the events they hold a `TicketEventViewer` row for,
 * and is refused outright with none. A call from a share link needs no
 * session: its token stands for the one event the link was made for, and wins
 * over whoever happens to be signed in, so an admin opening a link sees what
 * its recipient sees.
 *
 * `ctx.viewableEventIds` is null for every event, otherwise the granted ids:
 * handlers that take no single event (a list) filter by it, and the rest go
 * through `eventViewProcedure` or `assertCanViewEvent`.
 */
export const eventViewerProcedure = publicProcedure.use(
  async ({ ctx, next }) => {
    const shareToken = ctx.headers.get(SHARE_TOKEN_HEADER);
    if (shareToken) {
      const link = await ctx.db.ticketEventShareLink.findUnique({
        where: { token: shareToken },
        select: { eventId: true },
      });
      if (!link) throw new TRPCError({ code: "UNAUTHORIZED" });
      return next({
        ctx: { ...ctx, isAdmin: false, viewableEventIds: [link.eventId] },
      });
    }

    if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const user = await loadUser({ ...ctx, session: ctx.session });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const viewableEventIds = userHasPermission(user, "EVENT_ORGANISER")
      ? null
      : (
          await ctx.db.ticketEventViewer.findMany({
            where: { userId: user.id },
            select: { eventId: true },
          })
        ).map((row) => row.eventId);

    if (viewableEventIds?.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "event organiser permission required",
      });
    }

    return next({
      ctx: {
        ...ctx,
        isAdmin: userHasPermission(user, "ADMIN"),
        viewableEventIds,
      },
    });
  },
);

/**
 * Refuse an event outside the caller's grants. Not found rather than
 * forbidden, so a viewer can't tell which other event ids exist.
 */
export function assertCanViewEvent(
  ctx: { viewableEventIds: string[] | null },
  eventId: string,
): void {
  if (ctx.viewableEventIds && !ctx.viewableEventIds.includes(eventId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
  }
}

/**
 * `eventViewerProcedure` for the common case: the input names one event as
 * `eventId`, checked before the handler runs. Further `.input()` calls add to
 * it.
 */
export const eventViewProcedure = eventViewerProcedure
  .input(z.object({ eventId: z.string() }))
  .use(({ ctx, input, next }) => {
    assertCanViewEvent(ctx, input.eventId);
    return next();
  });

/**
 * Door staff procedure
 *
 * Accessible to authenticated users. Admins and event organisers have full
 * door access for every event. Other users require a `TicketEventStaff`
 * assignment.
 */
export const doorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await loadUser(ctx);

  if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

  const isAdmin = userHasPermission(user, "ADMIN");
  const isEventOrganiser = userHasPermission(user, "EVENT_ORGANISER");

  return next({
    ctx: {
      ...ctx,
      user,
      isAdmin,
      isEventOrganiser,
      hasGlobalDoorAccess: isAdmin || isEventOrganiser,
    },
  });
});

/**
 * Door staff only
 *
 * `doorProcedure` refuses nobody: its handlers check access per event. This is
 * for calls that belong to no single event, like the Tap to Pay reader, and
 * refuses anybody who is not an admin, an organiser, or rostered on at least
 * one event — the same audience as `eligibleStaffUserIds`.
 */
export const doorStaffProcedure = doorProcedure.use(async ({ ctx, next }) => {
  if (!ctx.hasGlobalDoorAccess) {
    const rostered = await ctx.db.ticketEventStaff.findFirst({
      where: { userId: ctx.user.id },
      select: { id: true },
    });
    if (!rostered) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Door staff only" });
    }
  }
  return next();
});

/**
 * Admin procedure
 *
 * Only accessible to users with the ADMIN permission.
 */
export const adminProcedure = permissionProcedure("ADMIN");

/**
 * Superadmin procedure
 *
 * For what can't be undone, like deleting orders and tickets outright.
 */
export const superadminProcedure = permissionProcedure("SUPERADMIN");
