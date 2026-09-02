"use client";

import { useState } from "react";
import { AdminSection } from "~/components/admin/admin-section";
import { GigsManager } from "~/components/admin/gigs-manager";
import { HomeGigsManager } from "~/components/admin/home-gigs-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTabParam } from "~/hooks/use-tab-param";

export default function AdminGigsPage() {
  const tab = useTabParam(["gigs", "reorder"]);
  // Mount the reorder tab lazily, then keep it mounted so drag changes and the
  // unsaved-changes warning survive switching back to the gigs tab.
  const [reorderOpened, setReorderOpened] = useState(tab.value === "reorder");

  return (
    <AdminSection
      title="Gigs"
      description="Upcoming and past gigs, and which of them the home page shows."
    >
      <Tabs
        value={tab.value}
        onValueChange={(value) => {
          if (value === "reorder") setReorderOpened(true);
          tab.onValueChange(value);
        }}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="gigs">Gigs</TabsTrigger>
          <TabsTrigger value="reorder">Reorder</TabsTrigger>
        </TabsList>
        <TabsContent value="gigs">
          <GigsManager />
        </TabsContent>
        <TabsContent
          value="reorder"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          {reorderOpened ? <HomeGigsManager /> : null}
        </TabsContent>
      </Tabs>
    </AdminSection>
  );
}
