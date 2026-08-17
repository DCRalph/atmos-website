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

## What this is, and what it deliberately is not

**It does not read documents.** There is no OCR here, no template matching, no
barcode parsing. A home-grown reader was built and then removed: on real cards
under a real doorway light it was not accurate enough to put in front of a
queue, and a reader that is *nearly* right is worse than none — it files people
under misread names and matches bans against the wrong person, quietly.

Reading a licence is a specialist job. It belongs to an ID SDK. Until one is
chosen, **staff read the card and type what is on it**, which is slower and
exact. Everything downstream is identical either way, which is the whole point
of where the boundary sits.

## The seam an SDK plugs into

`src/lib/ticketing/id-reading.ts`. One flat shape:

```ts
{ documentType, documentNumber?, fullName, dateOfBirth, expiry? }
```

`checkIdentity` neither knows nor cares where those came from. Wiring up an SDK
means changing the two screens that collect them and nothing else — not the age
rules, not the ban list, not the retention clock, not the audit log.

When you do wire one up, add what it returns that we do not have yet — the
portrait it cropped, an authenticity verdict, a confidence score — and let
`checkIdentity` act on them. The portrait plumbing is already there and unused:
`src/server/ticketing/id-photos.ts` stores one privately and
`/api/door/patron-photo/[patronId]` serves it back to door staff only.

**Capture the document number if the SDK gives you one.** It is what a patron
record is keyed on, and it is exact — the same card finds the same person
however their name was spelled that night. Without it the key falls back to
name-plus-birthday, which misses somebody entered differently next time.

### The options, as researched

Reading a New Zealand licence is the hard case: the front is printed text with
no MRZ, and the barcode on the back carries only the licence number, the card
number and a check digit — no name, no birthday. So a real SDK with a real
document template is the only reliable route.

| Vendor | NZ licence | On-device | React Native | Fake detection | Price |
| --- | --- | --- | --- | --- | --- |
| **Regula** | Best documented — DL 2013/2014, Kiwi Access, passports | Fully offline | Official package | Hologram/liveness | Quote |
| **Microblink BlinkID** | Yes, template-level | Yes | Official package | Yes | Quote; 100 scans/mo free |
| **Scandit ID Capture** | 2,500+ docs, 95%+ claimed on visual zone | Yes | Official package | ID Validate tier | Quote |
| **Scanbot** | Weaker ID coverage | Yes | Yes | Limited | Flat annual, unlimited |
| **ID Analyzer** | 6 NZ licence versions | ✗ cloud | REST | Yes | USD $89/mo for 1,000 |

Two things worth weighing. Scanbot's flat annual fee suits a door better than
anyone's per-scan pricing, which punishes exactly the behaviour you want. And ID
Analyzer is the only published affordable price, but it is a cloud API — the
photograph leaves the device, which reverses the privacy position below and
would need the policy rewritten to match.

Worth tracking separately: New Zealand's **digital driver licence**. The
Regulatory Systems (Transport) Amendment Act 2026 recognises it, DIA and Mattr
are building the credential platform, and an mDL is cryptographically signed —
exact data, no reading, no forgery question. That eventually makes all of the
above unnecessary.

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

Only three documents are approved evidence of age on licensed premises in New
Zealand, under the Sale and Supply of Alcohol Regulations 2013: a **NZ driver
licence**, a **passport** of any country, and the **Kiwi Access Card**. An
Australian driver licence is a genuine document that is *not* on that list, so
it comes back `NOT_APPROVED_EVIDENCE` at an R18 event. That is the licensee's
exposure, not the holder's, so the door is told rather than left to remember.

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
`purgeExpiredPatrons()` from `/api/cron/ticketing-sweep`. Any portrait object
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
- **They are told.** The entry screen states what is collected and why (IPP3),
  and the privacy policy carries a section on it. Print a notice for the door as
  well — the screen is for the staffer, the sign is for the queue.
- **If you adopt a cloud SDK**, all of the above changes. The image would leave
  the device and be processed by a third party, which needs saying in the policy
  and to the person handing over the card.

## Trying it out

```bash
bun test src/lib/ticketing/id-documents.test.ts   # age, expiry, name matching
bun run check                                      # prisma + eslint + tsc
bun run db:migrate                                 # 20260817000000_door_id_checks
```

End to end on the web: `bun dev` → `/door/<eventId>` → **More → Check an ID** →
type a name and birthday → verdict. Ban from the verdict, then check the same
details again and confirm the red screen and the recorded reason.

Retention: set a `purgeAfter` in the past by hand and hit the cron route with the
`CRON_SECRET` header. The row should go and the `IdCheck` row should survive with
a null `patronId`.

The photo route is the one to check by hand: request
`/api/door/patron-photo/<id>` while signed out, and again as a user who is not
door staff. Both must be refused.
