# Run sheets

The order of a night, and the notifications that come out of it.

One timeline per gig holds doors, sound check, every set and anything else, and
a scheduler ticking every minute turns it into pushes to the people an admin
picked. The line-up is not a separate feature: a `SET` row on the run sheet *is*
a line-up entry, so a set time is typed once and the public bill is derived from
the same rows.

## The pieces

| Where                                     | What                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `src/lib/run-sheet/schedule.ts`           | Ordering, cue derivation and the wording of every notification. Pure.        |
| `src/lib/run-sheet/line-up.ts`            | The public line-up, built by hand from a narrow row. Pure.                   |
| `src/server/run-sheet.ts`                 | The sweep: which cues are due, reserving them, publishing them.              |
| `src/app/api/cron/run-sheet/route.ts`     | The endpoint an external scheduler calls every minute.                       |
| `src/server/api/routers/run-sheet.ts`     | Reads, for the app and for the editor. Organiser or admin only.              |
| `src/server/api/routers/gigs.ts`          | Writes, through `gigs.saveAll`. There is no separate run sheet mutation.     |
| `mobile/app/(staff)/run-sheet/[gigId].tsx`| The read-only run sheet in the app.                                          |
| `src/lib/run-sheet/live-activity.ts`      | What the lock screen shows, and when a phone needs waking. Pure.             |
| `mobile/src/lib/live-activity.ts`         | Puts the Live Activity up and keeps it right while the app is open.          |
| `mobile/modules/run-sheet-activity/`      | The native side: ActivityKit, and the silent push that moves it on.          |
| `mobile/widget/`                          | The SwiftUI the lock screen actually draws.                                  |
| `mobile/plugins/with-run-sheet-widget.js` | Writes the widget extension target into the generated Xcode project.         |

## The data

`gig_schedule_item` is one row per thing that happens, and it replaced
`gig_creator` by being renamed into it — every line-up ever typed in survived
the migration as a `SET` with no times.

- `kind` is `LOAD_IN`, `SOUND_CHECK`, `DOORS`, `SET`, `CURFEW` or `CUSTOM`.
- Who is playing a `SET` lives in `gig_set_artist`, one row per name, ordered by
  billing. Every other kind has none.
- `startsAt` is optional throughout. A gig with names and no times behaves
  exactly as it did before run sheets existed, and announces nothing.
- `leadMinutes` is how far ahead to warn. `[5]` means one warning five minutes
  out, plus the cue itself. `[]` means the cue only.
- `notes` is internal and is never selected by a public procedure.

A slot holds as many artists as it needs, so a back to back is **one set with
two or three people in it** rather than two sets stacked on the same minute.
That matters twice over: two rows would announce a changeover between the two
halves of a b2b, and would print the slot twice on the public bill. A slot bills
itself as "Nova b2b Kessler"; anything that wants to read differently is what the
row's `label` is for.

Nothing stops the same artist appearing in more than one slot, so an artist can
open and close the same night. The public line-up de-duplicates every name to
one entry, at the position of its first slot.

**Changeovers are not stored.** A set with an earlier set in front of it implies
one, and the cue copy reads the row in front rather than a row somebody has to
remember to move. Nothing to keep in sync means nothing to get out of sync.

## Who hears it

`gig_notify_recipient` is the gig's list. `gig_schedule_recipient` narrows it for
one cue, so the sound engineer can have sound check without having every
changeover. An empty per-cue list means "the gig's list"; an empty gig list means
nobody, and the sweep records the cue as handled rather than reconsidering it
every minute for a day.

Only users holding `ADMIN` or `EVENT_ORGANISER` can be picked. The picker shows
how many devices each of them has registered, because somebody on the list with
no app installed hears nothing and that is worth knowing before the night rather
than during it.

## Firing

Vercel cron on the Hobby tier is once a day, and a five-minute warning that can
be a day late is not a warning. So the sweep is driven from outside:

```
* * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
               https://atmosmedia.co.nz/api/cron/run-sheet
```

`?key=$CRON_SECRET` works too, for a scheduler that can only fetch a URL. Same
secret as the ticketing sweep.

Two rules make a bad night survivable:

- **The fire row is written before the push.** `gig_schedule_fire` is unique on
  (item, offset), so two overlapping pings race to insert and the loser sends
  nothing. The worst case is a dropped cue, not one that arrives twice at 11pm.
