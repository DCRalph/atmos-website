# Analytics across events — plan

**Status (15 Oct 2026):** built, including §6 a to d and the page view count
from §6 c. Its migration,
`src/prisma/migrations/20261025000000_campaign_dates_and_event_views`, was
applied to production the same day.

One page that reads every event at once, and campaign types you pick from a
list so that page can say which kind of campaign sells.

## 1. What exists today

- **Per-event dashboard.** `EventOverview`
  (`src/components/admin/ticketing/event-overview.tsx`) on the `ticketAnalytics`
  router (`src/server/api/routers/ticket-analytics.ts`): headline numbers, profit
  and break even, the sales curve, a day × hour "When people buy" heat map
  (`WeekHeatmap` in `charts.tsx`), where buyers came from by UTM tags, order
  size, devices, tiers, paid with, the checkout funnel, money and GST, discount
  codes, CSV exports and the live door view. Every chart is scoped to one event.
- **Campaigns.** The `campaign` table (`prisma/schema.prisma:2489`) holds
  `source`, `medium`, `name` and `content` as free text, normalised to URL tags.
  Results are orders carrying exactly those tags (`campaignResults`,
  `src/server/api/routers/campaigns.ts:103`). Spend feeds the event's costs.
  The form (`campaigns-panel.tsx`) offers suggestions for `source` and nothing
  for `medium`.
- **Nothing crosses events.** The Payments page lists transactions, not
  analysis. The charts are hand-rolled single-series SVG with one accent colour,
  which the new page keeps.
- **Data on hand** (production, 15 Oct 2026): 4 events, 50 paid orders,
  78 tickets, 0 campaign rows, 23 orders tagged `ig` / `social` by hand-made
  links, device recorded on 5 orders. Thin now; every event adds to it.

## 2. Campaign types: a list, not a text box

The type is `medium`. It is already labelled "Kind of placement", it travels in
the link as `utm_medium`, and every order copies it, so grouping by type works
from orders alone, even where the campaign row was later deleted.

- **One list, one place.** `CAMPAIGN_TYPES` in `src/lib/ticketing/campaigns.ts`,
  `as const` with labels, shared by the form, the zod schema and the analytics
  page. Proposed:

  | tag      | label          |
  | -------- | -------------- |
  | `story`  | Story          |
  | `post`   | Post           |
  | `reel`   | Reel / video   |
  | `paid`   | Paid ad        |
  | `email`  | Newsletter     |
  | `poster` | Poster / QR    |
  | `bio`    | Bio link       |
  | `share`  | Repost / share |
  | `other`  | Other          |

- **Where it runs** (`source`) becomes a select too, from the list the form
  already suggests, reworked so it does not overlap the types: Instagram,
  Facebook, TikTok, X, YouTube, Email, Print, Website, Partner (artist or venue
  posts), Other.
- `content` ("Version") stays free text: it tells two posts of the same kind
  apart, and that is open-ended by nature.
- **Storage stays text.** `medium` is validated with `z.enum` at the API and
  becomes required; the column does not change, so there is no migration. A
  Prisma enum would double the list (enum names and URL tags) for no gain while
  there are zero rows. If types ever need DB-level enforcement, add it then.
- Orders whose medium is not in the list (hand-written links, today's `social`,
  the automatic `referral`) show on the analytics page under "Other", with the
  raw tag in the detail. Nothing is lost.
- The mobile admin screen only prints `medium` as text
  (`mobile/app/(admin)/[eventId].tsx:431`), so it needs no change.

## 3. The page: `/admin/analytics`

Admin only. Organisers see their own events on the event page; this page is the
one that reads across all of them. Nav entry "Analytics" in Events & sales,
between Payments and Campaigns.

**Controls.** Which events, not which dates. A segmented All · Past · Upcoming,
and a searchable pick of specific events for comparisons. Default: every event
that is not a draft or cancelled. The heat map and lead-time charts are about
patterns and want all the data there is; day ranges belong on the event page.

**Sections, top to bottom.**

1. **Headline strip.** Net revenue · Tickets sold · Orders · Events (held,
   coming) · Average net per event · Attendance across past events · Returning
   buyers.
2. **Sold per month.** Tickets or net revenue as monthly bars, one series.
3. **When people buy.** The heat map, day × hour, each order placed in its own
   event's timezone (`AT TIME ZONE e.timezone` in SQL). Toggle Orders ·
   Tickets · Revenue. Beside it, **how far out they buy**: tickets by days
   before doors (same day, 1–2, 3–6, 7–13, 14–27, 28+) with the cumulative
   share in the hover, so it reads "62% sell in the last week". This is the
   chart that says when to spend.
