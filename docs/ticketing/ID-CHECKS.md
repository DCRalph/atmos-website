# ID checks at the door

Everything else in the ticketing system decides whether a **ticket** is good.
This decides whether the **person** holding it is: old enough, known to us, and
not barred.

The gap it fills is not subtle. `scanTicket` already returns `isR18` and
`nameLocked` so the result screen can print "R18 — CHECK ID" and "this ticket is
in the name of Jane Smith", but the actual check was a staffer squinting at a
card in the dark and doing date arithmetic in their head. And there was no
memory: somebody refused on Friday was a stranger again on Saturday, because a
refusal is recorded against a *ticket*, and Saturday's ticket is a different row.

## The shape of it

```
iPhone → Apple Vision (native, offline) ─┐
                                          ├→ text lines → server → verdict
Web    → Tesseract WASM (in the page)   ─┘
```

**The device does the optical work; the server does everything else.** Both
clients send a bag of recognised text lines and nothing else. Two reasons, and
they shaped the whole design:

- The phone and the browser must never disagree about what `03/04/1999` means.
  One parser, one answer.
- A new card design needs fixing at 2am. That is a server deploy. A parser
  living in the app would be an App Store review.

**The photograph of the card never leaves the device.** What crosses the network
is the text and — only if a face was found — a crop of it. The address, the
licence classes and everything else printed on the card are gone before anything
is transmitted.

### Where the code is

| Piece | File |
| --- | --- |
| Parsing text → name, birthday, expiry | `src/lib/ticketing/id-documents.ts` |
| The decision, bans, retention | `src/server/ticketing/id-check.ts` |
| Portrait storage | `src/server/ticketing/id-photos.ts` |
| Serving a stored portrait | `src/app/api/door/patron-photo/[patronId]/route.ts` |
| Door API | `door.checkId`, `door.banPatron`, `door.liftBan`, `door.patron` |
| Office API | `src/server/api/routers/patrons.ts` → `/admin/patrons` |
| iOS recogniser | `mobile/modules/text-recognition/` + `mobile/src/lib/id-ocr.ts` |
| Web recogniser | `src/lib/door/id-ocr-web.ts` + `scripts/vendor-tesseract.mjs` |

## What it can and cannot do

It reads what is printed and does the arithmetic. **It does not detect a good
forgery** — no free on-device reader does — and the UI says so on every verdict,
including a pass, because a door that forgets it will wave through a decent fake
precisely *because* the screen went green.

The one place there is real verification is a passport: an MRZ carries its own
check digits, so a passport that parses is arithmetically verified. Everything
else is pattern-matching on text an OCR engine may have mangled, which is why
`confidence` never comes back `"high"` for a driver licence and why every
uncertain reading travels with the doubt attached for a human to confirm.

## The documents

Only three things are approved evidence of age on licensed premises in New
Zealand, under the Sale and Supply of Alcohol Regulations 2013: a **New Zealand
driver licence**, a **passport** of any country, and the **Kiwi Access Card**
(with the old Hospitality NZ 18+ card still valid). An Australian driver licence
is a perfectly genuine document that is *not* on that list.

`ID_DOCUMENTS` in `src/lib/ticketing/id-documents.ts` carries that as data, and
an unapproved document at an R18 event comes back `NOT_APPROVED_EVIDENCE` rather
than passing. That is the licensee's exposure, not the holder's, so the door is
told rather than being left to remember.

Machine-readability, which is why the reader is OCR and not a barcode scanner:

| Document | What is machine-readable |
| --- | --- |
| NZ driver licence | Nothing. Printed text only — hence the OCR. |
| Kiwi Access Card | Nothing. |
| Passport (any) | The MRZ, with check digits. The reliable path. |

### Parser order

Best-first, and the first template that yields a name and a birthday wins.

1. **MRZ** (TD1/TD2/TD3), check digits validated. Numeric fields are repaired
   before the checksum, not after — `9OO115` fails its own check digit and
   `900115` passes it, which is what turns the `O`→`0` repair from a hopeful
   substitution into a verified one.
