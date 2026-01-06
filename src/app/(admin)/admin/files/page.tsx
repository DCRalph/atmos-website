"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { FilesManager } from "~/components/admin/files-manager";

export default function FilesAdminPage() {
  return (
    <AdminSection
      title="Media Files"
      description="View and manage all uploaded files across the site"
    >
      <FilesManager />
    </AdminSection>
  );
}

