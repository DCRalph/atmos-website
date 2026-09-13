import { GigMode } from "~Prisma/browser";

/**
 * What each gig mode is called and what picking it actually does.
 *
 * One list, because the gig editor and the import wizard both offer the choice
 * and the two used to carry their own copy of the labels. The order here is the
 * order the admin sees, which is not the enum's order: `AFFILIATED` was
 * appended to the enum (see `GigMode` in the schema) but reads next to
 * `NORMAL`.
 */
export const GIG_MODES = [
  {
    value: GigMode.NORMAL,
    label: "Normal",
    summary: "On the site from the moment it is published, and it stays.",
  },
  {
    value: GigMode.TO_BE_ANNOUNCED,
    label: "To be announced",
    summary: "Listed with the title, line-up, date and poster withheld.",
  },
  {
    value: GigMode.AFFILIATED,
    label: "Affiliated",
    summary:
      "Someone else's night. Appears a day out, then leaves when it ends.",
  },
] as const satisfies readonly {
  value: GigMode;
  label: string;
  summary: string;
}[];

/** The admin-facing name of a mode. Falls back to the raw value. */
export const gigModeLabel = (mode: GigMode): string =>
  GIG_MODES.find((option) => option.value === mode)?.label ?? mode;
