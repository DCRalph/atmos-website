"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { FilesManager } from "~/components/admin/files-manager";
import { UploadPresetsPanel } from "~/components/admin/upload-presets-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTabParam } from "~/hooks/use-tab-param";

export default function FilesAdminPage() {
  const tab = useTabParam(["files", "targets"]);

  return (
    <AdminSection
      title="Media files"
      description="Everything uploaded across the site, and the limits enforced where it was uploaded."
    >
      <Tabs {...tab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="targets">Upload targets</TabsTrigger>
        </TabsList>
        <TabsContent value="files">
          <FilesManager />
        </TabsContent>
        <TabsContent value="targets">
          <UploadPresetsPanel />
        </TabsContent>
      </Tabs>
    </AdminSection>
  );
}
