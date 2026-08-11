"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  SITE_NAME,
  SITE_URL,
  PAGE_METADATA,
  formatFullTitle,
  DEFAULT_OG_IMAGE,
} from "~/lib/seo-constants";
import { isSearchEngineBot } from "~/lib/bot-detection";

/** Marks the tags this hook created, so cleanup never touches React's. */
const OWNED_ATTRIBUTE = "data-page-meta";

type MetadataOptions = {
  title?: string;
  ogTitle?: string;
  description?: string;
  image?: string;
  canonical?: string;
  keywords?: string[];
  /** Keep this page out of search results — unlisted and private pages. */
  noindex?: boolean;
};

export function usePageMetadata(options: MetadataOptions) {
  const pathname = usePathname();
  const { title, ogTitle, description, image, canonical, keywords, noindex } =
    options;

  useEffect(() => {
    // Determine page key from pathname
    const pageKey = pathname === "/" ? "home" : pathname.slice(1).split("/")[0];
    const pageMeta = PAGE_METADATA[pageKey as keyof typeof PAGE_METADATA];

    // Get default values from page metadata if available
    let finalTitle = title;
    if (!finalTitle && pageMeta) {
      if (typeof pageMeta.title === "string") {
        finalTitle = pageMeta.title;
      } else if (
        pageMeta.title &&
        typeof pageMeta.title === "object" &&
        "absolute" in pageMeta.title
      ) {
        finalTitle = pageMeta.title.absolute;
      }
    }
    finalTitle = finalTitle ?? SITE_NAME;

    const finalOgTitle =
      ogTitle ??
      (typeof finalTitle === "string"
        ? formatFullTitle(finalTitle)
        : finalTitle);
    const finalDescription = description ?? pageMeta?.description ?? "";
    const finalImage = image ?? `${SITE_URL}${DEFAULT_OG_IMAGE}`;
    const finalCanonical = canonical ?? `${SITE_URL}${pathname}`;
    const finalKeywords =
      keywords ?? (pageMeta?.keywords as string[] | undefined);

    // Update document title
    if (typeof finalTitle === "string") {
      document.title = finalTitle.includes("|")
        ? finalTitle
        : `${finalTitle} | ${SITE_NAME}`;
    } else if (
      finalTitle &&
      typeof finalTitle === "object" &&
      "absolute" in finalTitle
    ) {
      document.title = (finalTitle as { absolute: string }).absolute ?? "";
    }

    // Update or create meta tags.
    //
    // Tags that came from a `metadata` export are rendered by React, which
    // will remove them itself on the next navigation. Setting `content` on one
    // is fine — detaching it is not, because React would then try to remove a
    // node whose parent is already null and throw mid-commit, which aborts the
    // navigation and strands the previous page on screen. So anything created
    // here is marked as ours, and only ours is ever removed.
    const updateMetaTag = (
      name: string,
      content: string,
      attribute: string = "name",
    ) => {
      let element = document.querySelector(
        `meta[${attribute}="${name}"]`,
      ) as HTMLMetaElement;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        element.setAttribute(OWNED_ATTRIBUTE, "");
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Update or create property tags (for Open Graph)
    const updatePropertyTag = (property: string, content: string) => {
      updateMetaTag(property, content, "property");
    };

    // Description
    if (finalDescription) {
      updateMetaTag("description", finalDescription);
      updatePropertyTag("og:description", finalDescription);
      updateMetaTag("twitter:description", finalDescription);
    }

    // Title
    if (finalOgTitle) {
      updatePropertyTag("og:title", finalOgTitle);
      updateMetaTag("twitter:title", finalOgTitle);
    }

    // Image
    if (finalImage) {
      const imageUrl = finalImage.startsWith("http")
        ? finalImage
        : `${SITE_URL}${finalImage}`;
      updatePropertyTag("og:image", imageUrl);
      updateMetaTag("twitter:image", imageUrl);
    }

    // URL/Canonical
    if (finalCanonical) {
      updatePropertyTag("og:url", finalCanonical);

      // Update canonical link
      let canonicalLink = document.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.setAttribute("rel", "canonical");
        canonicalLink.setAttribute(OWNED_ATTRIBUTE, "");
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute("href", finalCanonical);
    }

    // Keywords
    if (finalKeywords && finalKeywords.length > 0) {
      updateMetaTag("keywords", finalKeywords.join(", "));
    }

    // Indexing. A page reachable only by a link somebody was sent has no
    // business in a search index, and that must not follow the visitor to the
    // next page — so rather than deleting the tag on the way out (which
    // detaches a node React is holding on to), whatever tag is there gets set
    // back to indexable. One is only created when a page actually asks to be
    // hidden and the document has none of its own.
    const existingRobots = document.querySelector('meta[name="robots"]');
    if (noindex || existingRobots) {
      updateMetaTag("robots", noindex ? "noindex, nofollow" : "index, follow");
    }

    // Open Graph type
    updatePropertyTag("og:type", "website");

    // Twitter card
    updateMetaTag("twitter:card", "summary_large_image");

    return () => {
      // Only the tags this hook added. React owns the rest.
      document
        .querySelectorAll(`head [${OWNED_ATTRIBUTE}]`)
        .forEach((element) => element.remove());
    };
  }, [
    pathname,
    title,
    ogTitle,
    description,
    image,
    canonical,
    keywords,
    noindex,
  ]);
}
