import { GigEditor } from "~/components/admin/gig-edit/gig-editor";

export default async function GigManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GigEditor gigId={id} />;
}
