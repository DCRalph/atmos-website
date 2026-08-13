# Set list and set times — plan

An event currently knows one moment: `startsAt`. Everything the analytics say
about the night is therefore said about the night as a whole — 412 admitted,
peak arrival rate 14/min, 82% turned up. None of it can answer the question a
promoter actually asks the morning after: **who did they come for, and who held
them.**

A set list fixes that with one small table and a rule for turning it into
windows. Every number below falls out of joining the existing append-only scan
log (`ticket_scan`) against those windows.

## 1. What a set is

A row per performance on the night: name, when it starts, what kind of slot it
is. Not a song list — the word "set" here means "DAWN CHORUS, 10:30–11:15,
direct support".

Three things make it worth having as a real table rather than a text field on
the event:

1. **The door already logs every arrival and departure with a timestamp.**
   Windows are the only missing half of a join that is otherwise free.
2. **Slot class is comparable across events.** "Openers pull 40% of the room"
   is only sayable if `OPENER` means the same thing at every event.
3. **Scheduled and actual are different numbers.** A headliner going on 25
   minutes late is exactly the thing that makes an arrivals curve look wrong,
   and exactly the thing worth reporting on later.

## 2. Data model

```prisma
/// What kind of slot this is. Deliberately a fixed enum rather than an
/// organiser-editable table like `AccessLevel`: the whole value of classing a
/// set is comparing like with like *across* events, and a per-promoter
/// vocabulary makes that impossible. Display wording lives in
/// `~/lib/ticketing/set-roles.ts`, so relabelling never needs a migration.
///
/// If per-promoter naming is ever genuinely needed, the enum → table
/// conversion is the identity mapping already done once for access levels
/// (`src/prisma/migrations/20260812000000_comp_tickets_and_levels`).
enum TicketSetRole {
  OPENER
  SUPPORT
  /// The slot straight before the headliner. Worth separating from SUPPORT —
  /// it is the one that inherits the headliner's crowd.
  DIRECT_SUPPORT
  HEADLINE
  DJ_SET
  GUEST
  /// Changeover, interval, a between-sets DJ. Occupies time, is not a draw.
  INTERVAL
  OTHER
}

model TicketEventSet {
  id      String      @id @default(cuid())
  eventId String
  event   TicketEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  name String
  role TicketSetRole @default(SUPPORT)

  /// Free text under the name — "b2b with Kōura", "live band set". Display
  /// only; `role` is what analytics group by.
  subtitle String?

  /// Optional link to the artist's own profile, so the line-up and the creator
  /// pages are one dataset. Null is normal: a guest DJ with no profile still
  /// gets a set.
  creatorProfileId String?
  creatorProfile   CreatorProfile? @relation(fields: [creatorProfileId], references: [id], onDelete: SetNull)

  /// Planned times. Full timestamps, not times-of-day — a 1am headliner is on
  /// the following calendar date and storing a clock time would break every
  /// comparison. Stored UTC like everything else, entered and rendered in the
  /// event's timezone.
  startsAt DateTime
  /// Null means "until whatever comes next" — see §3.
  endsAt   DateTime?

  /// What actually happened. Set from one button on the live door page. When
  /// present these win everywhere in analytics; the planned pair stays put so
  /// the variance is still reportable.
  actualStartAt DateTime?
  actualEndAt   DateTime?

  /// Multi-room events. Null is the main room.
  stage String?

  /// Shown on the public event page. Off by default: a line-up is usually
  /// locked in the admin days before it is announced.
  isPublic Boolean @default(false)

  /// Not public, ever. "Needs own monitors", "hard out 11:20 for noise".
  notes String?

  /// Display order within an identical start time, and the order the manager
  /// panel drags into. Times are the source of truth for analytics.
  sortOrder Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([eventId, startsAt])
  @@index([creatorProfileId])
  @@map("ticket_event_set")
}
```

Back-relations: `sets TicketEventSet[]` on `TicketEvent` (beside `tiers`,
`prisma/schema.prisma:1128`) and `eventSets TicketEventSet[]` on
`CreatorProfile` (`schema.prisma:318`).

