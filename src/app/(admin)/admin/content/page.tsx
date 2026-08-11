"use client";

import { useState } from "react";
import { AdminSection } from "~/components/admin/admin-section";
import { ContentManager } from "~/components/admin/content-manager";
import { HomeContentManager } from "~/components/admin/home-content-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export default function AdminContentPage() {
  // Mount the reorder tab lazily, then keep it mounted so drag changes and the
  // unsaved-changes warning survive switching back to the content tab.
  const [reorderOpened, setReorderOpened] = useState(false);

  return (
    <AdminSection
      title="Content"
      description="Manage posts, videos, and other content"
    >
      <Tabs
        defaultValue="content"
        onValueChange={(value) => {
          if (value === "reorder") setReorderOpened(true);
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
