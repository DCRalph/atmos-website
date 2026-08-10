"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { FilesManager } from "~/components/admin/files-manager";
import { UploadPresetsPanel } from "~/components/admin/upload-presets-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export default function FilesAdminPage() {
  return (
    <AdminSection
      title="Media Files"
      description="View and manage all uploaded files across the site"
    >
      <Tabs defaultValue="files" className="space-y-4">
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
