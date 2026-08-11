"use client";

import { useState } from "react";
import { AdminSection } from "~/components/admin/admin-section";
import { GigsManager } from "~/components/admin/gigs-manager";
import { HomeGigsManager } from "~/components/admin/home-gigs-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export default function AdminGigsPage() {
  // Mount the reorder tab lazily, then keep it mounted so drag changes and the
  // unsaved-changes warning survive switching back to the gigs tab.
  const [reorderOpened, setReorderOpened] = useState(false);

  return (
    <AdminSection title="Gigs" description="Manage upcoming and past gigs">
      <Tabs
        defaultValue="gigs"
        onValueChange={(value) => {
          if (value === "reorder") setReorderOpened(true);
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
