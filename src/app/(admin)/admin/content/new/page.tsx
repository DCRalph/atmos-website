import { ContentEditor } from "~/components/admin/content-edit/content-editor";

/**
 * Adding and editing a content item are the same form. Saving here creates the
 * item and swaps the URL to `/admin/content/<id>` in place.
 */
export default function NewContentPage() {
  return <ContentEditor itemId={null} />;
}
