import { ContentEditor } from "~/components/admin/content-edit/content-editor";

export default async function ContentItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContentEditor itemId={id} />;
}
