"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { AnalyticsOverview } from "~/components/admin/ticketing/analytics-overview";

/**
 * Every event at once: when people buy, how far out, which kind of campaign
 * sells, and the events side by side. One event's own numbers are on its
 * page.
 */
export default function AnalyticsPage() {
  return (
    <AdminSection
      title="Analytics"
      description="Every event at once. Drafts and cancelled events are left out."
    >
      <AnalyticsOverview />
    </AdminSection>
  );
}
