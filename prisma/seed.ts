import { db } from "~/server/db";

type ContentItem = {
  id: number;
  type: string;
  title: string;
  description: string;
  date: string;
  link: string;
};

// Example content - replace with actual data
const contentItems: ContentItem[] = [
  {
    id: 1,
    type: "mix",
    title: "Atmos Mix Vol. 1",
    description: "Deep house and techno vibes for late night sessions",
    date: "2025-10-01",
    link: "#",
  },
  {
    id: 2,
    type: "video",
    title: "Behind the Decks",
    description: "Studio session featuring our latest tracks",
    date: "2025-09-25",
    link: "#",
  },
  {
    id: 3,
    type: "playlist",
    title: "Atmos Selects",
    description: "Curated selection of tracks we're playing out right now",
    date: "2025-09-20",
    link: "#",
  },
  {
    id: 4,
    type: "mix",
    title: "Live @ Printworks",
    description: "Recording from our recent London show",
    date: "2025-09-15",
    link: "#",
  },
];

type CrewMember = {
  id: number;
  name: string;
  role: string;
  socials: {
    instagram: string;
    soundcloud: string;
  };
  image: string;
};

// Crew members with their Instagram profiles
const crewMembers: CrewMember[] = [
  {
    id: 1,
    name: "broderbeats",
    role: "Producer / DJ",
    socials: {
      instagram: "https://www.instagram.com/broderbeats/",
      soundcloud: "https://soundcloud.com/broderbeats",
    },
    image: "/crew_pfp/broderbeats.jpg",
  },
  {
    id: 2,
    name: "Sunday",
    role: "DJ / Producer",
    socials: {
      instagram: "https://www.instagram.com/probablysunday/",
      soundcloud: "https://soundcloud.com/djsundaymusic",
    },
    image: "/crew_pfp/sunday.jpg",
  },
  {
    id: 3,
    name: "Special K",
    role: "DJ / Producer",
    socials: {
      instagram: "https://www.instagram.com/specialknz_/",
      soundcloud: "https://soundcloud.com/devilmcrx292",
    },
    image: "/crew_pfp/specialk.jpg",
  },
  {
    id: 4,
    name: "Taiji",
    role: "DJ / Producer",
    socials: {
      instagram: "https://www.instagram.com/taiji.nz/",
      soundcloud: "https://soundcloud.com/taiji-730606296",
    },
    image: "/crew_pfp/taiji.jpg",
  },
  {
    id: 5,
    name: "Willonvx",
    role: "Videographer",
    socials: {
      instagram: "https://www.instagram.com/willonvx/",
      soundcloud: "",
    },
    image: "/crew_pfp/willonvx.jpg",
  },
];

// Example gig data - replace with actual database queries
type GigSeedData = {
  id: number;
  date: string;
  title: string;
  subtitle: string;
  time?: string | null;
  gigStartTime?: string | null;
  gigEndTime?: string | null;
  ticketLink?: string | null;
};

const upcomingGigs: GigSeedData[] = [
  {
    id: 1,
    date: "Nov 7",
    title: "Atmos & Frenz presents: broderbeats - Bounce release party",
    subtitle: "Queens Wharf (secret location)",
    time: "6:00 PM - 11:00 PM", // Can be a time range string or null
    gigStartTime: "6:00 PM", // Optional: specific start time
    gigEndTime: "11:00 PM", // Optional: specific end time
    ticketLink: null,
  },
  // {
  //   id: 2,
  //   date: "TBA",
  //   title: "6 🤲 7",
  //   subtitle: "Wellington",
  //   time: "TBA",
  //   ticketLink: null,
  // },
];

const pastGigs = [
  {
    id: 1,
    date: "Mar 29",
    title: "Keke (UK) with Poppa Jax, Fine China, Kayseeyuh, Licious",
    subtitle: "Wellington",
  },

  {
    id: 2,
    date: "Mar 14",
    title:
      "Katayanagi twins with Randy Sjafrie, Kayseeyuh, DJ Gooda, Broderbeats, ",
    subtitle: "Wellington",
  },
  {
    id: 3,
    date: "Oct 26",
    title: "Scruz (UK) with Fronta Licious B2B Stargirl, Sunday, Special K",
    subtitle: "Wellington",
  },
  {
    id: 4,
    date: "Jun 14",
    title: "Messie with Swimcapm Jswizzle, E-boy, Kuri",
    subtitle: "Wellington",
  },
  {
    id: 5,
    date: "Jun 8",
    title: "Caged V2 with Kraayjoy, Bidois, Broderbeats, Licious, Tonkus",
    subtitle: "Wellington",
  },
  {
    id: 6,
    date: "May 11",
    title: "Caged V1 with Myelin (US), Shaq, Licious, Special K, Taiji",
    subtitle: "Wellington",
  },
];

type MerchItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
};

const merchItems: MerchItem[] = [
  {
    id: 1,
    name: "Atmos classic oversized tee",
    description: "Classic oversized Atmos tee. (White)",
    price: 69.69,
    image: "/shop/1.jpg",
  },
  {
    id: 2,
    name: "Atmos classic oversized tee",
    description: "Classic oversized Atmos tee. (Black)",
    price: 69.69,
    image: "/shop/1.jpg",
  },
];