- **Overdue cues are written off, not delivered late.** Past `CATCH_UP_MINUTES`
  (10), the sweep records the cue as handled and moves on. A scheduler that dies
  at 9pm must not deliver the whole night at once when it comes back at 2am.

Cues publish through the same `publish()` as everything else, under the topic
`run-sheet`, with the audience overridden to the picked users. That topic is
deliberately absent from `KNOWN_TOPICS`: nobody subscribes to it and nobody
should compose to it by hand. It exists so run sheet cues appear in the same
notification history as everything else the site sends.

## Running late

The editor's "running late" control shifts every row that has not fired yet.
Rows already announced keep their times: a notification that has landed on
somebody's phone is history, and rewriting the run sheet to disagree with what
people were told helps nobody.

## What the public sees

The names on the bill, in running order, exactly as before. `gigs.getById` is a
public procedure whose select has no room for a set time, a note or a non-set
cue; `gigs.getForEditor` is a different procedure behind an admin guard, and is
the only way to read a run sheet over tRPC. `src/lib/run-sheet/line-up.test.ts`
asserts the key set of a public line-up entry and fails if it ever grows.

## On the lock screen

From an hour before the first item, an iPhone that is on the gig shows a Live
Activity: what is on now, how long until the next thing and what that thing is.
Before the night starts it is a countdown to the first item instead.

Two bars under the name. The bright one is the current item; the faint one is
the whole night, first row to last, so a load-in at two in the afternoon is part
of the night rather than the night starting at doors. The night's bar only
appears once the night has started — one that cannot have moved yet says
nothing. Neither is labelled: the weight is the label.

`src/lib/run-sheet/live-activity.ts` decides all of it, and both ends read from
it — so the lock screen and the run sheet screen cannot disagree about what is
on. `activityRows` reduces the schedule to a name and a span; `runSheetActivity`
says what to show; `activityMoments` says when that answer changes.

**Nothing ticks.** The countdown is a SwiftUI `Text(timerInterval:)` and the bar
is a `ProgressView(timerInterval:)`, both drawn from a pair of dates by the
system on a locked, suspended handset. Neither the app nor the server advances
them. The only thing that ever has to be delivered is the *names*, and names
change only when an item does.

So the sweep sends nothing on an ordinary minute. On the minute an item changes
— `momentsDue` — `pokeLiveActivities` sends one silent push carrying the whole
new state, and `RunSheetActivitySubscriber` applies it in Swift. Nothing is
fetched on that wake-up: the push is the answer, worked out by the same function
the app would have used. That matters because a background wake-up is a couple
of seconds, which is not enough to start JavaScript, restore a session and make
a request.

A missed poke is not reserved or written off the way a cue is. It leaves a lock
screen briefly naming the wrong item, which rights itself at the next item or
the next time the app is opened, and that is not worth a table.

### What it cannot do

**iOS will not let an app start a Live Activity from the background.** One goes
up when somebody opens the app during the window, not on its own at T-60. On a
night that is what tapping the lead cue notification does. Pushes can move an
activity on and take it down; only the app in front can put one up. Doing it
without that needs ActivityKit push-to-start tokens and a direct APNs client,
which is a second push transport alongside Expo's and was not worth it for the
case where nobody has opened the app all evening.

iOS also allows an app only a handful of silent pushes an hour and drops the
rest, which is the other reason the sweep pokes at item boundaries rather than
on a timer.

### The widget target

A Live Activity is drawn by a widget extension: a second binary, with its own
target, bundle identifier and Info.plist, embedded in the app's PlugIns folder.
`expo prebuild` cannot produce one, and `ios/` is regenerated and gitignored, so
a target added in Xcode by hand survives until the next build.
`mobile/plugins/with-run-sheet-widget.js` writes it into the generated project
instead, from the sources in `mobile/widget/`.

`RunSheetActivityAttributes.swift` is compiled into both binaries — ActivityKit
pairs an activity with the widget that draws it by the name of that type. It is
copied out of the module by the plugin at prebuild rather than kept in two
places.

Signing stays automatic: `scripts/build-ipa.sh` archives with
`-allowProvisioningUpdates`, so Xcode issues a profile for the extension's
identifier the first time it is asked.
