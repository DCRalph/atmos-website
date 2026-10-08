# Tasks: plan

A shared to-do system for running events, for admins only. Any admin can be
given a task with a due time, every admin can see where everything is on the
web admin and in the app, and the system keeps after anyone who falls behind until it is done
or they say why it can't be.

Status: plan only. Nothing here is built yet.

## Goals

1. Enter tasks for people with a due time, optionally tied to a gig.
2. One shared view of every task, on a calendar and as a list, on web and mobile.
3. Push reminders that escalate until the task is done or a delay is reported.
4. A page in the admin where everybody can see who is behind.
5. Tasks can depend on other tasks. A late task pushes the ones waiting on it back.
6. Anyone can say "I can't make this by then, because X", and everyone affected hears about it.
7. Will GPT can read, create and reshuffle tasks, and AI helps plan and triage.
8. Commitments made in email and group chats become tasks without retyping them.

## What we already have, and reuse

This feature is mostly new tables and screens wired into machinery that exists.

| Need                      | Existing piece                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Pushes to named people    | `sendPush({ audience: { kind: "users", userIds } })` in `src/server/push.ts`         |
| Notification history      | `publish()` in `src/server/notify.ts`, with an audience override (like run sheets)   |
| A ticker                  | `/api/cron/run-sheet`, hit every 5 minutes. Add `sweepTasks()` beside the others     |
| Send-once guarantees      | The `GigScheduleFire` pattern: insert a unique row before sending                    |
| Tap a push, open a screen | `data.url` routing in `mobile/src/lib/push.ts`                                       |
| Gated mobile screens      | `StaffGate` and `BiometricGate`, as `(admin)` and `(staff)` use them                 |
| Lock screen countdown     | The run sheet Live Activity: `mobile/modules/run-sheet-activity`, `mobile/widget`    |
| Admin-only API            | `adminProcedure`; Will GPT is already offered everything behind it                   |
| AI with admin powers      | Will GPT reaches every admin tRPC procedure automatically (`src/server/will-gpt`)    |
| Cheap one-off AI calls    | `openRouter()` in `src/server/will-gpt/openrouter.ts`                                |
| Receiving email           | Resend is already the sender; Resend Receiving adds inbound on the same account      |
| Audit trail               | `logActivity()` and the `ActivityType` enum                                          |
| Date pickers / calendar   | `react-day-picker`, `src/components/ui/calendar.tsx`, `datetime-picker.tsx`          |
| Timezone                  | `RUN_SHEET_TIMEZONE` (`Pacific/Auckland`) for quiet hours and copy                   |

Will GPT is a bridge over tRPC, so the moment a `tasks` router exists Will GPT
can use it. Most of the "integrate with Will GPT" work is getting the risk
classification and the prompt right, not building new AI plumbing.

## The 5 minute ticker

The sweep runs every 5 minutes, so nothing in this design needs better than
5 minute accuracy, and nothing user-facing waits on the sweep when it doesn't
have to:

- **Reminders** are hours apart, so landing up to 5 minutes late is invisible.
- **Things people do** (complete, delay, take, reassign) send their pushes and
  Live Activity updates from the mutation itself, straight away. The sweep only
  handles things that happen because time passed.
- **Only the latest due step is sent.** If the ticker was down for a day, a task
  sends its current reminder once, not the five it missed. Earlier steps are
  recorded as skipped. This replaces a time-based write-off threshold and works
  at any tick rate.
- **Creation notices** go out on the next tick, batched per person, so "within
  5 minutes" is the delay and also the batching window.

Side note on run sheets: `docs/RUN-SHEET.md` assumes a one-minute ticker. At 5
minutes a cue can land up to 5 minutes late, so a "5 minutes until" warning
can arrive as the set starts. Worth deciding separately: either default lead
times of 10+ minutes, or a one-minute ping just on gig nights.

## Statuses

Seven stored statuses for what a person has said about the task, plus derived
flags for what the clock and the dependency graph say. Keeping these separate
means a status never goes stale: nobody has to remember to set "overdue" or
"waiting", and nobody can.

### Stored

| Status        | Meaning                                                                         | Nagged?                              |
| ------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| `PROPOSED`    | Suggested from an email, a shared chat, or a Will GPT plan. Nobody owns it yet. | No. Auto-dismissed after 7 days.     |
| `TODO`        | Assigned, not started.                                                          | Yes                                  |
| `IN_PROGRESS` | The assignee has started.                                                       | Yes, softer copy before due          |
| `BLOCKED`     | Stuck on something outside the system ("venue hasn't replied"). Needs a reason and a check-back date. | Paused until the check-back date, then "still blocked?" |
| `IN_REVIEW`   | The assignee says it's done; the reviewer has to sign off (poster proof).       | The reviewer is, not the assignee    |
| `DONE`        | Finished and accepted.                                                          | No                                   |
| `CANCELLED`   | Not happening. Dismissed proposals land here too.                               | No                                   |

