"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AdminSection } from "~/components/admin/admin-section";
import { Segmented } from "~/components/admin/segmented";
import { SiteAnalytics } from "~/components/admin/site-analytics";
import { AnalyticsOverview } from "~/components/admin/ticketing/analytics-overview";
import { Skeleton } from "~/components/ui/skeleton";

const TABS = [
  { value: "events", label: "Events" },
  { value: "site", label: "Site" },
] as const;

/**
 * Two tabs. Events: every event at once, when people buy, how far out, which
 * kind of campaign sells, and the events side by side; one event's own
 * numbers are on its page. Site: views of every public page. `?tab=site`
 * opens the second, so it survives a reload and can be linked to.
 */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-96" />}>
      <Analytics />
    </Suspense>
  );
}

function Analytics() {
  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get("tab") === "site" ? "site" : "events";

  const tabs = (
    <Segmented
      label="Analytics"
      options={TABS}
      value={tab}
      onChange={(next) =>
        router.replace(
          next === "site" ? "/admin/analytics?tab=site" : "/admin/analytics",
          { scroll: false },
        )
      }
    />
  );

  return (
    <AdminSection
      title="Analytics"
      description={
        tab === "site"
          ? "Every public page. A visit counts once per page, so a refresh adds nothing."
          : "Every event at once. Drafts and cancelled events are left out."
      }
    >
      {tab === "site" ? (
        <SiteAnalytics tabs={tabs} />
      ) : (
        <AnalyticsOverview tabs={tabs} />
      )}
    </AdminSection>
  );
}
