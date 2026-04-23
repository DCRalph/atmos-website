"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { ThemeEditor } from "~/components/creator-themes/theme-editor";
import { api } from "~/trpc/react";

export function AdminEditThemeView({ id }: { id: string }) {
  const themeQ = api.creatorThemes.getById.useQuery({ id });
  const subtitle = themeQ.data?.name;
  return (
    <AdminSection
      title="Edit theme"
      subtitle={subtitle}
      backLink={{
        href: "/admin/creator-themes",
        label: "← Back to themes",
      }}
    >
      <ThemeEditor themeId={id} mode="admin" />
    </AdminSection>
  );
}