Notes:

- **Blocked is not an escape hatch.** The due date keeps running. A blocked
  task past due still shows in the alerts, labelled blocked with its reason,
  but it counts as flagged rather than as a silent miss. Blocked on *another
  task* is a dependency, not this status.
- **Review only when there's a reviewer.** A task with `reviewerId` goes
  `IN_PROGRESS → IN_REVIEW → DONE`; one without goes straight to `DONE`. The
  assignee's clock stops at `submittedAt`, so a slow reviewer doesn't count
  against them. Sending it back returns it to `IN_PROGRESS` with a comment.
- **Dependencies are satisfied at `DONE` only.** A poster in review is not
  ready to print.

### Derived (computed, never stored)

| Flag          | When                                                              |
| ------------- | ----------------------------------------------------------------- |
| Waiting       | An open dependency. Not nagged; you can't do it yet.              |
| Due soon      | Within 24 hours.                                                  |
| Overdue       | Past `dueAt` and not submitted.                                   |
| At risk       | Projected past its hard deadline (usually the gig).               |
| Up for grabs  | Offered up by its assignee (see Hot potato).                      |

### Transitions

| From                             | To            | Who                                  |
| -------------------------------- | ------------- | ------------------------------------ |
| `PROPOSED`                       | `TODO`        | any admin (accepting)                |
| `TODO`                           | `IN_PROGRESS` | assignee                             |
| `TODO`, `IN_PROGRESS`            | `BLOCKED`     | assignee, with reason + check-back   |
| `BLOCKED`                        | `IN_PROGRESS` | assignee                             |
| `TODO`, `IN_PROGRESS`, `BLOCKED` | `IN_REVIEW`   | assignee, when there is a reviewer   |
| `TODO`, `IN_PROGRESS`, `BLOCKED` | `DONE`        | assignee, when there is no reviewer  |
| `IN_REVIEW`                      | `DONE`        | reviewer                             |
| `IN_REVIEW`                      | `IN_PROGRESS` | reviewer, with a comment             |
| `DONE`                           | `IN_PROGRESS` | creator, admin (reopen)              |
| any open                         | `CANCELLED`   | creator, admin                       |

Admins can make any transition on someone's behalf; it's logged as such. The
table lives in `src/lib/tasks/status.ts` as data, so the router, the web
buttons and the app buttons all read the same rules.

## Data model

