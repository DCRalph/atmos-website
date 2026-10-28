import type {
  PlaybookItem,
  PlaybookRole,
  PlaybookWhen,
  Weekday,
} from "./playbooks";

/**
 * Playbooks for the nights Atmos runs most, offered on the Playbooks tab.
 * Adding one copies it into the team's own playbooks, where it can be edited
 * like any other. They share four roles so applying one is four picks, and
 * their tasks are due at 5pm unless they say otherwise.
 */

const ROLES: PlaybookRole[] = [
  { name: "lead", userId: null, note: "Bookings, money and sign-off" },
  { name: "promo", userId: null, note: "Announcements, socials and tickets" },
  { name: "design", userId: null, note: "Posters and artwork" },
  {
    name: "production",
    userId: null,
    note: "The room, the door and the run sheet",
  },
];

/** Whole days from the gig. */
const days = (days: number, weekdays?: true): PlaybookWhen =>
  weekdays ? { kind: "days", days, weekdays } : { kind: "days", days };
/** The weekday before the gig, `weeks` further out. */
const before = (day: Weekday, weeks = 0): PlaybookWhen => ({
  kind: "weekday",
  day,
  side: "before",
  weeks,
});
const after = (day: Weekday, weeks = 0): PlaybookWhen => ({
  kind: "weekday",
  day,
  side: "after",
  weeks,
});

type Task = Omit<PlaybookItem, "critical" | "dependsOn"> &
  Partial<Pick<PlaybookItem, "critical" | "dependsOn">>;

export type StarterPlaybook = {
  name: string;
  description: string;
  dueTime: string;
  roles: PlaybookRole[];
  tasks: PlaybookItem[];
};

const starter = (
  name: string,
  description: string,
  tasks: Task[],
): StarterPlaybook => ({
  name,
  description,
  dueTime: "17:00",
  // Only the roles its tasks use.
  roles: ROLES.filter((role) =>
    tasks.some((task) => [task.role, task.reviewerRole].includes(role.name)),
  ),
  tasks: tasks.map((task) => ({ critical: false, dependsOn: [], ...task })),
});

