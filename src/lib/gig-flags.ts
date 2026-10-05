import type { Gig } from "~Prisma/browser";

/** The two independent switches on how a gig behaves on the public site. */
export type GigFlags = Pick<Gig, "isTba" | "isAffiliated">;

/**
 * What each gig flag is called and what turning it on actually does.
 *
 * One list, because the gig editor, the import wizard and the gigs table all
 * show them. Both off is a normal gig.
 */
export const GIG_FLAGS = [
  {
    key: "isTba",
    label: "To be announced",
    short: "TBA",
    summary: "Listed with the title, line-up, date and poster withheld.",
  },
  {
    key: "isAffiliated",
    label: "Affiliated",
    short: "Affiliated",
    summary:
      "Someone else's night. Appears a day out, then leaves when it ends.",
  },
] as const satisfies readonly {
  key: keyof GigFlags;
  label: string;
  short: string;
  summary: string;
}[];

/** The flags that are on, by name, or "Normal" when none are. */
export const gigFlagsLabel = (flags: GigFlags): string =>
  GIG_FLAGS.filter((flag) => flags[flag.key])
    .map((flag) => flag.label)
    .join(", ") || "Normal";
