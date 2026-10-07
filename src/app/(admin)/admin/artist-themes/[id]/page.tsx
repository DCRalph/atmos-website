import { AdminEditThemeView } from "./view";

export default async function AdminEditThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEditThemeView id={id} />;
}