`ActivityType` gains `TICKET_SET_CREATED`, `TICKET_SET_UPDATED`,
`TICKET_SET_DELETED`. Migration goes in
`src/prisma/migrations/<timestamp>_event_set_list/` — additive, no backfill,
nothing existing changes.

## 3. The window rule

Everything downstream depends on one function, and it must exist in exactly one
place — `~/server/ticketing/sets.ts`, mirroring how `compAccounting`
(`src/server/ticketing/comps.ts`) is the single source of comp numbers.

For each set, in start order:

```
start = actualStartAt ?? startsAt
end   = actualEndAt ?? endsAt ?? (next set's start) ?? (event.endsAt ?? last scan ?? now)
```

Two rules that keep this honest:

- **A scan belongs to the set that started most recently before it.**
  Last-started-wins, so overlapping sets (two stages, or a sloppy schedule)
  never double-count a single arrival. Cheap to explain, cheap to compute.
- **Scans before the first set start belong to no set.** They are the
  pre-doors/early crowd and get their own "before the music" row rather than
  being silently folded into the opener, which would flatter every opener.

Multi-stage caveat, stated plainly in the UI: with sets on more than one stage,
per-set arrivals are the door's timeline, not the room's. The door does not
know which room somebody walked into. Reporting per-stage arrivals would be a
lie; the panel shows stage as a label and nothing more.

## 4. What this unlocks

Every number below is built from **one primitive**, defined once in §4.1. Get
that wrong and the whole feature reports confident nonsense, so it comes first.

### 4.1 Presence deltas — the primitive

The instinct is to count admitting scan rows as +1 and `DEPARTED` as −1. **That
is wrong**, and the scan code says why:

- `REENTRY` is written when somebody scans again **while still inside**, at any
  event with re-entry switched on (`src/server/ticketing/scan.ts:411`). It does
  not imply they ever left. Counting it as +1 inflates occupancy at exactly the
  events — the ones with re-entry — where people scan most often.
- `DENIED` is never itself a departure. When the door refuses somebody who was
  already inside, `denyTicket` writes a **separate** `ADMISSION_REVERTED` row
  (`scan.ts:566`), and that row is the delta.
- `markDeparted` does not check that the person is inside
  (`src/server/api/routers/door.ts:484`) — deliberately, so watching people
  leave never waits on a lookup. Two departures in a row, or a departure for
  somebody never admitted, are both possible and must both be inert.

So occupancy changes on **state transitions, not on rows**. Per ticket, in time
order, `ADMITTED | OVERRIDE_ADMITTED | REENTRY` is an *enter* and
`DEPARTED | ADMISSION_REVERTED` is an *exit*; a delta is emitted only where the
state actually flips. In SQL that is one `LAG`:

```sql
-- src/server/ticketing/occupancy.ts — presenceDeltas(eventId)
WITH moves AS (
  SELECT
    s."ticketId",
    s."createdAt",
    (s.result IN ('ADMITTED','OVERRIDE_ADMITTED','REENTRY')) AS is_enter
  FROM "ticket_scan" s
  WHERE s."eventId" = $1
    AND s."ticketId" IS NOT NULL
    AND s.result IN (
      'ADMITTED','OVERRIDE_ADMITTED','REENTRY','DEPARTED','ADMISSION_REVERTED'
    )
),
flips AS (
  SELECT
    "ticketId", "createdAt", is_enter,
    LAG(is_enter) OVER (PARTITION BY "ticketId" ORDER BY "createdAt") AS was_in,
    ROW_NUMBER() OVER (PARTITION BY "ticketId" ORDER BY "createdAt") AS seq
  FROM moves
)
SELECT
  "ticketId",
  "createdAt" AS at,
  CASE WHEN is_enter THEN 1 ELSE -1 END AS delta,
  -- First time this ticket ever came through, as opposed to a return from a
  -- smoke. The distinction is the whole of §4.3.
  (is_enter AND seq = 1) AS first_entry
FROM flips
WHERE (is_enter AND (was_in IS NULL OR NOT was_in))
   OR (NOT is_enter AND was_in)
ORDER BY at
```

Two properties this must satisfy, and both are worth a test:

1. **Summing every delta equals `admittedCount(eventId)`**
   (`scan.ts:1207`). The existing function is this same rule evaluated at
   *now*; the new one is it evaluated continuously. If they can disagree, the
   live tile and the set table will disagree in front of a promoter.
