import type { PlaybookItem } from "./playbooks";

/**
 * Playbooks for the nights Atmos runs most, offered on the Playbooks tab.
 * Adding one copies it into the team's own playbooks, where it can be edited
 * like any other. They use four roles so applying one is four picks: lead
 * (bookings, money, sign-off), promo, design and production (the room, the
 * door, the run sheet).
 */

const days = (n: number) => n * 1440;

type Task = Omit<PlaybookItem, "critical" | "dependsOn"> &
  Partial<Pick<PlaybookItem, "critical" | "dependsOn">>;

export type StarterPlaybook = {
  name: string;
  description: string;
  items: PlaybookItem[];
};

const starter = (
  name: string,
  description: string,
  tasks: Task[],
): StarterPlaybook => ({
  name,
  description,
  items: tasks.map((task) => ({
    critical: false,
    dependsOn: [],
    ...task,
  })),
});

export const STARTER_PLAYBOOKS: StarterPlaybook[] = [
  starter("Club night", "Our own ticketed night, six weeks out", [
    {
      key: "venue",
      title: "Confirm venue, date and hire",
      offsetMinutes: days(-42),
      role: "lead",
      critical: true,
      notes: "Hire cost goes on the event's costs so break even is right.",
    },
    {
      key: "lineup",
      title: "Lock the line-up and send offers",
      offsetMinutes: days(-35),
      role: "lead",
      critical: true,
      dependsOn: ["venue"],
    },
    {
      key: "poster",
      title: "Poster design",
      offsetMinutes: days(-30),
      role: "design",
      reviewerRole: "lead",
      dependsOn: ["lineup"],
      notes:
        "Portrait for print and the gig page, landscape for the /gigs hero and link previews.",
    },
    {
      key: "event",
      title: "Set up the ticketed event and tiers",
      offsetMinutes: days(-28),
      role: "promo",
      reviewerRole: "lead",
      dependsOn: ["lineup"],
      notes:
        "Create it from the gig so the gig page shows the buy panel. Early bird first, then the next tier set to release after it.",
    },
    {
      key: "announce",
      title: "Announce the night",
      offsetMinutes: days(-28),
      role: "promo",
      dependsOn: ["poster", "event"],
    },
    {
      key: "print",
      title: "Print posters",
      offsetMinutes: days(-21),
      role: "promo",
      dependsOn: ["poster"],
    },
    {
      key: "posters-up",
      title: "Put posters up around town",
      offsetMinutes: days(-18),
      role: "promo",
      dependsOn: ["print"],
    },
    {
      key: "door",
      title: "Book door staff and security",
      offsetMinutes: days(-14),
      role: "production",
      critical: true,
      notes: "Add them as door staff on the event so they can scan.",
    },
    {
      key: "photographer",
      title: "Book a photographer",
      offsetMinutes: days(-14),
      role: "production",
    },
    {
      key: "campaigns",
      title: "Set up campaigns and tagged links",
      offsetMinutes: days(-10),
      role: "promo",
      dependsOn: ["announce"],
    },
    {
      key: "run-sheet",
      title: "Build the run sheet with set times",
      offsetMinutes: days(-7),
      role: "production",
      dependsOn: ["lineup"],
    },
    {
      key: "gear",
      title: "Confirm sound, lights and gear",
      offsetMinutes: days(-7),
      role: "production",
    },
    {
      key: "set-times",
      title: "Send artists set times and load-in",
      offsetMinutes: days(-3),
      role: "lead",
      dependsOn: ["run-sheet"],
    },
    {
      key: "cues",
      title: "Choose who hears cues",
      offsetMinutes: days(-2),
      role: "production",
      dependsOn: ["run-sheet"],
      notes: "Check everyone on the list has the app, or they hear nothing.",
    },
    {
      key: "final-push",
      title: "Final push on socials",
      offsetMinutes: days(-1),
      role: "promo",
    },
    {
      key: "door-kit",
      title: "Door kit: float, wristbands, scanner charged",
      offsetMinutes: 0,
      role: "production",
      critical: true,
    },
    {
      key: "door-totals",
      title: "Enter door totals",
      offsetMinutes: days(1),
      role: "production",
      notes: "Cash and EFTPOS taken off the platform, under the event's costs.",
    },
    {
      key: "photos",
      title: "Photos up and send the photos email",
      offsetMinutes: days(2),
      role: "promo",
    },
    {
      key: "settle",
      title: "Pay artists and settle the venue",
      offsetMinutes: days(3),
      role: "lead",
    },
  ]),
  starter("Headline show", "A bigger night with a touring act, ten weeks out", [
    {
      key: "venue",
      title: "Venue contract and deposit",
      offsetMinutes: days(-70),
      role: "lead",
      critical: true,
    },
    {
      key: "headliner",
      title: "Book the headliner: fee, travel and rider",
      offsetMinutes: days(-63),
      role: "lead",
      critical: true,
      dependsOn: ["venue"],
    },
    {
      key: "licence",
      title: "Apply for a special licence",
      offsetMinutes: days(-56),
      role: "production",
      critical: true,
      dependsOn: ["venue"],
      notes: "Only if the venue's own licence does not cover the night.",
    },
    {
      key: "support",
      title: "Book support acts",
      offsetMinutes: days(-49),
      role: "lead",
      dependsOn: ["headliner"],
    },
    {
      key: "artwork",
      title: "Poster and announcement artwork",
      offsetMinutes: days(-45),
      role: "design",
      reviewerRole: "lead",
      dependsOn: ["headliner"],
    },
    {
      key: "event",
      title: "Set up the event, tiers and early bird",
      offsetMinutes: days(-42),
      role: "promo",
      reviewerRole: "lead",
      dependsOn: ["headliner"],
    },
    {
      key: "announce",
      title: "Announce the headliner",
      offsetMinutes: days(-42),
      role: "promo",
      dependsOn: ["artwork", "event"],
    },
    {
      key: "ads",
      title: "Plan the ad campaign and spend",
      offsetMinutes: days(-35),
      role: "promo",
      dependsOn: ["announce"],
      notes: "One campaign per channel, so each shows what it cost and sold.",
    },
    {
      key: "support-announce",
      title: "Announce support and release the next tier",
      offsetMinutes: days(-28),
      role: "promo",
      dependsOn: ["support", "announce"],
    },
    {
      key: "merch",
      title: "Order merch",
      offsetMinutes: days(-28),
      role: "lead",
    },
    {
      key: "security",
      title: "Book security, door staff and first aid",
      offsetMinutes: days(-21),
      role: "production",
      critical: true,
    },
    {
      key: "travel",
      title: "Book headliner travel and accommodation",
      offsetMinutes: days(-21),
      role: "lead",
      dependsOn: ["headliner"],
    },
    {
      key: "posters",
      title: "Print and put up posters",
      offsetMinutes: days(-14),
      role: "promo",
      dependsOn: ["artwork"],
    },
    {
      key: "content",
      title: "Book a photographer and videographer",
      offsetMinutes: days(-14),
      role: "production",
    },
    {
      key: "production",
      title: "Production plan: stage, sound, lights and backline",
      offsetMinutes: days(-10),
      role: "production",
      dependsOn: ["headliner"],
    },
    {
      key: "run-sheet",
      title: "Run sheet with set times and cues",
      offsetMinutes: days(-7),
      role: "production",
      dependsOn: ["support"],
    },
    {
      key: "day-sheet",
      title: "Send artists their day sheet",
      offsetMinutes: days(-5),
      role: "lead",
      dependsOn: ["run-sheet", "travel"],
    },
    {
      key: "cues",
      title: "Choose who hears cues",
      offsetMinutes: days(-2),
      role: "production",
      dependsOn: ["run-sheet"],
    },
    {
      key: "final-push",
      title: "Final push and capacity check",
      offsetMinutes: days(-1),
      role: "promo",
    },
    {
      key: "door-kit",
      title: "Door kit and float",
      offsetMinutes: 0,
      role: "production",
      critical: true,
    },
    {
      key: "door-totals",
      title: "Enter door totals and final costs",
      offsetMinutes: days(1),
      role: "production",
    },
    {
      key: "photos",
      title: "Photos up and send the photos email",
      offsetMinutes: days(2),
      role: "promo",
    },
    {
      key: "settle",
      title: "Settle artists, venue and suppliers",
      offsetMinutes: days(4),
      role: "lead",
    },
  ]),
  starter("On someone else's bill", "An affiliated gig we play but don't run", [
    {
      key: "confirm",
      title: "Confirm set time, fee and gear",
      offsetMinutes: days(-21),
      role: "lead",
      critical: true,
    },
    {
      key: "listing",
      title: "Add the gig to the site as affiliated",
      offsetMinutes: days(-14),
      role: "promo",
      dependsOn: ["confirm"],
      notes: "Their ticket link goes on the gig, there is no event of ours.",
    },
    {
      key: "share",
      title: "Share their poster and tag the line-up",
      offsetMinutes: days(-14),
      role: "promo",
      dependsOn: ["confirm"],
    },
    {
      key: "load-in",
      title: "Confirm load-in and what we bring",
      offsetMinutes: days(-3),
      role: "production",
      dependsOn: ["confirm"],
    },
    {
      key: "story",
      title: "Post a story the day before",
      offsetMinutes: days(-1),
      role: "promo",
    },
    {
      key: "thanks",
      title: "Post photos and a thank you",
      offsetMinutes: days(2),
      role: "promo",
    },
  ]),
  starter("Private party", "Invite only, guest list at the door", [
    {
      key: "venue",
      title: "Confirm venue and numbers",
      offsetMinutes: days(-21),
      role: "lead",
      critical: true,
    },
    {
      key: "event",
      title: "Set up a private event with a guest list tier",
      offsetMinutes: days(-18),
      role: "promo",
      reviewerRole: "lead",
      dependsOn: ["venue"],
      notes:
        "Visibility private, so the link only opens with its access key. The tier needs approval.",
    },
    {
      key: "invites",
      title: "Send the invite link to the guest list",
      offsetMinutes: days(-14),
      role: "promo",
      dependsOn: ["event"],
    },
    {
      key: "approvals",
      title: "Approve guest list requests",
      offsetMinutes: days(-7),
      role: "lead",
      dependsOn: ["invites"],
    },
    {
      key: "run-sheet",
      title: "Run sheet and who's on the door",
      offsetMinutes: days(-7),
      role: "production",
      dependsOn: ["venue"],
    },
    {
      key: "door",
      title: "Check the door list and brief staff",
      offsetMinutes: days(-1),
      role: "production",
      dependsOn: ["approvals", "run-sheet"],
    },
    {
      key: "thanks",
      title: "Thank you and photos",
      offsetMinutes: days(2),
      role: "promo",
    },
  ]),
];
