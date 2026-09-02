"use client";

import { useState } from "react";
import { AdminSection } from "~/components/admin/admin-section";
import { ContentManager } from "~/components/admin/content-manager";
import { HomeContentManager } from "~/components/admin/home-content-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTabParam } from "~/hooks/use-tab-param";

export default function AdminContentPage() {
  const tab = useTabParam(["content", "reorder"]);
  // Mount the reorder tab lazily, then keep it mounted so drag changes and the
  // unsaved-changes warning survive switching back to the content tab.
  const [reorderOpened, setReorderOpened] = useState(tab.value === "reorder");

  return (
    <AdminSection
      title="Content"
      description="Mixes, videos and playlists, and which of them the home page shows."
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
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="reorder">Reorder</TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <ContentManager />
        </TabsContent>
        <TabsContent
          value="reorder"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          {reorderOpened ? <HomeContentManager /> : null}
        </TabsContent>
      </Tabs>
    </AdminSection>
  );
}
