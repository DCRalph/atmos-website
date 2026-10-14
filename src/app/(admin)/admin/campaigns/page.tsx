"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { CampaignsPanel } from "~/components/admin/ticketing/campaigns-panel";

/**
 * Every campaign across events, and links of your own that belong to none.
 * An event's own campaigns are made on that event's Campaigns tab.
 */
export default function CampaignsPage() {
  return (
    <AdminSection title="Campaigns">
      <CampaignsPanel />
    </AdminSection>
  );
}
