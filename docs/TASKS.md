# Tasks

Implemented on `feat/tasks-system` from [TASKS-PLAN.md](TASKS-PLAN.md), using the
approved calendar-first design. `/admin/tasks` opens on the week calendar, with
month, grouped list, team load, proposals, and standings alongside it. The gig
editor has a Tasks tab. The app opens on a daily Mine agenda, with Everyone,
quick add, paste/share intake, details, and standings.

All seven phases are included. The optional Instagram DM integration is deferred
as specified in the plan. Production has not been migrated or deployed, and no
live task notifications were sent during implementation.

## Rules and storage

Every task procedure requires ADMIN or SUPERADMIN. Door staff and organisers
cannot read or own tasks. Removing an owner's admin permission leaves the task
intact and raises an unassigned alert. Pickers show current admins, their weekly
load, and registered device count.

Seven stored statuses live in `src/lib/tasks/status.ts`; both clients use that
transition table. Admin actions for another person are recorded in the timeline.
Blocked work needs a reason and a future check-back time; **Update block** changes
both without restarting it. A reviewer must approve submitted work. Submission
stops the owner's clock, while dependencies resolve only at DONE. Required proof
must still be an existing, completed image upload scoped to that task.

`plannedDueAt` records the agreed commitment. `dueAt` changes only through a
mutation. A pure topological projection moves downstream dates while an upstream
task remains late. Completing it or reporting a delay commits shifts and sends
affected people the new date and reason. Hard deadlines cap displayed dates;
uncapped required finish times carry risk through the whole chain. Dependency
cycles are rejected. Date and delay forms show impact before saving.

Graph-changing mutations use a transaction and one Postgres advisory lock.
Creating a task with its initial dependency and accepting a selection of
proposals are atomic. Timeline events retain ownership, submission, delay,
review, shift, and acting-on-behalf history. Standings credit the owner who
submitted, including an admin submitting for them, rather than a later reviewer.

## Reminders and accountability

`sweepTasks()` shares `/api/cron/run-sheet` with the existing run-sheet and gig
announcement sweeps. Call that endpoint at least every five minutes. Keep the
existing one-minute cadence where run-sheet cue accuracy matters; the task
sweep tolerates either. The scheduler itself is external to this repository.

The endpoint requires `CRON_SECRET`; missing configuration refuses requests.
Use `Authorization: Bearer <secret>` or the existing `?key=` mechanism. The route
allows up to 300 seconds. Brief and contingency model calls have a 15-second
budget and fall back to factual copy.

Task reminders reserve a unique task/step/due-date row before sending. After
downtime, only the latest elapsed step is sent and older steps are marked
skipped. An unsent escalation still reaches all admins once. At-risk notices do
not suppress later reminders. This guarantees at-most-once attempts; a delivery
failure does not blindly resend a reserved banner. Delivery counters describe
registered devices and push delivery, not whether someone read it.

Quiet hours are 10pm–8am Pacific/Auckland, including daylight-saving changes.
The task's gig day is exempt. Critical work runs the ladder faster and escalates
after six hours. Dependency-waiting work is not nagged, but hard-deadline risk
still reaches the admins. Blocked tasks get check-back reminders; submitted
work goes to its reviewer. Creation notices are batched per owner on the next
sweep. Overdue dependencies send affected owners one heads-up.

Offers keep the current owner responsible until another admin takes the task.
Taking is unavailable while waiting or in review. The rounds ledger and Atmos
reminder voice default off and can be enabled separately in Task settings.
Silent misses and rescues create at most one round per task/reason. Early flags
avoid a rescue round; settlement and waivers retain an audit trail. Standings
show 90-day facts alphabetically, with no rank order.

## Calendar feeds and playbooks

Task settings creates a private calendar subscription URL at
`/api/tasks/calendar/<token>.ics`. The 32-byte random token is the credential;
anyone with the link can read that person's open tasks and assigned gigs.
Replacing the link revokes the old URL. Removing admin access also invalidates
it. Entries use projected dates, stable IDs, UTC timestamps, and two-hour alarms.

The playbook editor uses task fields, roles, days before the gig, and dependency
checkboxes. Applying one asks for the people filling each owner/reviewer role,
then creates the dates, dependencies, and gig hard deadlines together. Existing
tasks remain when a playbook is edited or removed.

## Inbox and AI

`OPENROUTER_API_KEY` enables optional task AI. `TASKS_AI_MODEL` defaults to
`openai/gpt-4.1-mini`; choose a model supporting images and structured JSON.
Outputs are validated with Zod. AI drafts always enter PROPOSED, need a person
to confirm owners and dates, and expire after seven days. A source reference and
leased receipt prevent duplicate email extraction. Only the subject, source ID,
and supporting quote are retained for email; the entire body is not stored.

Paste chat accepts text or screenshots on web and mobile. Gig planning uses
playbooks and past tasks. Delay triage reads the impact and team load. Effort
suggestions use median time from starting to submission, with the planned gap as
a fallback. Monday briefs and T-48h critical-task
contingencies send once and have factual fallbacks. Pre-mortems and proof checks
provide advice; they do not silently alter ownership, dates, or review decisions.

Will GPT discovers the admin router automatically. Its prompt requires impact
before moving dates and load before assigning. Creation, accepting, dismissing,
and applying playbooks are ordinary writes; actions that immediately notify or
change somebody else's work retain approval through its existing policy.