// Helper function to parse date strings and convert to UTC at midnight
function parseDate(dateStr: string, isUpcoming = false): Date {
  let date: Date;

  // Handle "Nov 7" format
  if (dateStr.includes(" ") && !dateStr.includes("-")) {
    const currentYear = new Date().getFullYear();
    const monthMap: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };

    const parts = dateStr.trim().split(" ");
    if (parts.length === 2 && parts[0] && parts[1]) {
      const month = monthMap[parts[0]];
      const day = parseInt(parts[1], 10);
      if (month !== undefined && !isNaN(day)) {
        // For upcoming gigs, if the date has passed this year, use next year
        const year =
          isUpcoming && new Date(currentYear, month, day) < new Date()
            ? currentYear + 1
            : currentYear;
        date = new Date(year, month, day);
      } else {
        date = new Date();
      }
    } else {
      date = new Date();
    }
  } else if (dateStr.includes("-")) {
    // Handle "YYYY-MM-DD" format
    date = new Date(dateStr);
  } else {
    // Fallback to current date
    date = new Date();
  }

  // Convert to UTC at midnight
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
  );
}

// Helper function to parse time strings like "6:00 PM" or "6:00 PM - 11:00 PM"
function parseTime(
  timeStr: string | null | undefined,
  baseDate: Date,
): Date | null {
  if (!timeStr || timeStr === "TBA") {
    return null;
  }

  // Handle time range like "6:00 PM - 11:00 PM" - take the first time
  const timePart = timeStr.includes(" - ")
    ? timeStr.split(" - ")[0]?.trim()
    : timeStr.trim();

  if (!timePart) {
    return null;
  }

  // Parse time like "6:00 PM" or "18:00"
  const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
  const timeMatch = timeRegex.exec(timePart);
  if (!timeMatch) {
    return null;
  }

  let hours = parseInt(timeMatch[1] ?? "0", 10);
  const minutes = parseInt(timeMatch[2] ?? "0", 10);
  const period = timeMatch[3]?.toUpperCase();

  // Convert to 24-hour format
  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  // Create datetime using the base date with the parsed time
  // Convert to UTC preserving the local time
  const localDate = new Date(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hours,
    minutes,
    0,
    0,
  );

  // Return as UTC (the Date object represents the correct moment in time)
  return localDate;
}

// Helper function to parse start and end times separately
function parseStartEndTime(
  startTimeStr: string | null | undefined,
  endTimeStr: string | null | undefined,
  baseDate: Date,
): { startTime: Date | null; endTime: Date | null } {
  return {
    startTime: startTimeStr ? parseTime(startTimeStr, baseDate) : null,
    endTime: endTimeStr ? parseTime(endTimeStr, baseDate) : null,
  };
}

async function main() {
  console.log("Starting database seed...");
  // Delete all existing data
  await db.gig.deleteMany();
  await db.crewMember.deleteMany();
  await db.contentItem.deleteMany();
  await db.merchItem.deleteMany();
  await db.contactSubmission.deleteMany();

  // Seed ContentItems
  console.log("Seeding content items...");
  for (const item of contentItems) {
    await db.contentItem.create({
      data: {
        type: item.type,
        title: item.title,
        description: item.description,
        date: parseDate(item.date),
        link: item.link,
      },
    });
  }
  console.log(`✓ Seeded ${contentItems.length} content items`);

  // Seed CrewMembers
  console.log("Seeding crew members...");
  for (const member of crewMembers) {
    await db.crewMember.create({
      data: {
        name: member.name,
        role: member.role,
        instagram: member.socials.instagram || null,
        soundcloud: member.socials.soundcloud || null,
        image: member.image,
      },
    });
  }
  console.log(`✓ Seeded ${crewMembers.length} crew members`);

  // Seed Upcoming Gigs
  console.log("Seeding upcoming gigs...");
  for (const gig of upcomingGigs) {
    const gigDate = parseDate(gig.date, true);

    // let gigStartTime: Date | null = null;
    let gigEndTime: Date | null = null;

    if (gig.gigStartTime || gig.gigEndTime) {
      // Use explicit start/end times if provided
      const parsed = parseStartEndTime(
        gig.gigStartTime,
        gig.gigEndTime,
        gigDate,
      );
      // gigStartTime = parsed.startTime;
      gigEndTime = parsed.endTime;
    } else if (gig.time) {
      // Parse from time string (e.g., "6:00 PM - 11:00 PM")
      if (gig.time.includes(" - ")) {
        const [start, end] = gig.time.split(" - ");
        const parsed = parseStartEndTime(start, end, gigDate);
        // gigStartTime = parsed.startTime;
        gigEndTime = parsed.endTime;
      }
    }

    await db.gig.create({
      data: {
        // date: gigDate,
        title: gig.title,
        subtitle: gig.subtitle,
        gigStartTime: gigDate,
        gigEndTime,
        ticketLink: gig.ticketLink === "#" ? null : (gig.ticketLink ?? null),
      },
    });
  }
  console.log(`✓ Seeded ${upcomingGigs.length} upcoming gigs`);

  // Seed Past Gigs
  console.log("Seeding past gigs...");
  for (const gig of pastGigs) {
    const gigDate = parseDate(gig.date, false);

    await db.gig.create({
      data: {
        // date: gigDate,
        title: gig.title,
        subtitle: gig.subtitle,
        gigStartTime: gigDate,
        gigEndTime: null,
        ticketLink: null,
      },
    });
  }
  console.log(`✓ Seeded ${pastGigs.length} past gigs`);

  // Seed MerchItems
  console.log("Seeding merch items...");
  for (const item of merchItems) {
    await db.merchItem.create({
      data: {
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
      },
    });
  }
  console.log(`✓ Seeded ${merchItems.length} merch items`);

  console.log("Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
