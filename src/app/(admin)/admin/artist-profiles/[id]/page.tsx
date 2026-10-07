import { AdminEditArtistProfileView } from "./view";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEditArtistProfilePage({
  params,
}: PageProps) {
  const { id } = await params;
  return <AdminEditArtistProfileView id={id} />;
}
