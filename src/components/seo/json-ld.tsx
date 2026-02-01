import Script from "next/script";
import { links } from "~/app/(main)/socials/Socials";
import {
  SITE_NAME,
  SITE_URL,
  DESCRIPTION_SHORT,
  DESCRIPTION_LONG,
  DEFAULT_OG_IMAGE,
} from "~/lib/seo-constants";

// Organization structured data
export function OrganizationJsonLd() {
  const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "ATMOS Media",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: DESCRIPTION_LONG,
    sameAs: [
      // Add your social media URLs here
      links.instagram,
      links.tiktok,
      links.youtube,
      links.facebook,
      links.soundcloud,
      links.spotify,
      links.twitter,
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Wellington",
      addressRegion: "Wellington",
      addressCountry: "NZ",
    },
    areaServed: {
      "@type": "City",
      name: "Wellington",
      alternateName: "Pōneke",
    },
    knowsAbout: [
      "Electronic Music",
      "Club Nights",
      "DJ Events",
      "Techno",
      "House Music",
      "Underground Music",
    ],
  };

  return (
    <Script
      id="organization-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
      strategy="afterInteractive"
    />
  );
}

// WebSite structured data with search action
export function WebSiteJsonLd() {
  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "ATMOS Events Wellington",
    url: SITE_URL,
    description: DESCRIPTION_SHORT,
    inLanguage: "en-NZ",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <Script
      id="website-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
      strategy="afterInteractive"
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
  eventAttendanceMode?: "OfflineEventAttendanceMode" | "OnlineEventAttendanceMode" | "MixedEventAttendanceMode";
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
  const eventData = {
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
      address: venue.address
        ? {
          "@type": "PostalAddress",
          streetAddress: venue.address,
          addressLocality: "Wellington",
          addressCountry: "NZ",
        }
        : {
          "@type": "PostalAddress",
          addressLocality: "Wellington",
          addressCountry: "NZ",
        },
    },
    image: image ?? `${SITE_URL}${DEFAULT_OG_IMAGE}`,
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    ...(ticketUrl && {
      offers: {
        "@type": "Offer",
        url: ticketUrl,
        availability: "https://schema.org/InStock",
        validFrom: new Date().toISOString(),
      },
    }),
    ...(performers &&
      performers.length > 0 && {
      performer: performers.map((p) => ({
        "@type": p.type ?? "Person",
        name: p.name,
      })),
    }),
  };

  return (
    <Script
      id={`event-jsonld-${name.replace(/\s+/g, "-").toLowerCase()}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(eventData) }}
      strategy="afterInteractive"
    />
  );
}

// BreadcrumbList structured data
interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };

  return (
    <Script
      id="breadcrumb-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      strategy="afterInteractive"
    />
  );
}

// ItemList for events listing page
interface EventListItem {
  name: string;
  url: string;
  image?: string;
  date: Date;
}

export function EventListJsonLd({ events }: { events: EventListItem[] }) {
  const listData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "MusicEvent",
        name: event.name,
        url: event.url.startsWith("http") ? event.url : `${SITE_URL}${event.url}`,
        image: event.image ?? `${SITE_URL}${DEFAULT_OG_IMAGE}`,
        startDate: event.date.toISOString(),
        location: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Wellington",
            addressCountry: "NZ",
          },
        },
      },
    })),
  };

  return (
    <Script
      id="event-list-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(listData) }}
      strategy="afterInteractive"
    />
  );
}
