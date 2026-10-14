"use client";

import { useEffect } from "react";

import { resolveSource } from "~/lib/short-links/clicks";

/**
 * Where a buyer came from, kept for the visit.
 *
 * The tags are only in the address bar of the page someone lands on, so
 * whoever arrives on a tagged link and browses before buying would lose them.
 * `useCaptureAttribution` saves them on arrival, for the tab's session, and
 * checkout reads them back with `readAttribution`.
 *
 * Untagged arrivals from another site are kept as that site ("instagram",
 * medium "referral") rather than counted as direct.
 */

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
};

const STORE_KEY = "atmos-attribution";
const VISIT_KEY = "atmos-visit";

function fromUrl(): Attribution | undefined {
  const params = new URLSearchParams(window.location.search);
  const tags: Attribution = {
    source: params.get("utm_source") ?? undefined,
    medium: params.get("utm_medium") ?? undefined,
    campaign: params.get("utm_campaign") ?? undefined,
    content: params.get("utm_content") ?? undefined,
  };
  return Object.values(tags).some(Boolean) ? tags : undefined;
}

function fromReferrer(): Attribution | undefined {
  if (!document.referrer) return undefined;
  try {
    if (new URL(document.referrer).host === window.location.host) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  const source = resolveSource(null, document.referrer);
  return source === "direct" ? undefined : { source, medium: "referral" };
}

function stored(): Attribution | undefined {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * On every public page: a tagged link replaces what was kept, and an
 * untagged arrival from another site is kept only if nothing was.
 */
export function useCaptureAttribution() {
  useEffect(() => {
    const tags = fromUrl() ?? (stored() ? undefined : fromReferrer());
    if (!tags) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(tags));
    } catch {
      // Private mode can refuse storage. The address bar still works.
    }
  }, []);
}

/** For checkout: this page's tags, else the visit's. */
export function readAttribution(): Attribution | undefined {
  if (typeof window === "undefined") return undefined;
  return fromUrl() ?? stored();
}

/** This tab's visit, made on first ask. */
export function visitId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = sessionStorage.getItem(VISIT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(VISIT_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}
