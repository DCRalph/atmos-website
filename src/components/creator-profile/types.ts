import type { ListGig } from "~/components/site/gigs/gig-parts";
import type { ProfileSection } from "~/lib/creator-sections";

/**
 * Render-ready data for a public creator profile, built on the server by
 * `toPublicProfile` (or by `buildSampleProfile` for previews). Every image is
 * already a URL; nothing here needs the database.
 */
export type PublicProfile = {
  id: string;
  handle: string;
  name: string;
  tagline: string | null;
  bio: string | null;
  /** The creator's own photos. These take the theme's photo treatment. */
  portrait: string | null;
  banner: string | null;
  claimed: boolean;
  socials: PublicSocial[];
  /** Everything below the hero, in the creator's order. */
  sections: ProfileSection[];
  /** Soonest first; TBA gigs last. */
  upcoming: ProfileSet[];
  /** Most recent first. */
  past: ProfileSet[];
};

export type PublicSocial = {
  platform: string;
  url: string;
  label: string | null;
};

/** One slot on a lineup: the gig plus what this creator was billed as. */
export type ProfileSet = {
  id: string;
  /** What the site's ticket and link helpers need (`ticketCta`, `gigPath`). */
  gig: Pick<ListGig, "id" | "title" | "mode" | "ticketLink">;
  venue: string;
  start: Date;
  end: Date | null;
  /** Gig poster URL. Shown as made, never theme-treated. */
  poster: string | null;
  role: string | null;
};
