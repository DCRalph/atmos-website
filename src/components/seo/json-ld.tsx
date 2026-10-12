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
  ticketUrl?: string;
  performers?: Array<{
    name: string;
    type?: "Person" | "MusicGroup";
  }>;
  eventStatus?: "EventScheduled" | "EventCancelled" | "EventPostponed";
  eventAttendanceMode?:
    | "OfflineEventAttendanceMode"
    | "OnlineEventAttendanceMode"
    | "MixedEventAttendanceMode";
}

export function EventJsonLd({
  name,
  description,
  startDate,
  endDate,
  venue,
  image,
  ticketUrl,
  performers,
  eventStatus = "EventScheduled",
  eventAttendanceMode = "OfflineEventAttendanceMode",
}: EventJsonLdProps) {
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
        ...(ticketUrl && {
          offers: {
            "@type": "Offer",
            url: absoluteUrl(ticketUrl),
            availability: "https://schema.org/InStock",
          },
        }),
        ...(performers &&
          performers.length > 0 && {
            performer: performers.map((p) => ({
              "@type": p.type ?? "Person",
              name: p.name,
            })),
          }),
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