2. **The running sum is never negative.** If it can go below zero, an exit is
   being counted without its enter and the `LAG` filter is broken.

`presenceDeltas` lives in `src/server/ticketing/occupancy.ts` rather than
`sets.ts`, because it is a fact about scans and stays useful on the hundreds of
events that will never have a set list.

### 4.2 Per-set table — the core deliverable

`setWindows` (§3) gives `[start, end)` per set; deltas get bucketed into them.
Everything is arithmetic over the delta stream, so it is one query for the
windows and one for the deltas, joined in TypeScript — the deltas are at most a
few thousand rows for a big event and reuse across §4.2–4.5 saves four more
round trips.

| Column | Definition |
| --- | --- |
| **In at start** | running sum of all deltas strictly before `start` |
| **Arrived** | count of `+1` deltas inside the window |
| **— of which new** | `+1` deltas where `first_entry` — people arriving for the first time |
| **— of which returns** | the remainder: smokers, re-entries |
| **Left** | count of `DEPARTED`-caused `−1` deltas inside the window |
| **Corrections** | `ADMISSION_REVERTED`-caused `−1` deltas — shown apart, because a manager undoing a mis-scan is not a person walking out |
| **In at end** | in-at-start + arrived − left − corrections |
| **Peak** | max running sum inside the window, and the minute it happened |
| **Change** | in-at-end − in-at-start, the retention number |

"Change" is the column worth building the feature for. An opener that hands the
room over larger than it received it did its job. A headliner that leaks 60
people in its first fifteen minutes is a booking decision for next time, and
right now nothing in the system can tell you that happened.

Rows for sets that have not started yet render as `—`, not as zeroes — an
opener with 0 arrivals and an opener that has not gone on look identical
otherwise, and one of them is alarming.

Above the table sits the **before the music** row (§3): everyone who came in
before the first set started. Folding those into the opener would flatter every
opener at every event, permanently.

### 4.3 Draw attribution — who they came for

Arrivals are not draw: somebody who walks in during the headliner's set may
have been queuing since the support. The heuristic is a window offset from the
set start rather than the set itself:

```
draw(set) = count of first_entry deltas in [start − 30min, start + 15min)
```

Three rules keep it honest:

- **`first_entry` only.** A return from the smoking area is not a draw. This is
  what the `seq = 1` flag in §4.1 exists for.
- **Windows overlap and that is fine.** Unlike §4.2, a person arriving in a
  changeover can legitimately be credited to both the set ending and the set
  starting; the column is a share of attention, not a partition. The UI says
  **arrived around this set** and never presents draw and arrivals in the same
  column, because they do not sum to the same total.
- **Labelled a guess.** A tooltip states the window in plain words. The door
  cannot read minds and the dashboard should not pretend it can.

The cut that pays for itself: the same count split by `ticket.accessLevel` and
`ticket.tierId` (both already on `ticket`, no new joins) — whether the VIPs
turned up only for the headliner, whether the early-bird buyers are the ones
who come early. That is a `GROUP BY` on a join the query already does.

### 4.4 Occupancy curve, peak, and capacity

The running sum of deltas sampled every 5 minutes is a room-occupancy curve —
a genuinely new chart, not a variant of the arrivals bars, which only ever go
up. Arrivals answer "how hard is it coming right now"; occupancy answers "how
full is it right now", and only the second one can fall.

From the same array, free: **peak occupancy and its timestamp**, and the set
that timestamp lands in. "Peak 412 at 11:38pm, during HEADLINE" is a sentence
the dashboard cannot produce today, and it is also the number a venue's licence
cares about. With `event.capacity` set, the curve draws a capacity rule and the
tile reads `412 / 450 peak (92%)`.

### 4.5 Set boundaries drawn on every chart

Cheapest change, largest payoff per line. `BucketBarChart` and
`TimeSeriesChart` (`src/components/admin/ticketing/charts.tsx:61,240`) take an
optional

```ts
markers?: { x: Date; label: string; tone?: "set" | "doors" | "peak" }[]
```