4. **Campaigns.**
   - **By type**: revenue per type, with checkouts → paid %, spend, return ×
     and cost per order in the detail.
   - **By channel** (source): the same shape.
   - **Top campaigns**: a short table linking into each event.
   - One SQL for all three: online orders joined to campaign rows on tags the
     way `campaignResults` does, plus the untagged bucket; spend summed from the
     campaign rows.
5. **Events compared.** A `DataTable`, one row per event: date, status,
   capacity, sold, % sold, net revenue, costs, profit, campaign spend, checkout
   conversion, attendance %, average ticket price. Sortable, CSV export, each
   row links to the event. This is the "all analytics for all events" grid.
6. **Buyers.** Order size, bought on, paid with, new vs returning per event
   (returning = bought any earlier event), marketing opt-in rate.
7. **The door.** Arrivals relative to doors across past events in 15-minute
   buckets, and no-show rate per event (in the table above).

## 4. Code

- `src/server/api/routers/analytics.ts` (new, `adminProcedure`), mounted as
  `analytics` in `root.ts`. Each procedure takes the same `events` filter and
  shares one `Prisma.sql` scope fragment:
  - `overview`: headline numbers and the events table.
  - `timing`: heat map cells `{ day, hour, orders, tickets, revenueCents }`,
    lead-time days (sparse, bucketed on the client), monthly series, arrivals
    relative to doors.
  - `campaigns`: by type, by source, top campaigns.
  - `buyers`: sizes, devices, paid with, returning per event, opt-in.
  - `exportCsv`: the events table.
    Aggregation stays in SQL using the fragments in
    `src/server/ticketing/order-sql.ts`, as the event dashboard does.
- `src/lib/ticketing/lead-time.ts`: the day buckets and labels, pure, with a
  focused bun test. `campaigns.ts` gains `CAMPAIGN_TYPES`, `CAMPAIGN_SOURCES`
  and label helpers.
- `src/components/admin/ticketing/analytics-overview.tsx` built from
  `charts.tsx` (`WeekHeatmap`, `BucketBarChart`, `BarList`, `CrossTab`,
  `StatStrip`, `ChartCard`), `DataTable` and `Segmented`. No chart library.
- `src/app/(admin)/admin/analytics/page.tsx` inside `AdminSection`, plus the
  entry in `admin-navigation.ts`.
- Campaign form: two `Select`s from `~/components/ui/select`; router schema
  moves to `z.enum`; the Campaigns page copy mentions types.
- No DB migration for any of this.

## 5. Order of work

1. Campaign types. Small, independent, and the sooner links carry real types
   the sooner the analytics have something to say.
2. Two or three static mocks of the analytics page in
   `docs/mocks/analytics-options.html`, published for a pick, before any
   component is written.
3. Router, page and nav.
4. Follow-ups chosen from §6.

## 6. Ideas, open

Each stands alone; pick any.

- **a. Pace line on the event page.** A dashed "your average event at this many
  days out" on each event's sales curve, from the lead-time data in §3.3.
  Turns the cross-event numbers into a per-event signal while there is still
  time to act. Cheap once §3.3 exists.
- **b. Clicks → checkouts → paid per campaign.** Campaigns with a short link
  already have click counts (`ShortLinkClick`), joinable on
  `campaign.shortLinkId`. Shows which posts people tap and then do not buy
  from. Cheap.
- **c. Event page views.** The funnel starts at checkout because nothing counts
  a view; Vercel Analytics is not queryable. A small server-side view log on
  `/events/[slug]` (count, visit id, attribution; no cookies) would give
  views → checkout → paid per campaign. Medium.
- **d. Campaign dates.** `startsAt` / `endsAt` on a campaign, so results can
  mean "while it ran" rather than lifetime, spend can be per day, and the sales
  curve can mark the day each campaign went live. Medium.
- **e. Sales by gig tag.** Events link to gigs and gigs carry tags, so revenue
  and sell-through by tag (genre, night) comes almost free where events have a
  gig attached. Cheap.
- **f. Price points.** Sell-through and revenue by tier price band, and the
  early-bird share, across events. Cheap.
- **g. Weekly digest push.** A Monday push with last week's sales and campaign
  results per event, on the alerts that already exist. Cheap.
- **h. Will GPT.** Expose the new procedures as tools so "which campaign type
  sold best this year" is a question, not a page. Medium.
- **i. Event benchmarks.** Days to sell out and share sold in the first 48
  hours after announcement, as columns in the events table. Cheap.

## 7. Questions before building

1. Is the type list in §2 right, and should "where it runs" become a dropdown
   as well, or stay free text with suggestions?
2. Event filter: All · Past · Upcoming plus a pick, no date range. Agreed?
3. Which of §6 go in the first version? Suggested: a, b, f.
4. Heat map default measure: orders, with tickets and revenue as toggles?
5. Admin only, or should organisers get a version limited to their events?
