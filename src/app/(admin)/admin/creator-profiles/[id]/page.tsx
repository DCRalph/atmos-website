import { AdminEditCreatorProfileView } from "./view";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEditCreatorProfilePage({ params }: PageProps) {
  const { id } = await params;
  return <AdminEditCreatorProfileView id={id} />;
}
