"use client";

import { AdminSection } from "~/components/admin/admin-section";
import { ThemeEditor } from "~/components/artist-themes/theme-editor";
import { api } from "~/trpc/react";

export function AdminEditThemeView({ id }: { id: string }) {
  const themeQ = api.artistThemes.getById.useQuery({ id });
  const subtitle = themeQ.data?.name;
  return (
    <AdminSection
      title="Edit theme"
      subtitle={subtitle}
      backLink={{
        href: "/admin/artist-themes",
        label: "Artist themes",
      }}
    >
      <ThemeEditor themeId={id} mode="admin" />
    </AdminSection>
  );
}
