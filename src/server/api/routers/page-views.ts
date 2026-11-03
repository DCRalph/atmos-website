import { z } from "zod";

import { Prisma } from "~Prisma/client";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { buyerClient, isBot } from "~/server/ticketing/client";
import { localTime, todayAndThisWeek } from "~/server/view-sql";
import { ANALYTICS_RANGES, rangeStart } from "~/lib/analytics-range";
import { pageOf, type PageGroup } from "~/lib/page-views";
import { DEFAULT_EVENT_TIMEZONE } from "~/lib/ticketing/dates";

/**
 * Views of the public site, page by page: written by every public page as it
 * opens, read by the Site tab on Analytics. Event pages are counted here like
 * any other page; their checkout journey keeps its own `TicketEventView`.
 */

/** Today and this week are the site's: New Zealand's. */
const SITE_TIMEZONE = DEFAULT_EVENT_TIMEZONE;

/** Where a view came from, as one word. Untagged is direct. */
const SOURCE = Prisma.sql`COALESCE(lower(v."utmSource"), 'direct')`;
const LOCAL = localTime(Prisma.sql`v."createdAt"`, SITE_TIMEZONE);

const reportInput = z.object({
  range: z.enum(ANALYTICS_RANGES).default("30d"),
  /** Only these pages. Empty means every page; so for the others. */
  paths: z.array(z.string().max(200)).max(300).default([]),
  sources: z.array(z.string().max(120)).max(50).default([]),
  devices: z.array(z.string().max(20)).max(5).default([]),
});

type ReportInput = z.infer<typeof reportInput>;
type Facet = "paths" | "sources" | "devices";

/**
 * The filters as SQL over `page_view v`. `except` leaves one out, for the
 * breakdown of that same thing: the sources list keeps every source while
 * one is picked, so another is one click away.
 */
function filterSql(input: ReportInput, since: Date | null, except?: Facet) {
  const clauses: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (since) clauses.push(Prisma.sql`v."createdAt" >= ${since}`);
  if (except !== "paths" && input.paths.length > 0) {
    clauses.push(Prisma.sql`v.path IN (${Prisma.join(input.paths)})`);
  }
  if (except !== "sources" && input.sources.length > 0) {
    clauses.push(Prisma.sql`${SOURCE} IN (${Prisma.join(input.sources)})`);
  }
  if (except !== "devices" && input.devices.length > 0) {
    clauses.push(Prisma.sql`v.device IN (${Prisma.join(input.devices)})`);
  }
  return Prisma.join(clauses, " AND ");
}

/** Picked things with no views still get a row, so they can be unpicked. */
function withPicked<T>(
  rows: T[],
  picked: string[],
  keyOf: (row: T) => string,
  empty: (key: string) => T,
): T[] {
  const present = new Set(rows.map(keyOf));
  return [...rows, ...picked.filter((key) => !present.has(key)).map(empty)];
}

