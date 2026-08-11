# Pickers — searchable dropdowns

A **picker** is a search-as-you-type data source for a combobox. Every picker in
the app shares one input/output contract, which is what lets a single client
component drive all of them.

Use one anywhere a `<Select>` would list rows from a table. A plain select
renders every option into the DOM and gives you no way to find anything — fine
at ten rows, unusable at a thousand, and it ships the whole table to the browser
on every page load.

## Using one

```tsx
import { PickerSelect } from "~/components/ui/picker-select";
import { api } from "~/trpc/react";

<PickerSelect
  endpoint={api.pickers.gigs}
  value={gigId}
  onChange={setGigId}
  clearLabel="No gig"   // omit to make the field required
/>;
```

With picker-specific narrowing:

```tsx
<PickerSelect
  endpoint={api.pickers.doorStaff}
  filter={{ excludeEventId: event.id }}
  value={userId || null}
  onChange={(next) => setUserId(next ?? "")}
/>
```

That is the whole API. Search, debouncing, request limits, keyboard navigation
and resolving the selected label are all handled.

## Adding one

One entry in [`src/server/api/routers/pickers.ts`](../src/server/api/routers/pickers.ts).
Copy the nearest existing picker and change four things: the procedure (who may
search it), the fields to match on, the ordering, and `toOption`.

```ts
venues: eventOrganiserProcedure
  .input(pickerInput(noFilter))
  .query(({ ctx, input }) => {
    const where = searchAcross(input.query, ["name", "city"]);
    const select = { id: true, name: true, city: true };

    return buildPicker({
      input,
      find: (take) =>
        ctx.db.venue.findMany({ where, select, orderBy: { name: "asc" }, take }),
      count: () => ctx.db.venue.count({ where }),
      findByValues: (values) =>
        ctx.db.venue.findMany({ where: { id: { in: values } }, select }),
      toOption: (venue) => ({
        value: venue.id,
        label: venue.name,
        description: venue.city ?? undefined,
      }),
    });
  }),
```

No client changes are needed — `api.pickers.venues` is immediately usable as an
`endpoint`.

To add a filter, pass a zod schema instead of `noFilter` and read
`input.filter`. It is typed end to end, so `filter={{ … }}` on the component is
checked against it.

## What the contract guarantees

Defined in [`src/server/api/pickers/core.ts`](../src/server/api/pickers/core.ts).

- **Bounded.** Never more than `PICKER_MAX_LIMIT` (50) rows, default 20. A table
  with a million rows costs the same as one with ten.
- **Honest about truncation.** `total` is the true match count, so the UI shows
  "Showing 20 of 340. Keep typing to narrow it down." A list that silently cuts
  off reads as complete, which is worse than the scrolling it replaced.
- **Keeps the selection resolved.** The component sends the current value as
  `includeValues`; the server returns that row whether or not it matches the
  query, and pins it to the top. Without this the trigger would fall back to
  showing a raw cuid as soon as you typed something else.

## Rules

**Keep `select` narrow.** A picker feeds a dropdown — never pull relations or
blobs. The bug that prompted this system was the discount-code event dropdown
calling `ticketEvents.list`, which loads every event *with its tiers and sales
counts* to render a list of names.

**Pick the procedure by who should be able to enumerate the table.** A picker is
a search endpoint over a whole table; `pickers.users` is `adminProcedure` for
exactly that reason.

**Scope by caller when a picker must serve two audiences.** `doorStaff` is the
worked example: admins search every account, while organisers see only a working
pool — people who have worked a door before, staff-ish accounts, and themselves.
To reach anyone outside it they must type a *complete* email address, matched
exactly.

That split matters because browsing and lookup are different privileges. An
organiser genuinely needs to add a new person by email, but should not be able
to type "a" and page through your user table. Note that pinned `includeValues`
deliberately bypass the scope, so an already-assigned person always keeps their
name rather than rendering as a raw cuid.

**Don't use a picker for fixed enums.** Event status, payment method, ticket
tier role — these can't grow, and a search box over three options is worse than
no search box. Keep those as a plain `<Select>`.

## Search performance

`searchAcross` builds a Postgres `contains` with `mode: "insensitive"`, which is
an unindexed sequential scan. That is fine for the tens of thousands of rows
these tables will realistically hold. Past that, swap an individual picker's
`find`/`count` for a trigram (`pg_trgm`) or `tsvector` index — the contract
doesn't change, so nothing else needs touching.
