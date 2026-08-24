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
| `mobile/app/(admin)/run-sheet/[gigId].tsx`| The read-only run sheet in the app.                                          |

## The data

`gig_schedule_item` is one row per thing that happens, and it replaced
`gig_creator` by being renamed into it — every line-up ever typed in survived
the migration as a `SET` with no times.

- `kind` is `LOAD_IN`, `SOUND_CHECK`, `DOORS`, `SET`, `CURFEW` or `CUSTOM`.
- `creatorProfileId` is set on a `SET` and null on everything else.
- `startsAt` is optional throughout. A gig with names and no times behaves
  exactly as it did before run sheets existed, and announces nothing.
- `leadMinutes` is how far ahead to warn. `[5]` means one warning five minutes
  out, plus the cue itself. `[]` means the cue only.
- `notes` is internal and is never selected by a public procedure.

There is no unique constraint on (gig, artist), so an artist can open and close
the same night. The public line-up de-duplicates them to one name, at the
position of their first set.

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