export const STARTER_PLAYBOOKS: StarterPlaybook[] = [
  starter("Club night", "Our own ticketed night, six weeks out", [
    {
      key: "venue",
      title: "Confirm venue, date and hire",
      when: days(-42),
      role: "lead",
      critical: true,
      notes: "Hire cost goes on the event's costs so break even is right.",
    },
    {
      key: "lineup",
      title: "Lock the line-up and send offers",
      when: days(-35),
      role: "lead",
      critical: true,
      dependsOn: ["venue"],
    },
    {
      key: "poster",
      title: "Poster design",
      when: before("mon", 3),
      role: "design",
      reviewerRole: "lead",
      dependsOn: ["lineup"],
      notes:
        "Portrait for print and the gig page, landscape for the /gigs hero and link previews.",
    },
    {
      key: "event",
      title: "Set up the ticketed event and tiers",
      when: before("tue", 3),
      role: "promo",
      reviewerRole: "lead",
      dependsOn: ["lineup"],
      notes:
        "Create it from the gig so the gig page shows the buy panel. Early bird first, then the next tier set to release after it.",
    },
    {
      key: "announce",
      title: "Announce the night",
      when: before("wed", 3),
      time: "18:00",
      role: "promo",
      dependsOn: ["poster", "event"],
    },
    {
      key: "print",
      title: "Print posters",
      when: days(-21, true),
      notes:
        "Printers don't work weekends, so a weekend date moves to the Friday before.",
      role: "promo",
      dependsOn: ["poster"],
    },
    {
      key: "posters-up",
      title: "Put posters up around town",
      when: before("thu", 2),
      role: "promo",
      dependsOn: ["print"],
    },
    {
      key: "door",
      title: "Book door staff and security",
      when: before("mon", 1),
      role: "production",
      critical: true,
      notes: "Add them as door staff on the event so they can scan.",
    },
    {
      key: "photographer",
      title: "Book a photographer",
      when: days(-14),
      role: "production",
    },
    {
      key: "campaigns",
      title: "Set up campaigns and tagged links",
      when: days(-10),
      role: "promo",
      dependsOn: ["announce"],
    },
    {
      key: "run-sheet",
      title: "Build the run sheet with set times",
      when: before("mon"),
      role: "production",
      dependsOn: ["lineup"],
    },
    {
      key: "gear",
      title: "Confirm sound, lights and gear",
      when: before("tue"),
      role: "production",
    },
    {
      key: "set-times",
      title: "Send artists set times and load-in",
      when: before("wed"),
      role: "lead",
      dependsOn: ["run-sheet"],
    },
    {
      key: "cues",
      title: "Choose who hears cues",
      when: days(-2),
      role: "production",
      dependsOn: ["run-sheet"],
      notes: "Check everyone on the list has the app, or they hear nothing.",
    },
    {
      key: "final-push",
      title: "Final push on socials",
      when: days(-1),
      time: "12:00",
      role: "promo",
    },
    {
      key: "door-kit",
      title: "Door kit: float, wristbands, scanner charged",
      when: { kind: "hours", hours: -2, from: "doors" },
      role: "production",
      critical: true,
    },
    {
      key: "door-totals",
      title: "Enter door totals",
      when: days(1),
      time: "12:00",
      role: "production",
      notes: "Cash and EFTPOS taken off the platform, under the event's costs.",
    },
    {
      key: "photos",
      title: "Photos up and send the photos email",
      when: after("tue"),
      role: "promo",
    },
    {
      key: "settle",
      title: "Pay artists and settle the venue",
      when: after("wed"),
      role: "lead",
    },
  ]),
  starter("Headline show", "A bigger night with a touring act, ten weeks out", [
    {
      key: "venue",
      title: "Venue contract and deposit",
      when: days(-70),
      role: "lead",
      critical: true,
    },
    {
      key: "headliner",
      title: "Book the headliner: fee, travel and rider",
      when: days(-63),
      role: "lead",
      critical: true,
      dependsOn: ["venue"],
    },
    {
      key: "licence",
      title: "Apply for a special licence",
      when: days(-56),
      role: "production",
      critical: true,
      dependsOn: ["venue"],
      notes: "Only if the venue's own licence does not cover the night.",
    },
    {
      key: "support",
      title: "Book support acts",
      when: days(-49),
      role: "lead",
      dependsOn: ["headliner"],
    },
    {
      key: "artwork",
      title: "Poster and announcement artwork",
      when: days(-45),
      role: "design",
      reviewerRole: "lead",
      dependsOn: ["headliner"],
    },
    {
      key: "event",
      title: "Set up the event, tiers and early bird",
      when: days(-42),
      role: "promo",
      reviewerRole: "lead",
      dependsOn: ["headliner"],
    },
    {
      key: "announce",
      title: "Announce the headliner",
      when: days(-42),
      role: "promo",
      dependsOn: ["artwork", "event"],
    },
    {
      key: "ads",
      title: "Plan the ad campaign and spend",
      when: days(-35),
      role: "promo",
      dependsOn: ["announce"],
      notes: "One campaign per channel, so each shows what it cost and sold.",
    },
    {
      key: "support-announce",
      title: "Announce support and release the next tier",
      when: days(-28),
      role: "promo",
      dependsOn: ["support", "announce"],
    },
    {
      key: "merch",
      title: "Order merch",
      when: days(-28),
      role: "lead",
    },
    {
      key: "security",
      title: "Book security, door staff and first aid",
      when: days(-21),
      role: "production",
      critical: true,
    },
    {
      key: "travel",
      title: "Book headliner travel and accommodation",
      when: days(-21),
      role: "lead",
      dependsOn: ["headliner"],
    },
    {
      key: "posters",
      title: "Print and put up posters",
      when: days(-14),
      role: "promo",
      dependsOn: ["artwork"],
    },
    {
      key: "content",
      title: "Book a photographer and videographer",
      when: days(-14),
      role: "production",
    },
    {
      key: "production",
      title: "Production plan: stage, sound, lights and backline",
      when: days(-10),
      role: "production",
      dependsOn: ["headliner"],
    },
    {
      key: "run-sheet",
      title: "Run sheet with set times and cues",
      when: before("mon", 1),
      role: "production",
      dependsOn: ["support"],
    },
    {
      key: "day-sheet",
      title: "Send artists their day sheet",
      when: before("tue"),
      role: "lead",
      dependsOn: ["run-sheet", "travel"],
    },
    {
      key: "cues",
      title: "Choose who hears cues",
      when: days(-2),
      role: "production",
      dependsOn: ["run-sheet"],
    },
    {
      key: "final-push",
      title: "Final push and capacity check",
      when: days(-1),
      role: "promo",
    },
    {
      key: "door-kit",
      title: "Door kit and float",
      when: days(0),
      role: "production",
      critical: true,
    },
    {
      key: "door-totals",
      title: "Enter door totals and final costs",
      when: days(1),
      role: "production",
    },
    {
      key: "photos",
      title: "Photos up and send the photos email",
      when: days(2),
      role: "promo",
    },
    {
      key: "settle",
      title: "Settle artists, venue and suppliers",
      when: after("wed"),
      role: "lead",
    },
  ]),
  starter("On someone else's bill", "An affiliated gig we play but don't run", [
    {
      key: "confirm",
      title: "Confirm set time, fee and gear",
      when: days(-21),
      role: "lead",
      critical: true,
    },
    {
      key: "listing",
      title: "Add the gig to the site as affiliated",
      when: days(-14),
      role: "promo",
      dependsOn: ["confirm"],
      notes: "Their ticket link goes on the gig, there is no event of ours.",
    },
    {
      key: "share",
      title: "Share their poster and tag the line-up",
      when: days(-14),
      role: "promo",
      dependsOn: ["confirm"],
    },
    {
      key: "load-in",
      title: "Confirm load-in and what we bring",
      when: days(-3),
      role: "production",
      dependsOn: ["confirm"],
    },
    {
      key: "story",
      title: "Post a story the day before",
      when: days(-1),
      role: "promo",
    },
    {
      key: "thanks",
      title: "Post photos and a thank you",
      when: days(2),
      role: "promo",
    },
  ]),
  starter("Private party", "Invite only, guest list at the door", [
    {
      key: "venue",
      title: "Confirm venue and numbers",
      when: days(-21),
      role: "lead",
      critical: true,
    },
    {
      key: "event",
      title: "Set up a private event with a guest list tier",
      when: days(-18),
      role: "promo",
      reviewerRole: "lead",
      dependsOn: ["venue"],
      notes:
        "Visibility private, so the link only opens with its access key. The tier needs approval.",
    },
    {
      key: "invites",
      title: "Send the invite link to the guest list",
      when: days(-14),
      role: "promo",
      dependsOn: ["event"],
    },
    {
      key: "approvals",
      title: "Approve guest list requests",
      when: days(-7),
      role: "lead",
      dependsOn: ["invites"],
    },
    {
      key: "run-sheet",
      title: "Run sheet and who's on the door",
      when: days(-7),
      role: "production",
      dependsOn: ["venue"],
    },
    {
      key: "door",
      title: "Check the door list and brief staff",
      when: days(-1),
      role: "production",
      dependsOn: ["approvals", "run-sheet"],
    },
    {
      key: "thanks",
      title: "Thank you and photos",
      when: days(2),
      role: "promo",
    },
  ]),
];