```prisma
enum TaskStatus {
  PROPOSED
  TODO
  IN_PROGRESS
  BLOCKED
  IN_REVIEW
  DONE
  CANCELLED
}

enum TaskSource {
  MANUAL
  WILL_GPT
  PLAYBOOK
  EMAIL
  SHARE      // shared or pasted chat, screenshot, voice note
}

/// One thing somebody has to do by a time.
///
/// `plannedDueAt` is what was agreed when the task was set and never moves on
/// its own. `dueAt` is when it is due now, after upstream slips and reported
/// delays. The gap between the two is the whole accountability story: it says
/// how far a task moved, and the event log says why.
model Task {
  id    String  @id @default(cuid())
  title String
  notes String? @db.Text

  /// Optional. Tasks for a gig show on that gig, sort by it, and default their
  /// hard deadline to its start time.
  gigId String?

  /// One owner. Shared ownership is how nobody owns it.
  assigneeId  String?
  /// Optional sign-off. When set, finishing goes through IN_REVIEW.
  reviewerId  String?
  createdById String?

  status TaskStatus @default(TODO)

  plannedDueAt DateTime
  dueAt        DateTime

  /// Cannot be pushed past this, however late its dependencies are. Pushing
  /// into it raises an at-risk alert instead of quietly moving.
  hardDeadlineAt DateTime?

  /// Escalates faster and goes to every admin when it slips.
  critical Boolean @default(false)

  /// BLOCKED only: when to ask "still blocked?".
  checkBackAt DateTime?
  /// Offered up by the assignee. Still theirs until someone takes it.
  upForGrabs  Boolean   @default(false)

  startedAt     DateTime?
  /// When the assignee finished: IN_REVIEW, or DONE without a reviewer.
  submittedAt   DateTime?
  completedAt   DateTime?
  completedById String?

  /// Where it came from. For EMAIL and SHARE, the line that prompted it, so a
  /// proposal can be judged without opening the source.
  source      TaskSource @default(MANUAL)
  sourceRef   String?    // Resend email id, upload id
  sourceQuote String?    @db.Text

  playbookItemId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([assigneeId, status, dueAt])
  @@index([gigId, dueAt])
  @@index([status, dueAt])
  @@map("task")
}

/// `taskId` cannot be finished until `dependsOnId` is DONE.
///
/// `gapMinutes` is how long `taskId` needs after its dependency is done. It
/// defaults to the gap between the two planned dates when the link is made,
/// so a two day slip moves the next task two days. Lowering it is how you
/// say "there is slack here, absorb it".
model TaskDependency {
  taskId      String
  dependsOnId String
  gapMinutes  Int

  @@id([taskId, dependsOnId])
  @@index([dependsOnId])
  @@map("task_dependency")
}

enum TaskEventKind {
  CREATED
  ACCEPTED         // a proposal became a task
  ASSIGNED
  STATUS_CHANGED   // fromStatus/toStatus set; body is the reason when one is required
  DUE_CHANGED      // edited by hand
  SHIFTED          // moved because something upstream moved; causeTaskId set
  DELAY_REPORTED   // the assignee said "I can't make it"; body is the reason
  OFFERED          // put up for grabs
  TAKEN            // hot potato: actorId took it from fromUserId
  NUDGED           // a reminder went out
  ESCALATED        // it hit the alerts / admins were told
  COMMENT
}

/// The task's timeline. Also the source of every standings number, so they are
/// computed rather than stored and cannot drift.
model TaskEvent {
  id          String        @id @default(cuid())
  taskId      String
  actorId     String?       // null for the system
  kind        TaskEventKind
  body        String?       @db.Text
  fromStatus  TaskStatus?
  toStatus    TaskStatus?
  fromDueAt   DateTime?
  toDueAt     DateTime?
  fromUserId  String?       // ASSIGNED, TAKEN
  causeTaskId String?       // SHIFTED: which task's slip moved this one
  createdAt   DateTime      @default(now())

  @@index([taskId, createdAt])
  @@index([actorId, kind])
  @@map("task_event")
}

/// One reminder step the sweep has dealt with. Unique on
/// (task, step, forDueAt) so two overlapping ticks cannot both send it, and
/// so moving a due date restarts the ladder rather than skipping it.
/// Same idea as `GigScheduleFire`.
model TaskNudge {
  id        String   @id @default(cuid())
  taskId    String
  step      String   // "t-24h", "t-2h", "due", "overdue-1", "check-back", ...
  forDueAt  DateTime
  skipped   Boolean  @default(false)
  devices   Int      @default(0)
  delivered Int      @default(0)
  createdAt DateTime @default(now())

  @@unique([taskId, step, forDueAt])
  @@map("task_nudge")
}

enum TaskRoundReason {
  SILENT_MISS  // went 24h overdue without a word
  RESCUED      // somebody took it off them while overdue
}

/// The rounds ledger. One drink owed, per row.
model TaskRound {
  id          String          @id @default(cuid())
  owedById    String
  /// Who it's owed to: the rescuer for RESCUED, null (the team) for SILENT_MISS.
  owedToId    String?
  taskId      String
  reason      TaskRoundReason
  settledAt   DateTime?
  settledById String?
  /// Set by an admin when it wasn't fair. Waived rounds don't count.
  waivedAt    DateTime?
  createdAt   DateTime        @default(now())

  @@unique([taskId, reason])
  @@index([owedById, settledAt])
  @@map("task_round")
}

/// A private calendar subscription URL for one person.
model TaskCalendarFeed {
  userId String @id
  token  String @unique
  @@map("task_calendar_feed")
}

/// A reusable list of tasks with offsets from gig start. `items` is JSON:
/// nothing queries inside it.
model TaskPlaybook {
  id    String @id @default(cuid())
  name  String
  items Json
  @@map("task_playbook")
}
```

Also: `ActivityType` gains `TASK_CREATED`, `TASK_UPDATED`, `TASK_DELETED`,
`TASK_STATUS_CHANGED`, `TASK_DELAY_REPORTED`, `TASK_TAKEN`.

Reminder: `.env` points at prod Neon. The migration is applied by hand.

## How a task moves: dependencies and push-back

All of this lives in one pure module, `src/lib/tasks/schedule.ts`, with tests,
the way `src/lib/run-sheet/schedule.ts` does it for run sheets.

**The rule, in one line.** A task is due at the later of its own due date and
each dependency's finish plus that dependency's gap:

```
due(task) = max(task.dueAt, for each dep: finish(dep) + gap)
finish(dep) = dep.completedAt   if done
            = due(dep)          if it is not late yet
            = now               if it is late (it is still sliding)
```

Walk the graph in topological order and this is one pass. Cycles are refused
when a dependency is added.

**Projected vs committed.** A late task slides continuously, and writing every
tick would spam the log and the people downstream. So:

- While a dependency is late, downstream dates are **projected** at read time.
  The UI shows "projected Fri 3pm, was Thu 5pm" in a muted style.
