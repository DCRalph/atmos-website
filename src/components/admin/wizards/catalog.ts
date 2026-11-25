import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Camera,
  DoorOpen,
  KeyRound,
  Link2,
  MicVocal,
  UsersRound,
  CalendarPlus,
  EyeOff,
  Image as ImageIcon,
  ListMusic,
  PencilLine,
  ScanLine,
  Tag,
  Ticket,
  TicketPlus,
  UserPlus,
} from "lucide-react";

/**
 * Every wizard: one job, a few steps, one Save. The launcher at `/admin/do`
 * lists them from here, and `/admin/do/<key>` opens one.
 *
 * `needs` is what the wizard works on. A wizard opened without it asks for it
 * as its first step, so a link from somewhere that already knows the gig can
 * skip straight to the work with `?gig=` or `?event=`.
 */
export const WIZARDS = {
  lineup: {
    title: "Set the line-up",
    description: "Who's playing, in what order, and when",
    icon: ListMusic,
    needs: "gig",
  },
  poster: {
    title: "Upload a poster",
    description: "Portrait, plus a wide one if you have it",
    icon: ImageIcon,
    needs: "gig",
  },
  "gig-basics": {
    title: "Update the basics",
    description: "Name, date, venue, description, ticket link",
    icon: PencilLine,
    needs: "gig",
  },
  "new-gig": {
    title: "New gig",
    description: "From an Instagram post, or from scratch",
    icon: CalendarPlus,
    needs: "none",
  },
  announce: {
    title: "Announce later",
    description: "Keep the details back until a set time",
    icon: EyeOff,
    needs: "gig",
  },
  "after-night": {
    title: "After the night",
    description: "Upload the photos and tell the people who asked",
    icon: Camera,
    needs: "gig",
  },
  "sell-tickets": {
    title: "Sell tickets for a gig",
    description: "Tickets, prices, and when sales open",
    icon: TicketPlus,
    needs: "gig",
  },
  "ticket-types": {
    title: "Set up ticket types",
    description: "Prices, how many, when they sell, who can buy",
    icon: Tag,
    needs: "event",
  },
  "event-basics": {
    title: "Update event details",
    description: "Doors, times, venue, description",
    icon: Ticket,
    needs: "event",
  },
  "guest-list": {
    title: "Guest list someone",
    description: "Free tickets, sent by email",
    icon: UserPlus,
    needs: "event",
  },
  "door-staff": {
    title: "Add door staff",
    description: "Who can scan people in",
    icon: ScanLine,
    needs: "event",
  },
  "make-code": {
    title: "Make a code",
    description: "Money off, or opens a hidden ticket type",
    icon: KeyRound,
    needs: "event",
  },
  "comp-group": {
    title: "Comp a group",
    description: "Free tickets for several people at once",
    icon: UsersRound,
    needs: "event",
  },
  "go-to-door": {
    title: "Close online sales",
    description: "Stop selling online and sell the rest at the door",
    icon: DoorOpen,
    needs: "event",
  },
  "change-ticket": {
    title: "Change a buyer's ticket",
    description: "Fix their details, names on tickets, or access",
    icon: ArrowLeftRight,
    needs: "none",
  },
  artist: {
    title: "Add or claim an artist",
    description: "A new profile, or hand one to its artist",
    icon: MicVocal,
    needs: "none",
  },
  "short-link": {
    title: "Make a short link",
    description: "A short link for a gig, an event, or anywhere",
    icon: Link2,
    needs: "none",
  },
} as const satisfies Record<
  string,
  {
    title: string;
    description: string;
    icon: LucideIcon;
    needs: "gig" | "event" | "none";
  }
>;

export type WizardKey = keyof typeof WIZARDS;

/** The launcher's groups, in the order they are shown. */
export const WIZARD_GROUPS: { title: string; keys: WizardKey[] }[] = [
  {
    title: "Gigs",
    keys: [
      "lineup",
      "poster",
      "gig-basics",
      "new-gig",
      "announce",
      "after-night",
    ],
  },
  {
    title: "Tickets",
    keys: [
      "sell-tickets",
      "ticket-types",
      "event-basics",
      "guest-list",
      "comp-group",
      "make-code",
      "door-staff",
      "go-to-door",
      "change-ticket",
    ],
  },
  {
    title: "Other",
    keys: ["artist", "short-link"],
  },
];

export const isWizardKey = (value: string): value is WizardKey =>
  Object.hasOwn(WIZARDS, value);

/** The link that opens a wizard, already pointed at a gig or event when known. */
export function wizardHref(
  key: WizardKey,
  target: { gigId?: string | null; eventId?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (target.gigId) params.set("gig", target.gigId);
  if (target.eventId) params.set("event", target.eventId);
  const query = params.toString();
  return `/admin/do/${key}${query ? `?${query}` : ""}`;
}
