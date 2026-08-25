# Creator UI test

A visual test for the creator profile editor and the public profile page. It
renders every block type against fixture data at a range of sizes, themes and
densities, then measures each block's reserved box against what actually paints
inside it — which is how stray padding and dead vertical space get caught.

## Running it

```bash
bun run ui:audit                              # all sections, desktop + mobile
bun run ui:audit -- --section=blocks-populated
bun run ui:audit -- --viewport=mobile
bun run ui:audit -- --outline                 # debug outlines in the screenshots
bun run ui:audit -- --base-url=http://localhost:3001
```

It reuses a `next dev` already listening on the base URL and starts one
otherwise. It drives whatever Chromium is on the machine (a Playwright cache, or
`CHROMIUM_PATH`), so there is no browser download.

Output goes to `.ui-audit/` (gitignored):

- `desktop/*.png`, `mobile/*.png` — full-page screenshot per section
- `report.md` — findings grouped by kind
- `report.json` — every block's measurements, for diffing between runs

## Browsing it by hand

With `next dev` running, open <http://localhost:3000/ui-test/creator>. Append
`?section=<id>` to isolate one, `&outline=1` to outline each block box in red
against its content in cyan. The route 404s in production.

Fixture images are fake `file_upload` ids, so they render broken when browsing
by hand; the audit substitutes generated placeholders. Third-party embeds
(SoundCloud, Spotify, YouTube) are stubbed during the audit so runs are offline
and deterministic.

## Layout

| File                                  | Role                                                             |
| ------------------------------------- | ---------------------------------------------------------------- |
| `src/app/ui-test/creator/page.tsx`    | Dev-only route                                                   |
| `src/app/ui-test/creator/harness.tsx` | The sections, and the list the audit reads                       |
| `src/app/ui-test/creator/fixtures.ts` | Frozen fixture data — no DB, no `Date.now()`                     |
| `scripts/ui-audit-creator.mjs`        | Browser driving, stubbing, screenshots, report                   |
| `scripts/lib/measure-blocks.mjs`      | The in-page measurement, on its own so it can be exercised alone |

Add a section by adding an entry to `SECTIONS` in `harness.tsx` and a case in
`renderSection`. The audit reads the list off the harness index at run time, so
nothing else needs updating.

## What it reports

- **hydration-mismatch** — the server markup didn't match the client, so React
  threw it away and re-rendered. Visible as a flash on the real site. The full
  React diff (naming the mismatched element) is kept in `report.json`.
- **empty-block** — a block reserves height and paints nothing (`SPACER` is
  exempt).
- **dead-space** — content leaves more than one grid row-step (80px: 60px row
  + the widest density gap) of its content box unused. Blocks can only span
  whole rows, so up to one step of slack is inherent to the grid; intrinsic
  blocks self-fit to within that (see below), and anything past it is space
  nothing can ever use.
- **overflow** / **overflow-x** — content is taller or wider than its box and
  gets clipped or scrolls inside the block.
- **page-overflow-x** — the page itself scrolls sideways.
- **grid gap mismatch** — the editor grid and the published grid use different
  gaps, so an arrangement doesn't survive publishing.

## The sizing contract the audit leans on

Every block type declares a `sizing` in `block-types.ts`:

- **intrinsic** (text, link lists, socials, gigs, fixed/aspect embeds) — `h`
  is derived from the rendered content. The editor measures each block and
  snaps its row span (the resize handle only changes width); the public grid
  re-measures at the published width and re-packs the layout around any
  corrected heights. Forced fixture sizes on these blocks are therefore
  self-corrected, which is exactly what `blocks-short`/`blocks-tall` verify.
- **fill** (cover images, galleries, scalable embeds, spacers) — content
  stretches to whatever box the user drew, at any size.

The public page also skips blocks with nothing to show (`blockHasContent`):
"No image selected"-style placeholders are editor affordances and never ship.

## Notes on trusting the numbers

Two failure modes would otherwise fill the report with fake findings, and both
are guarded:

- The harness sets `data-hydrated="1"` from an effect, and the audit waits for
  it. A page whose client JS never ran looks identical to a page where every
  block is empty.
- Every measurement is repeated until three consecutive passes agree, after
  rich text has populated and after the page has been scrolled once to trigger
  the lazy-loaded embeds.
