import { Suspense } from "react";
import { ImportWizard } from "~/components/admin/gig-import/import-wizard";

/**
 * Reading an Instagram post into a draft gig. The wizard reads its import id
 * from the query string, so it needs a Suspense boundary around it.
 */
export default function ImportGigPage() {
  return (
    <Suspense fallback={null}>
      <ImportWizard />
    </Suspense>
  );
}
