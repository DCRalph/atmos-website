/**
 * Public contact details and social accounts. Enquiries should go through the
 * contact form; the email is only a quiet fallback on the contact and legal pages.
 */

export const CONTACT = {
  email: "admin@atmosmedia.co.nz",
} as const;

export const SOCIALS = {
  instagram: {
    label: "Instagram",
    handle: "@atmos.nz",
    href: "https://instagram.com/atmos.nz",
  },
  tiktok: {
    label: "TikTok",
    handle: "@atmos_tv",
    href: "https://tiktok.com/@atmos_tv",
  },
  youtube: {
    label: "YouTube",
    handle: "@Atmosmediatv",
    href: "https://www.youtube.com/@Atmosmediatv",
  },
  soundcloud: {
    label: "SoundCloud",
    handle: "atmosmedia",
    href: "https://soundcloud.com/atmosmedia",
  },
  spotify: {
    label: "Spotify",
    handle: "Atmos",
    href: "https://open.spotify.com/user/31zgkcouzyfpwhb3pfixdpvlfaom?si=a7f5f0fae13e4b1b",
  },
  facebook: {
    label: "Facebook",
    handle: "atmos.nz",
    href: "https://facebook.com/atmos.nz",
  },
} as const;

export type SocialKey = keyof typeof SOCIALS;


export const SITE_ACCENT = "#c6ff33";