- When the late task is done, or a delay is reported, the shift is
  **committed** by that mutation: `dueAt` is written, a `SHIFTED` event is
  logged with `causeTaskId`, and each affected assignee gets one push.
- When a dependency first goes late (noticed by the sweep), everyone
  downstream gets one heads-up: "Poster design is late. Your task 'Print
  posters' will move with it."

**Hard deadlines.** If a projected date crosses `hardDeadlineAt`, the task
does not move past it. It's flagged at risk instead: "Print posters can't
finish before the gig at the current rate. 2 days short." This is the most
important alert in the system. Gig dates don't move, so a slipping chain
eventually hits one, and the earlier someone sees that the better.

**Impact preview.** `impact(taskId, newDueAt)` is the same function run as a
dry run. It returns which tasks would move, by how much, who owns them, and any
hard deadline conflicts. The delay sheet, the admin due date editor and Will GPT
all call it before committing.

## "I can't make it"

On any open task, the assignee taps **Need more time** (web, app, or a push
action button):

1. Pick a new date. Write a reason ("venue hasn't confirmed capacity yet").
2. The sheet shows the impact preview before sending: "This moves 3 tasks:
   Ana's 'Print posters' +2d, Josh's 'Socials push' +2d. No gig deadlines hit."
3. Send. `dueAt` moves, `DELAY_REPORTED` is logged with the reason, downstream
   shifts are committed, and everyone affected gets a push naming who, why and
   their new date. So does whoever created the task.

Two other ways out from the same sheet: **Blocked** (stuck on something
outside the team; pick a check-back date) and **Pass it on** (Hot potato,
below).

A delay reported **before** the due time counts very differently from a miss.
The standings reward saying so early. The point is to make honesty the easy
path: the only ways to make the nagging stop are doing it, explaining it, or
handing it to someone who will.

## Nagging: the reminder ladder

`sweepTasks()` runs on the 5 minute ticker. For each task that is `TODO`,
`IN_PROGRESS`, `BLOCKED` (past its check-back) or `IN_REVIEW` (nagging the
reviewer), and not waiting, it works out the latest ladder step that is due,
reserves a `TaskNudge` row, then sends. Pure ladder logic goes in
`src/lib/tasks/nudges.ts`, tested.

| Step         | When                                | Who                         | Priority |
| ------------ | ----------------------------------- | --------------------------- | -------- |
| created      | next tick, batched per person       | assignee                    | normal   |
| t-24h        | a day before                        | assignee                    | normal   |
| due-today    | 9am on the due day                  | assignee                    | normal   |
| t-2h         | two hours before                    | assignee                    | normal   |
| due          | at the due time                     | assignee                    | high     |
| overdue-n    | every 4 waking hours after          | assignee                    | high     |
| escalated    | 24h overdue                         | assignee + creator + admins | high     |
| critical     | 72h overdue, or at risk             | every admin                 | high     |
| check-back   | a blocked task's check-back date    | assignee                    | normal   |
| review       | 24h after submission                | reviewer                    | normal   |

Rules:

- **Quiet hours** 10pm to 8am NZ. Steps that land inside are held to 8am,
  except on the gig's own day, when nobody is asleep anyway.
- **Critical tasks** run the ladder at double speed and escalate at 6h.
- **Creation is batched.** A Will GPT run that creates 20 tasks sends each
  person one push: "4 new tasks from Will, first due Thu". This is also what
  makes creating tasks safe to classify as a plain write for Will GPT.
