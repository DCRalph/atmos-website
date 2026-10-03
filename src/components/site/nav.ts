/** Public site navigation, shared by the header, mobile menu and footer. */
export const primaryNav = [
  { label: "Gigs", href: "/gigs" },
  { label: "Content", href: "/content" },
  { label: "Merch", href: "/merch" },
  { label: "Socials", href: "/socials" },
  { label: "Crew", href: "/crew" },
  { label: "Contact", href: "/contact" },
] as const;

export const secondaryNav = [
  { label: "Equipment", href: "/equipment" },
  { label: "About", href: "/about" },
] as const;

/** Routes that open on a full-bleed photo; the header floats clear over them. */
export const HERO_ROUTES: readonly string[] = [
  "/",
  "/gigs",
  "/crew",
  "/equipment",
];

/** Route prefixes whose pages all open on a hero (event pages, on their poster). */
export const HERO_ROUTE_PREFIXES: readonly string[] = ["/events/"];
