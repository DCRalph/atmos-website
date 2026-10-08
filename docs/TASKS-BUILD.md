# Tasks implementation checkpoint

Branch: `feat/tasks-system`, created from local `main`.

The full scope remains [TASKS-PLAN.md](TASKS-PLAN.md). Implementation is waiting
for the required mock selection. No application code or database schema has
changed yet.

## Design checkpoint

[Static web and mobile mocks](mocks/tasks-options.html) contain three options:

Published comparison: <https://tyhug6bwvnw7.postplan.dev>.

- **A: List first.** Full alerts followed by the grouped task table. Mobile
  starts on Mine.
- **B: Calendar first.** Gig anchors and task projections on a week calendar.
  Mobile uses a daily agenda.
- **C: Team first.** Weighted workload by person and day, with the selected
  cell's tasks below. Mobile uses a person list.

All options include every planned view. The decision concerns the default
workspace and hierarchy, rather than which features to implement. Shared mocks
show the drawer, delay impact preview, mobile quick add and detail, Proposed,
Standings, the gig's Tasks tab, playbooks, common states, and the countdown.

The mock data is fictional. The comparison is a standalone document with
embedded fonts, no JavaScript, no forms, and no external asset requests. Web
inherits Montserrat, the existing admin shell, dense tables and neutral
controls. Mobile inherits the app's embedded fonts, black surfaces and
`#C6FF33` controls.

## Implementation sequence after selection

1. **Tasks exist:** Prisma schema and an unapplied migration; shared status
   transitions; admin-only router and activity logging; web list and drawer;
   mobile admin gate, agenda, detail and quick add; batched creation notices;
   Will GPT policy and prompt changes.
2. **Dependencies and delays:** topological scheduling, cycle rejection,
   projected dates, hard deadline conflicts, impact query, reported delays,
   blocking, committed shifts and downstream notices.
3. **Accountability:** latest-due-step reminder ladder, Auckland quiet hours,
   reservation rows, sweep integration, push categories, alerts, dashboard
   count, standings, offers, taking tasks and opt-in rounds.
4. **Calendar and load:** week/month calendar, weighted workload, owner picker
   load and device count, token-protected calendar feeds, gig Tasks tab,
   validated playbooks and application with role assignments.
5. **Lock screen:** pure task-day state, native attributes and shared views,
   local mutation updates, silent push updates, and run-sheet ownership.
6. **Inbox and AI:** validated proposal extraction from text and images;
   paste flow and Proposed inbox; signed, deduplicated inbound email;
   gig planning, delay triage, Monday brief, effort suggestions and pre-mortem;
   authenticated iOS share extension and app handoff.
7. **Wacky ideas:** start with explicit self-completion bindings for poster
   upload, ticket event publication and sales milestones, respecting reviewer
   sign-off. Then add proof attachments and plausibility checks, optional
   reminder tone escalation, critical-path concentration warnings and the
   T-48h critical-task alert with contingency suggestions.

The Instagram DM route is conditional in the plan and does not require
connecting a Meta account for the rest to work.

## Existing integration points checked

- Web already has an admin-only layout. Tasks still require `adminProcedure`
  on every call.
- Mobile `StaffGate` currently supports `staff` and `organiser`; tasks require
  a separate `admin` role and `isAdmin` in `useStaff`. Organiser access is not
  sufficient.
- `/api/cron/run-sheet` already dispatches run-sheet and gig-announcement
  sweeps. Its source documents a one-minute cadence; the task plan assumes
  five minutes. Actual scheduler configuration is external. Task logic must
  tolerate either without altering run-sheet timing.
- Will GPT discovers admin procedures and classifies mutations by verb.
  Add typed overrides for accept, dismiss and applying playbooks, and the
  impact/load guidance in its prompt.
- `mobile/modules/run-sheet-activity` already has the Expo module and native
  controller used by silent pushes. Task state should share that path and
  yield while a run-sheet activity is active.
- Settings have an existing `KeyValueStore`; use it for the opt-in rounds
  setting rather than introducing a second settings system.

## Defaults from the plan

One owner per task. Facts-only standings in alphabetical order. Rounds off
until explicitly enabled, with silent-miss rounds owed to the team. Quiet
hours are 10pm–8am Auckland, subject to the documented gig-day exception.
Escalation follows the stated ladder. Proposed tasks need acceptance and
expire after seven days. Reviewer submission stops the assignee's clock;
dependencies resolve only at DONE.

## Validation and external setup

- Focus tests on status rules, scheduling/cycles/deadlines, reminder steps and
  quiet hours, standings, load, native state, and permissions or concurrency
  boundaries. Reuse the project's Bun test setup.
- Run the web checks and mobile typecheck after implementation. Verify the
  chosen screens against existing styles at desktop and phone widths.
- Do not run migrations against the repository's `.env`: the plan identifies
  that database as production. Generate SQL for manual application.
- Inbound email needs the Resend receiving domain, MX record, webhook secret
  and an approved forwarding configuration before it can receive live mail.
- Native countdown and share extension require a rebuilt iOS app and device
  validation. Keep push action completion on the foreground path until an
  authenticated background action is proven on a device.
- Implement notification paths without sending live task notifications during
  development or verification.