2. **NZ driver licence** — the numbered fields (`1` surname, `2` first names,
   `3` date of birth, `4b` expiry, `5` card number `[A-Z]{2}\d{6}`).
3. **Kiwi Access Card**, then a **generic fallback**: the oldest date that
   yields a plausible age is the birthday, the longest all-caps lines are the
   name. Always `confidence: "low"`.

Dates are read `DD/MM/YYYY`. When both numbers are 12 or under the reading is
genuinely ambiguous and that doubt is returned rather than resolved — `03/04/1999`
is either the 3rd of April or the 4th of March, and on the wrong side of a
birthday that is the difference between admitting somebody and not.

## The decision

`checkIdentity` in `src/server/ticketing/id-check.ts`, modelled on `scanTicket`
next door: one call, one recorded row, an outcome written for somebody reading a
phone at arm's length.

Verdict precedence — the worst thing found wins, but **every** finding comes back
in `warnings`, because an expired card on an underage punter is two facts and
hiding the second behind the first is how the second gets missed:

```
BANNED  >  UNDERAGE  >  NOT_APPROVED_EVIDENCE  >  DOCUMENT_EXPIRED
        >  ALREADY_USED_TONIGHT  >  NAME_MISMATCH  >  PASS
```

Age is computed in the **event's** timezone. A door in Auckland at 1am on
somebody's birthday is a door where they are eighteen, and a UTC server thinks
otherwise.

Three checks worth calling out:

- **Ban matching.** The document is checked first. Failing that, a matching
  surname *and* date of birth is checked too, because the obvious way around a
  ban held against a licence is to come back with a passport. That second match
  is reported as `matchedOn: "NAME_AND_DOB"` rather than dressed up as the
  first — the door is looking at a face and can settle it, but only if it is
  told which kind of match it has.
- **Already used tonight.** The same document checked against a *different*
  ticket at this event. One ID going back out the door to a mate is the fraud a
  per-ticket scan log cannot see. A re-check of the same ticket is staff
  scanning twice and is not flagged.
- **Name match.** Deliberately generous — a missing middle name or a dropped
  hyphen is a match, because flagging those trains staff to tap past the warning
  and then it catches nothing at all.

## Bans

Atmos-wide, not per-event: a ban that only held for the night it was issued
would be indistinguishable from the refusal the scan log already records.

Door **managers** can ban, the same gate that guards a duplicate override.
Refusing entry stays open to every staffer — the person holding the scanner is
the one looking at the punter — but barring somebody from every future event is
a different act.

Append-only, like everything else at the door. Lifting a ban stamps `liftedAt`;
it never deletes the row, so "who barred me, and who let me back in" always has
an answer. Bans can be dated (30 / 90 / 365 days) or permanent, and nothing is
preselected in the UI — a default is a thing people accept without reading, which
is how every ban ends up permanent.

## Retention

**90 days from the last check** (`RETENTION_DAYS`), swept nightly by
`purgeExpiredPatrons()` from `/api/cron/ticketing-sweep`. The portrait object
goes first, then the row — a row deleted before its object leaves an orphan
nobody will ever find again.

`Patron.purgeAfter` is the switch: re-armed on every check, and `null` while a
ban stands, because a ban whose record expired is a ban that silently stopped
working. Lifting or expiring a ban re-arms it.

`IdCheck` rows **survive the purge** with `patronId` set null. What is left still
answers "how many IDs did this door check tonight, and how many came back
underage", which is the question a licensing inspector asks, without keeping the
people in it.

### Privacy

This is the most sensitive data in the schema: names, birthdays and faces
belonging to members of the public who have no account here and did not choose
to be in a database. The rules are enforced in the columns rather than left to
whoever writes the next query.

- **The portrait is a face, never the card.** Cropped on the device.
- **Portraits do not use the `file_upload` path.** That path ends at
  `/api/media/[id]`, which serves any completed file to anyone and caches it for
  a year. These are private objects behind a route that re-checks door access on
  every request and sends `Cache-Control: private, no-store`.
