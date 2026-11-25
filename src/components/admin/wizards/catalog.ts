import type { LucideIcon } from "lucide-react";
import {
  Camera,
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
  "ticket-prices": {
    title: "Change ticket prices",
    description: "Reprice, add or close a ticket type",
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
      "ticket-prices",
      "event-basics",
      "guest-list",
      "door-staff",
    ],
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
