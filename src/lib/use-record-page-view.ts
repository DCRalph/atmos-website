"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { api } from "~/trpc/react";
import { readAttribution, visitId } from "~/lib/ticketing/attribution";

/**
 * Counts the page as viewed, on every public page, with the visit's tags.
 * Fire and forget: the server drops repeats in a visit, pages it doesn't
 * count and crawlers, and never fails. Call it after `useCaptureAttribution`
 * so a landing page's tags are already kept.
 */
export function useRecordPageView() {
  const path = usePathname();
  const { mutate } = api.pageViews.record.useMutation();
  useEffect(() => {
    const visit = visitId();
    if (!visit) return;
    mutate({ path, visitId: visit, utm: readAttribution() });
  }, [path, mutate]);
}