export const pageViewsRouter = createTRPCRouter({
  /**
   * A visit opened a page. Sent by the public site on every navigation; a
   * visit counts once per page, so a refresh adds nothing. Pages `pageOf`
   * doesn't know, crawlers and link previews are dropped. Never fails: a
   * stats row is not worth an error on the page.
   */
  record: publicProcedure
    .input(
      z.object({
        path: z.string().max(200),
        visitId: z.string().min(8).max(64),
        utm: z
          .object({
            source: z.string().max(120).optional(),
            medium: z.string().max(120).optional(),
            campaign: z.string().max(120).optional(),
            content: z.string().max(120).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!pageOf(input.path) || isBot(ctx.headers)) return;
      await ctx.db.pageView
        .createMany({
          data: {
            path: input.path,
            visitId: input.visitId,
            utmSource: input.utm?.source ?? null,
            utmMedium: input.utm?.medium ?? null,
            utmCampaign: input.utm?.campaign ?? null,
            utmContent: input.utm?.content ?? null,
            device: buyerClient(ctx.headers)?.device ?? null,
          },
          skipDuplicates: true,
        })
        .catch(() => undefined);
    }),

  /**
   * Everything the Site tab draws, for a range and the filters. Every chart
   * follows every filter, except each breakdown ignores its own (see
   * `filterSql`). Today and this week ignore the range: they always mean
   * today and this week.
   */
  report: adminProcedure.input(reportInput).query(async ({ ctx, input }) => {
    const to = new Date();
    const since = rangeStart(input.range, to);
    const inRange = since
      ? Prisma.sql`v."createdAt" >= ${since}`
      : Prisma.sql`TRUE`;
    const filtered = filterSql(input, since);

    const [[headline], [all], hours, weekHours, pages, sources, devices] =
      await Promise.all([
        ctx.db.$queryRaw<
          {
            today: number;
            thisWeek: number;
            views: number;
            visits: number;
            first: Date | null;
          }[]
        >`
          SELECT
            ${todayAndThisWeek(Prisma.sql`v."createdAt"`, SITE_TIMEZONE)},
            COUNT(*) FILTER (WHERE ${inRange})::int AS views,
            COUNT(DISTINCT v."visitId") FILTER (WHERE ${inRange})::int AS visits,
            MIN(v."createdAt") FILTER (WHERE ${inRange}) AS first
          FROM "page_view" v
          WHERE ${filterSql(input, null)}
        `,
        // Every view in range, filters or not: what the filtered share is of.
        ctx.db.$queryRaw<{ views: number }[]>`
          SELECT COUNT(*)::int AS views FROM "page_view" v WHERE ${inRange}
        `,
        // Sparse hours; the chart lays them onto its own axis. Hours in UTC
        // are hours anywhere, so no zone is needed until the days.
        ctx.db.$queryRaw<{ at: Date; n: number }[]>`
          SELECT date_trunc('hour', v."createdAt") AS at, COUNT(*)::int AS n
          FROM "page_view" v
          WHERE ${filtered}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        // 1 is Monday.
        ctx.db.$queryRaw<{ day: number; hour: number; n: number }[]>`
          SELECT
            extract(isodow FROM ${LOCAL})::int AS day,
            extract(hour FROM ${LOCAL})::int AS hour,
            COUNT(*)::int AS n
          FROM "page_view" v
          WHERE ${filtered}
          GROUP BY 1, 2
        `,
        // Pages seen in range or this week, whatever the range: a page with
        // views today belongs on the list even on a 24 hour range.
        ctx.db.$queryRaw<
          { path: string; views: number; today: number; thisWeek: number }[]
        >`
          SELECT
            v.path,
            COUNT(*) FILTER (WHERE ${inRange})::int AS views,
            ${todayAndThisWeek(Prisma.sql`v."createdAt"`, SITE_TIMEZONE)}
          FROM "page_view" v
          WHERE ${filterSql(input, null, "paths")}
          GROUP BY 1
          HAVING COUNT(*) FILTER (WHERE ${inRange}) > 0
            OR COUNT(*) FILTER (WHERE ${LOCAL} >= date_trunc('week', now() AT TIME ZONE ${SITE_TIMEZONE})) > 0
        `,
        ctx.db.$queryRaw<{ source: string; views: number }[]>`
          SELECT ${SOURCE} AS source, COUNT(*)::int AS views
          FROM "page_view" v
          WHERE ${filterSql(input, since, "sources")}
          GROUP BY 1
          ORDER BY 2 DESC
        `,
        ctx.db.$queryRaw<{ device: string; views: number }[]>`
          SELECT v.device, COUNT(*)::int AS views
          FROM "page_view" v
          WHERE ${filterSql(input, since, "devices")} AND v.device IS NOT NULL
          GROUP BY 1
          ORDER BY 2 DESC
        `,
      ]);

    return {
      from: since ?? headline?.first ?? to,
      to,
      timezone: SITE_TIMEZONE,
      headline: {
        today: headline?.today ?? 0,
        thisWeek: headline?.thisWeek ?? 0,
        views: headline?.views ?? 0,
        visits: headline?.visits ?? 0,
        /** Every view in range, unfiltered. */
        allViews: all?.views ?? 0,
      },
      hours,
      weekHours,
      pages: await namePages(
        ctx.db,
        withPicked(
          pages,
          input.paths,
          (row) => row.path,
          (path) => ({ path, views: 0, today: 0, thisWeek: 0 }),
        ),
      ),
      sources: withPicked(
        sources,
        input.sources,
        (row) => row.source,
        (source) => ({ source, views: 0 }),
      ),
      devices: withPicked(
        devices,
        input.devices,
        (row) => row.device,
        (device) => ({ device, views: 0 }),
      ),
    };
  }),
});

/**
 * Pages with their names: gigs by title, events by name, both with their
 * date. A gig or event since deleted keeps its address as its name.
 */
async function namePages<
  T extends { path: string; views: number; thisWeek: number },
>(db: Prisma.TransactionClient, rows: T[]) {
  const pages = rows.flatMap((row) => {
    const page = pageOf(row.path);
    return page ? [{ ...row, ...page }] : [];
  });
  const keys = (group: PageGroup) =>
    pages.flatMap((page) =>
      page.group === group && page.key ? [page.key] : [],
    );

  const [gigs, events] = await Promise.all([
    db.gig.findMany({
      where: {
        OR: [{ id: { in: keys("gigs") } }, { slug: { in: keys("gigs") } }],
      },
      select: { id: true, slug: true, title: true, gigStartTime: true },
    }),
    db.ticketEvent.findMany({
      where: { slug: { in: keys("events") } },
      select: { slug: true, name: true, startsAt: true, timezone: true },
    }),
  ]);
  const gigByKey = new Map(
    gigs.flatMap((gig) => [
      [gig.id, gig] as const,
      ...(gig.slug ? [[gig.slug, gig] as const] : []),
    ]),
  );
  const eventBySlug = new Map(events.map((event) => [event.slug, event]));

  return pages
    .map(({ key, ...page }) => {
      const gig = page.group === "gigs" && key ? gigByKey.get(key) : undefined;
      const event =
        page.group === "events" && key ? eventBySlug.get(key) : undefined;
      return {
        ...page,
        name: gig?.title ?? event?.name ?? (key ? page.path : page.name),
        date: gig?.gigStartTime ?? event?.startsAt ?? null,
        timezone: event?.timezone ?? SITE_TIMEZONE,
      };
    })
    .sort(
      (a, b) =>
        b.views - a.views ||
        b.thisWeek - a.thisWeek ||
        a.name.localeCompare(b.name),
    );
}
