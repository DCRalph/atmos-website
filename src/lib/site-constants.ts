/**
 * Public contact details and social accounts. One source for the site header,
 * footer, contact page, legal pages and structured data.
 */

export const CONTACT = {
  name: "Finn",
  email: "finn@atmosmedia.co.nz",
  phone: "+64 27 472 6850",
  phoneHref: "tel:+64274726850",
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
