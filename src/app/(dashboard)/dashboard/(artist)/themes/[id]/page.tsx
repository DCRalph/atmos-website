import { ThemeEditPageView } from "./view";

export const metadata = { title: "Edit theme" };

export default async function DashboardThemeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ThemeEditPageView id={id} />;
}