- **Document numbers are not the index.** `Patron.documentHash` is an HMAC
  (`PATRON_ID_SECRET`, falling back to `BETTER_AUTH_SECRET`), so the column
  everything is looked up by is not itself a list of licence numbers. Rotating
  that secret orphans every patron and every ban with them — set it once.
- **Somebody can ask.** `/admin/patrons` shows every field held, including the
  date it will be deleted, and can delete a record early. The Privacy Act gives
  them that right; a system with no way to honour it cannot be run lawfully.
- **They are told.** The capture screen states what is collected and why before
  the camera opens (IPP3), and the privacy policy carries a section on it. Print
  a notice for the door as well — the screen is for the staffer, the sign is for
  the queue.

## The iOS recogniser

`mobile/modules/text-recognition/` — a local Expo module wrapping Apple's Vision
framework. Local rather than a patch to `ios/` for the same reason the Tap to Pay
education module is: `ios/` is generated by `expo prebuild` and gitignored, so a
patch applied there is destroyed by the next build.

Two settings matter more than the rest:

- `recognitionLevel = .accurate`. `.fast` reads a licence number as a smear.
- `usesLanguageCorrection = false`. Autocorrect "fixes" surnames into dictionary
  words and turns `AB123456` into something that was never on the card.

`VNDetectFaceRectanglesRequest` supplies the portrait crop in the same pass.

> ⚠️ **A dev client built before this module existed cannot run it.** Rebuild:
> `eas build --profile development --platform ios`. The app treats an absent
> module as a first-class state and offers manual entry rather than crashing.

## The web recogniser

Tesseract compiled to WebAssembly, running in the page. `scripts/vendor-tesseract.mjs`
copies the worker and the SIMD-LSTM engine out of `node_modules` and downloads
the English model once, into `public/tesseract/` — gitignored, because eight
megabytes of binaries do not belong in the history when a reinstall reproduces
them exactly. It runs on `postinstall`.

Served from our own origin rather than the project's CDN, which is what
tesseract.js does by default: a door on a venue's guest wifi should not depend on
a third party being up, and a photograph of somebody's licence should not be
processed by code fetched from a host we do not control.

Be honest about the quality. Tesseract on a phone photo of an NZ licence is
materially worse than Vision on the same card. It is there because the
alternative on the web is nothing, and because the parser it feeds is built to
say "I am not sure". Manual entry is one tap away at every point, not a
punishment for failure.

The browser has no face detector worth shipping, so the staffer taps the photo on
the captured still and that becomes the centre of the crop. One tap, and
everything outside the box is discarded before anything is sent.

## Trying it out

**`/admin/patrons/test` is the bench.** Paste OCR lines, upload a photo of a
card, or use the camera; it runs the real engine and the real parser and shows
every step — the lines that came back, which template claimed them, what it
pulled out, what it was unsure about, and the verdict a door would reach. It
**writes nothing**: no patron record, no retention clock, no row in a door's
counts, because testing the reader on a colleague's licence must not put that
colleague in the database. It goes through `patrons.previewRead`, which is
read-only in the way `checkTicket` is on the door router.

Four sample inputs are built in, so the page is useful before anybody finds a
real card. The passport sample carries valid check digits — if it comes back as
anything other than `MRZ` / `high`, the parser has regressed rather than the
camera having failed.

```bash
bun test src/lib/ticketing/id-documents.test.ts   # the parser
bun run check                                      # prisma + eslint + tsc
bun run db:migrate                                 # 20260817000000_door_id_checks
```

End to end on the web: `bun dev` → `/door/<eventId>` → **More → Check an ID** →
photograph a licence → verdict. Ban from the verdict, then read the same document
again and confirm the red screen and the recorded reason.

On the phone: rebuild the dev client, then door → scan a ticket at an R18 event →
**Check their ID**.

Retention: set a `purgeAfter` in the past by hand and hit the cron route with the
`CRON_SECRET` header. The row and its S3 object should both go, and the `IdCheck`
row should survive with a null `patronId`.

The photo route is the one to check by hand: request
`/api/door/patron-photo/<id>` while signed out, and again as a user who is not
door staff. Both must be refused.