- **Due today matters twice.** It's the push most likely to be tapped in the
  morning, and tapping it opens the app, which is what lets the lock screen
  countdown start (iOS won't start one from the background).
- **No snooze on overdue.** Done, Need more time, Blocked or Pass it on.
- **Push action buttons.** Every task push carries an iOS category with
  **Done** and **Need more time**. Done completes from the lock screen; Need
  more time opens the delay sheet. (`expo-notifications`
  `setNotificationCategoryAsync`. Check that a background action can make an
  authenticated call; if not, Done opens the app and completes immediately.)

Reminders go through `sendPush` directly, like gig chat, so they don't bury the
notification history. Escalations go through `publish()` with an audience
override, so they show up in `/admin/notifications` alongside run sheet cues.

## Hot potato

Two ways a task changes hands without an admin stepping in.

**Pass it on.** The assignee offers a task up, with an optional reason. The
other admins get one push: "Josh is passing 'Print posters' (due Thu). Take it?" with
a **Take it** button. Until someone does, it's still Josh's and still nags
Josh. Offering is not dropping. A task passed on before it's due and taken
counts as a handover, not a miss.

**Take it.** Any overdue task shows **Take it** to every other admin,
on web and in the app, and in the escalation push. Taking reassigns it,
logs `TAKEN` with who it came from, and tells the previous assignee and the
creator. The taker gets a rescue in the standings, and the previous assignee
owes them a round (see the ledger).

Rules: one tap, no approval, because the point is speed. An admin can
reassign it back. You can't take a task that's in review or waiting on a
dependency, since there's nothing to rescue yet.

## The rounds ledger

Opt-in, team-wide, switched on in settings.

- A task that goes 24h overdue without a delay, a block or a pass-on adds one
  round owed by the assignee to the team (`SILENT_MISS`).
- A task taken off someone while overdue adds one round owed to the rescuer
  (`RESCUED`).
- At most one of each per task (`@@unique([taskId, reason])`).
- The standings show rounds owed and owed-to per person. **Settle** marks
  them paid, logged with who said so. Admins can **Waive** one that wasn't
  fair.
- The escalation push says so when the ledger is on: "That's a round. Poster
  design went a day over without a word."

Flagging early never costs a round. That's the incentive, in beer.

## Who sees what

**Admins only.** Tasks are for the people running Atmos, not for organisers,
door staff or artists. Everything goes through `adminProcedure`: reading,
creating, being assigned, and every screen on web and mobile. Superadmins are
admins, so they're included.

Among admins:

- **Everyone sees everything.** That is the accountability.
- **Any admin can create tasks**, assign them to any admin, accept proposals,
  and take overdue ones.
- **Assignees** move their own tasks through the status table, report delays,
  comment, and pass them on.
- **Creators** can edit, reassign, cancel and delete their own tasks. Doing
  that to somebody else's is allowed, and logged as acting on their behalf.

Assignee pickers list users holding `ADMIN`, with each one's device count (as
the run sheet picker does), since an admin with no app installed hears nothing.
Losing `ADMIN` doesn't delete anyone's tasks; they show as unassigned in the
alerts until somebody takes them.

Will GPT needs nothing extra: it is offered every mutation behind
`adminProcedure` already.

## Web: `/admin/tasks`

A new admin page, under **Events & sales** in `admin-navigation.ts`, first item.
Mocks first, per the usual rule: several static options, pick one, then build.

- **Alerts strip at the top.** Only present when something is wrong. One row
  per problem, worst first: at risk, escalated, overdue, blocked past due.
  Each row names the person, the task, how late, whether they flagged it, and
  has **Take it**. This is the "someone hasn't been keeping up" signal, and the
  Dashboard home shows the same thing as a count.
- **Calendar view.** Month and week. Tasks on their due day, gigs as fixed
  anchors across the top of their day so you can see the run-up to each night.
  Dependency lines drawn on hover. Filter by person and by gig.
- **Team view (load heat map).** See below.
- **List view.** Grouped by Overdue / Today / This week / Later / Waiting /
  Blocked / In review, or by person. Dense table, the existing `data-table`
  components.
- **Proposed.** The inbox of `PROPOSED` tasks from email, shares and Will GPT,
  each with its source quote. Accept (pick or confirm the person and date),
  edit, or dismiss.
- **Standings.** Per person, last 90 days: open, overdue, done on time, late
  but flagged, silent misses, rescues, rounds owed. Facts, no rank order.
- **Task drawer.** Title, owner, reviewer, status, due (planned and current),
  gig, dependencies both ways, source quote, timeline from `TaskEvent`,
  comment box, the actions the status table allows.
- **On the gig editor**, a Tasks tab listing that gig's tasks, with **Apply
  playbook**.

## Load heat map

A row per person, a column per day (week view) or week (month view), shaded
by how much they have due. Shows who is swamped before you hand them more.

- Load per cell: open tasks due in that span, critical ones counting double.
  Waiting tasks count at half, since they'll arrive but haven't yet. Pure
  function in `src/lib/tasks/load.ts`, tested.
- One hue, light to dark, with the count printed in the cell so it doesn't
  rely on colour. Click a cell to filter the list to those tasks.
- Gig nights marked as columns, since everyone's load before a gig is the
  thing to look at.
- The same number shows in every assignee picker, web and app: "Ana, 2 due
  this week". That's where it changes decisions.

## Mobile

A new `(tasks)` route group, reached from More, with an overdue badge on the
entry. Neither existing group fits: `(staff)` lets door staff in and `(admin)`
lets organisers in. `StaffGate` gains an `"admin"` role, backed by an `isAdmin`
in `useStaff`, and the server checks again on every call.

- `(tasks)/index.tsx`: **Mine** (overdue, today, this week, blocked,
  waiting on someone, proposed for me) and **Everyone** (the alerts strip with
  **Take it**, then the list). An agenda list grouped by day rather than a
  month grid, which doesn't fit a phone.