### Receiving email

Configure this separately before enabling live intake:

1. Add a Resend receiving domain and its MX records on the inbound subdomain.
   Keep normal mail on its existing domain.
2. Subscribe the signed `email.received` webhook to
   `/api/webhooks/inbound-email`. Set `RESEND_API_KEY` and
   `RESEND_INBOUND_SECRET` in the deployment's secret configuration.
3. Set `TASKS_INBOUND_ADDRESS` (default `tasks@in.atmosmedia.co.nz`). An admin can
   forward or CC a message from their own authenticated address.
4. For a forwarding service, optionally set `TASKS_FORWARDERS` to a JSON mapping
   an authenticated forwarding sender to a current admin email. The sender must
   match that trusted mapping; arbitrary original-sender headers are not proof.

The handler verifies the webhook signature, intended recipient, admin or mapped
sender, and Resend's retrieved `authentication.dmarc === "pass"` metadata. It
never trusts sender-supplied Authentication-Results headers. Missing or failed
mail authentication is ignored. A forwarding rule preserving an unauthenticated
external From address must be changed to a trusted authenticated sender.
Transient retrieval/extraction failures return 503 so Resend can retry.

Forwarded text and selected screenshots are processed through OpenRouter. The
paste/share UI states this; make that choice explicitly before auto-forwarding a
shared inbox. See [Resend receiving setup](https://resend.com/docs/dashboard/receiving/introduction)
and [retrieved email authentication metadata](https://resend.com/docs/api-reference/emails/retrieve-received-email).

## iOS countdown and sharing

The new `TaskDayAttributes` and controller share the existing Expo module and
widget extension with run sheets. Opening the app with actionable work due today
within 12 hours starts the task activity. SwiftUI draws the signed due offset
from its date without continuous app repainting. Reminder/foreground updates
mark it overdue. Mutations send silent state updates; iOS delivers those on a
best-effort basis. Foreground refresh reconciles missed updates and expiry.
The run-sheet activity takes priority and ends the task activity while active.
Signing out or changing users clears task ownership on the native side.

Task push categories offer Done and Need more time. Both open the app through
admin and biometric gates. Done then executes the current permitted completion
or review transition; server-side dependency/proof validation still applies.
Need more time opens the delay form. No unauthenticated background mutation is
used.

The share extension stores selected text and up to five JPEG screenshots in the
App Group, with no session credentials or network calls. Open Atmos → Tasks →
Add → Import shared chat / screenshots to review and extract them. Handoffs
expire after 24 hours and are cleared after import. The app performs all uploads
and API calls after authentication.

A native rebuild is required. The config plugins add/update both targets
idempotently on `expo prebuild`; existing binaries tolerate missing new module
methods. Register/sign `nz.co.atmosmedia.app.AtmosShare`, retain the existing
RunSheetWidget target, and enable `group.nz.co.atmosmedia.app` on the app and
extensions with matching provisioning profiles. Physical-device checks remain
for sharing, biometric push actions, foreground activity start, silent updates,
run-sheet takeover, and sign-out. Simulator Swift typechecking is not a signed
archive or device test.

## Automatic completion and other optional features

A task can bind to its gig's poster, published tickets, or a ticket sales target.
The sweep rechecks the live condition inside the status transaction. Dependencies
and required proof still gate submission, and a configured reviewer still signs
off. Proof attachments and optional plausibility checks live in the drawer and
app detail. Gig tasks show critical-path ownership concentration. The optional
nag voice has a mild tone ceiling; ledger escalation copy appears only when the
ledger is enabled.

## Migration and validation

The additive migration is
`src/prisma/migrations/20261009000000_event_tasks/migration.sql`. Apply it through
the normal deployment migration process before deploying the new server. The
repository `.env` points at production: it was not used for migration or writes.
The SQL was applied successfully to a disposable local Postgres database built
from the prior schema.

Validation completed:

- `bun test`: all 268 tests pass, including focused task rules, projection,
  cycles/deadlines, quiet hours, load, standings, playbooks, native state, and ICS.
- Web and mobile TypeScript checks pass.
- Production Next.js build passes using the local database and disabled live
  credentials. Task files pass targeted ESLint. The full `bun run check` remains
  blocked by existing repository lint errors, including generated Prisma code.
- The opt-in integration test passes against local Postgres, covering admin
  gates, graph rollback, reviewer clocks, proof deletion, concurrent takeover
  and acceptance, reminder reservations, rounds, automatic completion, source
  dedupe, real webhook-signature validation, DMARC metadata, and calendar
  revocation. Push, mail retrieval, and model responses are mocked.
- Desktop and 390px web checks covered calendar/list/load, dependency hover,
  creation, delay preview/save and timeline, proposals/acceptance, playbook
  editing, and the gig Tasks tab, with no page overflow.
- Swift sources typecheck against the iOS simulator SDK. Fresh share targets and
  incremental widget sources serialize without duplicate targets or sources.

To run the integration test, initialise a disposable local database named
`atmos_tasks_test` with this schema, then set `TASKS_TEST_DATABASE_URL` to its
loopback Postgres URL:

```sh
bun test --conditions=react-server src/server/tasks.integration.test.ts
```

The test requires that explicit variable, refuses non-loopback hosts and other
database names, and clears task data inside that disposable database. It never
falls back to `.env`. Run it separately from the ordinary unit suite because it
mocks server modules for the duration of its process.