and draw a dashed vertical rule with a small rotated label, clipped to the plot
area and skipped when two markers land within ~8px of each other so a tight
changeover does not turn into a smear. Applied to the arrivals chart on the
live page, the existing spike either sits under the headliner's rule or it does
not — most of the questions above, answered by eye, with no new query.

### 4.6 On now / next up, live

On the live door page the same windows give a tile with no extra query beyond
the sets themselves: `HEADLINE · DAWN CHORUS · 22 min in`, next up beneath it,
and the room's current occupancy. Beside it, the **Went on now** / **Off now**
buttons that stamp `actualStartAt` / `actualEndAt`.

Those buttons are the entire cost of getting real times instead of planned
ones, so they have to be one tap on a phone in the dark, next to the numbers
somebody is already watching. Anything more ceremonial will not get pressed and
phase 3 quietly produces nothing.

### 4.7 Scheduled vs actual

Once actual times exist, variance is a subtraction: `actualStartAt − startsAt`
per set, and the same for the duration. Two readings, both new:

- **Per event, on the night**: "running 12 minutes behind" as a live tile,
  computed from the last set that actually started.
- **Aggregated by role**: "your headliners go on 18 minutes late on average,
  your changeovers run 6 minutes long." That is a fact worth having before the
  next door schedule is written, and it is unobtainable today because nobody
  writes the real times down.

Sets with no actual times are excluded from the average rather than treated as
on time — an unstamped set means nobody pressed the button, not that it ran to
the minute.

### 4.8 Cross-event benchmarks by role

Because `role` is a fixed enum (§2), every query above runs across an
organiser's whole history. Averages per role: arrivals, draw, retention,
lateness.

The one non-obvious requirement is **normalisation** — a 200-cap room and a
1,200-cap room cannot be averaged raw. Every cross-event figure is a share:
draw as a percentage of tickets issued for that event, retention as a
percentage of the room at set start. Sample size is shown next to each average
(`HEADLINE · 9 sets`), and anything under three sets renders the count only,
because an average of two nights is a rumour.

This is a separate page rather than a card on an event — it is a question about
a season, not about a night. Phase 4.

### 4.9 Exports

The scans CSV (`ticket-analytics.ts:578`) gains a **Set** column, resolved
through the same windows. That single column means anybody can pivot the whole
thing in Excel without waiting for a chart to be built, and it is the cheapest
insurance against this plan's analytics missing a question somebody actually
has.

A `sets` export kind gives the schedule itself: name, role, planned, actual,
variance, and every per-set number from §4.2.

### 4.10 Numbers that must agree

Stated as invariants because a dashboard that contradicts itself is worse than
one that says less:

- Per-set **arrived** across all sets, plus the *before the music* row, equals
  the total count of `+1` deltas for the event.
- Occupancy at the end of the last window equals `admittedCount(eventId)`
  (§4.1, property 1).
- **In at end** of one set equals **in at start** of the next. Any gap is a
  window-resolution bug, and the table should be able to assert it in a test
  rather than hope.
- Draw figures deliberately do **not** sum to arrivals (§4.3), so they never
  appear in the same total row.

## 5. Where it plugs in

**Server**

- `src/server/ticketing/occupancy.ts` *(new)* — `presenceDeltas(eventId)` and
  the running-sum helpers (§4.1). Knows nothing about sets, so the live view
  gets an occupancy curve on events that never have one.
- `src/server/ticketing/sets.ts` *(new)* — the window rule (§3), and
  `setWindows(eventId)` returning resolved windows. Single source of truth;
  nothing else may recompute a window. Everything in §4.2–4.9 is
  `setWindows` × `presenceDeltas` and nothing more.
- `src/server/api/routers/ticket-events.ts` — `createSet` / `updateSet` /
  `deleteSet` / `reorderSets` / `markSetStarted` / `markSetEnded`, mirroring
  the tier CRUD at `:638`. **`eventOrganiserProcedure`, not `adminProcedure`**:
  a promoter running their own night must be able to fix a set time at 9pm
  without an admin. (Tiers are admin-only because they move money; set times do
  not.) `byId` and the admin `bySlug` include `sets: { orderBy: { startsAt: "asc" } }`.
- `src/server/api/routers/ticket-analytics.ts` — `setPerformance` (§4b–d),
  `live` gains `sets: { onNow, nextUp, markers }`, `exportCsv`'s `scans` kind
  gains a **Set** column so anyone can pivot it in Excel without waiting for a
  chart to be built.