- `(tasks)/[taskId].tsx`: details, what it waits on and who waits on it,
  timeline, and the status actions: **Start**, **Done** or **Send for review**,
  **Need more time**, **Blocked**, **Pass it on**.
- `(tasks)/new.tsx`: quick add. Title, person (with load), due, gig,
  depends on. Plus **Paste chat** (see Inbox).
- Push taps route to `/tasks/<id>` via the existing `data.url` handling.

## Lock screen countdown

On a day you have something due, the lock screen shows it, the way it shows
the run sheet on a gig night.

**What it shows.** The next task due today and a countdown to it. A bar from
when it became actionable to when it's due. Underneath: "then: Socials push
at 5pm, +2 more". Past due, the countdown flips to counting up, "overdue
1h 12m". It ends when nothing is left today.

**How it starts.** iOS won't start a Live Activity from the background, so it
goes up when the app is opened on a day with something due in the next 12
hours. The 9am "due today" push is designed to be that tap.

**How it stays right.** Same as the run sheet: nothing ticks. The countdown
and bar are SwiftUI timers drawn from dates. Only names and dates change, and
only when a task does. Completing a task in the app updates it locally.
Anything changed elsewhere (completed on the web, shifted by a late
dependency, taken by someone else) sends one silent push from that mutation,
carrying the new state. iOS rations silent pushes per hour, which is fine for
something that changes a few times a day.

**The native side.** A second `ActivityAttributes` type, `TaskDayAttributes`,
with the same content shape as `RunSheetAttributes` (current name and span,
next name and start), so it reuses the run sheet's SwiftUI views and lives in
the same widget extension. The state comes from a pure
`src/lib/tasks/live-activity.ts`, used by both the server's silent push and
the app, like `src/lib/run-sheet/live-activity.ts`.

**One owner.** On a gig night the run sheet owns the lock screen. The task
countdown stands back while a run sheet activity is up, the same way the test
lock screen and the real run sheet already share it.

## Inbox: email and group chats to tasks

The original "chat to task" idea only worked in the in-app gig room, which
isn't where commitments get made. They get made in Instagram group chats and
in email. Here's what's actually possible.

### Instagram group chats: not directly

Meta's Instagram Messaging API does not support group chats. It only covers
one-to-one conversations between a person and a professional account. Reading
a group chat would mean an unofficial private-API library, which breaks
Instagram's terms and puts the account at risk. Not worth it.

What does work:

1. **Share to Atmos (recommended).** An iOS share extension in the app.
   Screenshot the group chat, or select messages and copy, then share to
   Atmos. A vision model reads it and proposes tasks: who said they'd do what,
   by when, for which gig. Works for Instagram, WhatsApp, iMessage, anything.
   Built the way the widget is: a config plugin that writes the extension
   target at prebuild.
2. **Paste chat.** The no-native-code version of the same thing: a text box in
   quick add (web and app) that takes pasted messages. Ship this first; the
   share extension is the nicer front door to it.
3. **DM the Atmos account (optional, later).** Forward a message or screenshot
   to @atmos in a one-to-one DM. The Instagram Messaging API sends a webhook
   and the same extractor runs. Needs a Meta app, the
   `instagram_manage_messages` permission, and "connected tools" switched on
   in the account's message settings. Standard Access only covers people with
   a role on the app, which is fine here because the senders are admins.
   More setup than it's worth unless the share extension doesn't catch on.

### Email: yes, and it's the strongest source

Resend already sends the site's email, and Resend Receiving accepts inbound
mail and posts an `email.received` webhook. The body is fetched separately
with the email id.

1. **A forwarding address.** `tasks@in.atmosmedia.co.nz` (an MX record on a
   subdomain, so normal mail is untouched). Forward any email to it, and
   proposed tasks show up on `/admin/tasks` and in the app, with a push to the
   forwarder: "3 tasks proposed from 'Re: Rider for Sat'".
2. **CC it.** Write to a venue "we'll send the rider by Friday" with tasks@ on
   CC, and that becomes a proposed task for you, due Friday, on that gig.
