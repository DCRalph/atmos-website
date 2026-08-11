import { GigEditor } from "~/components/admin/gig-edit/gig-editor";

/**
 * Creating and editing a gig are the same form. Saving here creates the gig and
 * swaps the URL to `/admin/gigs/<id>` in place, so the poster and media gallery
 * light up without a reload.
 */
export default function NewGigPage() {
  return <GigEditor gigId={null} />;
}