- Validation is a **warning, not a block** — the house rule from the comps plan
  (`COMPS-PLAN.md` §"Warning, not blocking"). A set outside
  `[doorsAt − 2h, endsAt + 6h]` returns a warning string the panel shows in
  amber. Sets that overlap, likewise. Nothing is rejected: the night is the
  night, and a system that argues with a door manager at 11pm loses.

**Admin / organiser UI**

- `src/components/admin/ticketing/set-list-manager.tsx` *(new)* — the tier
  manager's row-with-inline-edit pattern (`tier-manager.tsx:33`), `DateTimePicker`
  for both times, a role `Select`, and a creator-profile combobox fed by the
  existing `pickers.creatorProfiles` (`src/server/api/routers/pickers.ts:296`).
  One "add from line-up" action that seeds sets from the linked gig's
  `GigCreator` rows, so a gig that already lists its artists does not get typed
  in twice.
- `src/app/(admin)/admin/events/[id]/page.tsx:139` — a **Set list** tab between
  Tiers and Orders.
- `src/app/(organiser)/organiser/events/[id]/page.tsx:53` — the same tab; the
  organiser page currently has only Analytics and Orders, and set times are the
  one thing an organiser needs to edit themselves.
- `src/components/admin/ticketing/event-overview.tsx` — the per-set table (§4b)
  under the tier bars, plus markers passed into the sales chart.
- `src/components/admin/ticketing/live-door-analytics.tsx:52` — an **On now**
  stat tile (`HEADLINE · DAWN CHORUS · 22 min in`, next up beneath it) and a
  "Went on now" / "Off now" button pair that writes `actualStartAt` /
  `actualEndAt`. That button is the entire cost of getting real times, and it
  has to be one tap on a phone in the dark or it will not get pressed.

**Public**

- `toPublicEvent` (`src/server/api/routers/ticket-events.ts:966`) exposes only
  `isPublic` sets, only `name`/`subtitle`/`role`/`startsAt`/`stage`/creator
  handle. `notes` and actual times never cross that boundary.
- `src/app/(main)/events/[slug]/page.tsx:96` — a **Line-up** block under the
  detail rows: time, name, role chip, linking to `/creators/<handle>` where one
  is attached. Renders nothing when no set is public, so existing events are
  untouched.

## 6. Phases

1. **Model, CRUD, admin tab.** A set list you can type in and read back. Public
   line-up block behind `isPublic`. No analytics yet — this alone replaces the
   text file the door schedule currently lives in.
2. **Windows and the numbers.** `sets.ts`, `setPerformance`, chart markers,
   per-set table, Set column in the scans CSV.
3. **Actual times.** The live-page buttons, "on now" tile, scheduled-vs-actual
   variance. Everything in phase 2 silently gets more accurate.
4. **Cross-event benchmarks by role.** Its own page.

Phases 1 and 2 are the feature; 3 is what makes it true; 4 is what makes it
interesting over a season.

## 7. Traps worth naming up front

- **Cross-midnight.** Most headline sets are on the next calendar day. Any UI
  that takes a time without a date is wrong, and any grouping that uses
  `date_trunc('day')` on a raw timestamp splits a night in half. Use
  `eventDayKey` (`src/lib/ticketing/dates.ts:73`) semantics — the event's zone,
  and the event's night.
- **`REENTRY` does not mean somebody left and came back.** It is written every
  time a ticket scans again at a re-entry event, whether or not they ever went
  out (`scan.ts:411`). This is the trap that would quietly inflate every
  occupancy figure in the feature, and §4.1 exists to close it. Any query that
  treats scan rows as occupancy deltas is wrong.
- **Deleting a set changes history.** Windows are derived, so removing a set
  silently rewrites every past number. Deleting a set that has scans inside its
  window should warn, the same way a tier with issued tickets refuses deletion
  (`ticket-events.ts:746`) — warn here rather than refuse, since a set typed in
  wrong must be removable.
- **Empty set list is the normal case.** Every panel, chart and export needs a
  clean "no sets" path; the overview must not sprout an empty table on the
  hundreds of events that will never have one.
