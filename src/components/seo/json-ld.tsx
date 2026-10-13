import {
  SITE_NAME,
  SITE_URL,
  DESCRIPTION_SHORT,
  DESCRIPTION_LONG,
  DEFAULT_OG_IMAGE,
} from "~/lib/seo-constants";
import { SOCIALS } from "~/lib/site-constants";

/** Site-relative paths made absolute; structured data needs full URLs. */
const absoluteUrl = (url: string) => new URL(url, SITE_URL).href;

/**
 * Renders structured data as a plain script tag, so it is in the server HTML
 * for crawlers that don't run JavaScript. `<` is escaped so a value can't
 * close the tag early.
 */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

// Organization structured data
export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        alternateName: "ATMOS Media",
        url: SITE_URL,
        logo: absoluteUrl("/logo/atmos-black.png"),
        description: DESCRIPTION_LONG,
        sameAs: Object.values(SOCIALS).map((social) => social.href),
        knowsAbout: [
          "Electronic Music",
          "Club Nights",
          "DJ Events",
          "Techno",
          "House Music",
          "Underground Music",
        ],
      }}
    />
  );
}

// WebSite structured data
export function WebSiteJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        alternateName: "ATMOS Events",
        url: SITE_URL,
        description: DESCRIPTION_SHORT,
        inLanguage: "en-NZ",
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
        },
      }}
    />
  );
}

/** A ticket on offer, priced in NZD. */
export type JsonLdOffer = {
  name: string;
  /** Whole dollars, e.g. 25 or 32.5. */
  price: number;
  available: boolean;
  validFrom?: Date | null;
};

/** A ticket event's tiers as offers. */
export const ticketOffers = (event: {
  tiers: readonly {
    name: string;
    priceCents: number;
    available: boolean;
    salesStartAt: Date | null;
  }[];
}): JsonLdOffer[] =>
  event.tiers.map((tier) => ({
    name: tier.name,
    price: tier.priceCents / 100,
    available: tier.available,
    validFrom: tier.salesStartAt,
  }));

// Event structured data for individual events
interface EventJsonLdProps {
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  venue: {
    name: string;
    address?: string;
  };
  image?: string;
  /** Where to buy. With `offers`, each one links here. */
  ticketUrl?: string;
  /** The tiers on sale. Without them, a bare offer linking to `ticketUrl`. */
  offers?: JsonLdOffer[];
  performers?: Array<{
    name: string;
    type?: "Person" | "MusicGroup";
    /** Their page on the site, e.g. `/artist/handle`. */
    url?: string;
  }>;
  eventStatus?: "EventScheduled" | "EventCancelled" | "EventPostponed";
  eventAttendanceMode?:
    | "OfflineEventAttendanceMode"
    | "OnlineEventAttendanceMode"
    | "MixedEventAttendanceMode";
}

const availability = (available: boolean) =>
  `https://schema.org/${available ? "InStock" : "SoldOut"}`;

export function EventJsonLd({
  name,
  description,
  startDate,
  endDate,
  venue,
  image,
  ticketUrl,
  offers,
  performers,
  eventStatus = "EventScheduled",
  eventAttendanceMode = "OfflineEventAttendanceMode",
}: EventJsonLdProps) {
  const url = ticketUrl && absoluteUrl(ticketUrl);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "MusicEvent",
        name,
        description,
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString(),
        eventStatus: `https://schema.org/${eventStatus}`,
        eventAttendanceMode: `https://schema.org/${eventAttendanceMode}`,
        location: {
          "@type": "Place",
          name: venue.name,
          address: {
            "@type": "PostalAddress",
            ...(venue.address && { streetAddress: venue.address }),
            addressCountry: "NZ",
          },
        },
        image: absoluteUrl(image ?? DEFAULT_OG_IMAGE),
        organizer: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
        },
        ...(offers && offers.length > 0
          ? {
              offers: offers.map((offer) => ({
                "@type": "Offer",
                name: offer.name,
                price: offer.price,
                priceCurrency: "NZD",
                availability: availability(offer.available),
                url,
                validFrom: offer.validFrom?.toISOString(),
              })),
            }
          : url && {
              offers: {
                "@type": "Offer",
                url,
                availability: availability(true),
              },
            }),
        ...(performers &&
          performers.length > 0 && {
            performer: performers.map((p) => ({
              "@type": p.type ?? "Person",
              name: p.name,
              ...(p.url && { url: absoluteUrl(p.url) }),
            })),
          }),
      }}
    />
  );
}

/** A merch product with its price, for Google's product results. */
export function ProductJsonLd({
  name,
  description,
  image,
  url,
  price,
  currency,
  available,
}: {
  name: string;
  description: string;
  image?: string | null;
  url: string;
  price: number;
  currency: string;
  available: boolean;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description,
        ...(image && { image: absoluteUrl(image) }),
        brand: { "@type": "Brand", name: SITE_NAME },
        offers: {
          "@type": "Offer",
          url: absoluteUrl(url),
          price,
          priceCurrency: currency,
          availability: availability(available),
        },
      }}
    />
  );
}

// BreadcrumbList structured data
interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: absoluteUrl(item.url),
        })),
      }}
    />
  );
}