3. **Watch an inbox without connecting it.** For a shared inbox like
   bookings@, set an auto-forward filter in Gmail or Outlook (from venues,
   artists' agents, subjects with "advance") to tasks@. No OAuth, no tokens
   to keep alive, works with any provider, and the filter decides what
   gets read.

Guards:

- Only accept mail from admins' addresses (`User.email` on an `ADMIN`),
  or that arrived through a known forwarding rule. Verify the webhook
  signature.
- Store the subject, the quoted line and the Resend email id, not the whole
  body.
- Mail is read by a model through OpenRouter. Worth saying out loud before
  pointing bookings@ at it.

### One extractor, many inputs

Email, shares, paste and Will GPT brain dumps all go through
`src/server/tasks/extract.ts`: text and images in, proposed tasks out, as a
strict JSON schema (title, assignee guess, due guess, gig guess, quote). It
matches names to admins, venues and dates to gigs, and relative dates
("Friday") against when the message was sent. Everything comes out
`PROPOSED`. A person accepts it before anyone is on the hook, so a bad guess
costs a tap, not a wrong nag.

## Calendar feeds (cheap, big win)

`/api/tasks/calendar/<token>.ics`: a subscribable calendar per person, with
their tasks and the gigs they are on, from `TaskCalendarFeed`. Add it once to
Apple or Google Calendar and tasks show up next to everything else in their
life, with alarms. It's a text file, and it covers most of what a native
calendar integration would.

## Playbooks (templates)

Most gigs need the same 20 things in the same order. A playbook is a list of
tasks with offsets from gig start ("T-42d: confirm venue", "T-28d: poster
design, reviewed by Will", "T-21d: print posters, depends on poster design"),
a role per task ("promo", "production", "door"), and dependencies.

Applying one to a gig asks who fills each role, showing each person's load,
then creates the tasks with real dates, dependencies and hard deadlines at gig
start. Will GPT can draft one from a past gig (see below).

## Will GPT

**For free, from the bridge:** `tasks.list`, `tasks.get`, `tasks.impact`,
`tasks.standings`, `tasks.load`, `tasks.create`, `tasks.update`,
`tasks.assign`, `tasks.addDependency`. Will GPT can answer "what's overdue for
Saturday's gig", "who has room next week", "move everything of Josh's on
Friday to Ana", or "add the usual promo tasks to the new Wellington date".

**Policy overrides** in `src/server/will-gpt/policy.ts`:

| Procedure             | By verb     | Override | Why                                                   |
| --------------------- | ----------- | -------- | ----------------------------------------------------- |
| `tasks.create`        | write       | (keep)   | creation pushes are batched, so 20 creates are 1 push |
| `tasks.setStatus`     | destructive | (keep)   | changing someone else's status should be approved     |
| `tasks.accept`        | destructive | write    | turns a proposal into a task; batched notice          |
| `tasks.dismiss`       | destructive | write    | proposals only                                        |
| `tasks.reportDelay`   | destructive | (keep)   | pushes everyone downstream                            |
| `tasks.take`          | destructive | (keep)   | reassigns and may add a round                         |
| `tasks.nudge`         | destructive | (keep)   | sends a push now                                      |
| `tasks.applyPlaybook` | destructive | write    | only creates tasks, batched notices                   |
| `tasks.delete`        | destructive | (keep)   |                                                       |

**System prompt lines** in `agent.ts`: call `tasks.impact` before moving a due
date and tell the admin what will shift; check `tasks.load` before suggesting
who to assign; never change someone else's task status unless asked; link
tasks as `/admin/tasks?task=<id>`.

### AI features beyond the chat

Each is a small server function calling `openRouter()` with a cheap model and a
strict JSON schema. None are needed for the system to work.

1. **The extractor** (above): email, shares, paste, brain dumps.
2. **Plan this gig.** From a gig's details and the team's past gigs, Will GPT
   drafts a full task list with dependencies and owners, using a playbook as a
   base. Lands as `PROPOSED` tasks to accept in one go.
3. **Delay triage.** When someone reports a delay, AI reads the impact preview
   and the team's load and suggests a fix: "Ana has nothing due until the 20th
   and did posters last time. Hand it to her and nothing moves."
4. **Monday brief.** One push per person on Monday at 9am: what's due this
   week, what they're waiting on, what others are waiting on them for. Plus a
   team brief at the top of `/admin/tasks`.
5. **Effort guesses.** When a dependency is linked, suggest the gap from how
   long that kind of task took in past gigs.
6. **Pre-mortem.** On a gig's tasks tab: "In the last 5 gigs, socials and
   artist travel slipped the most. Both are on Josh this time, and he has 3
   other things that week."

## Wacky ideas (not yet in the build order)

1. **Self-completing tasks.** Bind a task to something the site already knows
   about. "Upload poster" completes itself when the gig gets a poster. "Put
   tickets on sale" completes when the ticket event is published. "Sell 100
   tickets" completes at the 100th sale. Starts with a handful of hard-coded
   conditions checked in the sweep.
2. **Proof of done.** Some tasks need a photo ("posters up on K Rd"). Upload
   on completion; AI checks it plausibly matches the task and flags it if not.
   The photo lands on the timeline for everyone to see.
3. **Escalating nag voice.** Reminders start polite and get more Atmos as they
   go. Overdue-1: "Heads up, poster's due." Overdue-4: "The poster is now
   older than some of our openers." With a tone ceiling and an off switch.
4. **Bus factor warning.** If one person owns more than half of a gig's
   critical path, the gig's tasks tab says so before it becomes a problem.
5. **Gig night dead man's switch.** At T-48h, if any critical task for the gig
   is not done, every admin gets one loud push with the list and Will GPT's
   suggested contingency for each.

## Build order

Each phase ships on its own and is useful without the next.

**Phase 1: tasks exist.** Schema and migration. Admin gate on web and the
new `(tasks)` group in the app. Status table in
`status.ts`. `tasks` router (list, get, create, update, assign, setStatus,
comment, delete). `/admin/tasks` list view and drawer. Mobile list, detail,
quick add. Creation pushes, batched. Activity logging. Will GPT policy
overrides and prompt lines. Mocks for both screens before building.

**Phase 2: dependencies and delays.** `TaskDependency`, `schedule.ts` with
tests (rule, projection, cycles, hard deadlines), `impact` query, delay and
blocked sheets with the preview, `SHIFTED` commits and downstream pushes.

**Phase 3: accountability.** `sweepTasks()` on the 5 minute ticker, the ladder
in `nudges.ts` with tests, `TaskNudge` reservations, push action buttons, the
alerts strip, standings, the dashboard count, hot potato, the rounds ledger.

**Phase 4: calendar and load.** Month and week views, the load heat map and
load in pickers, `.ics` feeds, gig tasks tab, playbooks.

**Phase 5: lock screen.** `TaskDayAttributes`, shared views, `live-activity.ts`
with tests, silent pushes from mutations, ownership with the run sheet.

**Phase 6: inbox and AI.** The extractor, Paste chat, the Proposed inbox,
inbound email via Resend, then plan this gig, delay triage, Monday brief. The
share extension after that, and the Instagram DM route only if needed.

**Phase 7: wacky.** Self-completing tasks first.

## New files at a glance

| Where                                         | What                                                        |
| --------------------------------------------- | ----------------------------------------------------------- |
| `src/lib/tasks/status.ts`                     | The status transition table. Pure, tested.                  |
| `src/lib/tasks/schedule.ts`                   | Dependency rule, projection, impact. Pure, tested.          |
| `src/lib/tasks/nudges.ts`                     | The reminder ladder and quiet hours. Pure, tested.          |
| `src/lib/tasks/standings.ts`                  | Per-person numbers from `TaskEvent`. Pure, tested.          |
| `src/lib/tasks/load.ts`                       | The heat map numbers. Pure, tested.                         |
| `src/lib/tasks/live-activity.ts`              | What the lock screen shows. Pure, tested.                   |
| `src/server/tasks.ts`                         | `sweepTasks()`, commit shifts, send nudges, silent pushes.  |
| `src/server/tasks/extract.ts`                 | Text and images to proposed tasks.                          |
| `src/server/api/routers/tasks.ts`             | The router. Will GPT gets it for free.                      |
| `src/app/(admin)/admin/tasks/`                | The admin page.                                             |
| `src/components/admin/tasks/`                 | Calendar, heat map, list, drawer, alerts, standings, inbox. |
| `src/app/api/tasks/calendar/[token]/route.ts` | The `.ics` feed.                                            |
| `src/app/api/webhooks/inbound-email/route.ts` | Resend `email.received`.                                    |
| `mobile/app/(tasks)/`                         | Mine / Everyone, detail, quick add. Admin-gated.            |
| `mobile/modules/run-sheet-activity/`          | Gains `TaskDayAttributes`; shared views.                    |
| `mobile/plugins/with-share-extension.js`      | The share extension target, like the widget plugin.         |
| `docs/TASKS.md`                               | Replaces this plan once built.                              |

## Open questions

1. **Tone of the standings.** Visible to everyone is the point, but a public
   scoreboard can sour a small team. Suggest: facts only, no rank order, no
   "worst" label. The rounds ledger is opt-in for the same reason.
2. **Escalation reaches everyone.** With admins only, "assignee + creator +
   admins" at 24h overdue is the whole group. That's probably the point, but
   if it's too loud, escalations could go to the creator first and everyone
   at 48h.
3. **One owner or several?** The plan says one owner per task. Shared tasks
   can be split into one per person.
4. **Who can move someone else's due date?** Suggest: the creator and admins.
   Anyone else uses comments.
5. **Quiet hours.** 10pm to 8am NZ is a guess. Per person later if needed.
6. **Push actions from the lock screen.** Need to confirm an Expo background
   action can make an authenticated tRPC call on iOS before promising one-tap
   Done.
7. **Which inboxes get forwarded,** and is everyone comfortable with venue and
   agent email being read by a model?
8. **Silent miss rounds:** owed to the team, or to whoever created the task?
9. **Run sheet cues at 5 minutes.** See the ticker section.

---

Planned by Claude Opus 5.5 in Claude Code.
