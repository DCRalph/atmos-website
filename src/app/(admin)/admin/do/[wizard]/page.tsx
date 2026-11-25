import { Suspense } from "react";
import { notFound } from "next/navigation";

import { isWizardKey } from "~/components/admin/wizards/catalog";
import { Wizard } from "~/components/admin/wizards/wizard";

/**
 * One wizard. Which gig or event it works on comes from `?gig=` or `?event=`,
 * read on the client, so it sits inside a Suspense boundary.
 */
export default async function WizardPage({
  params,
}: {
  params: Promise<{ wizard: string }>;
}) {
  const { wizard } = await params;
  if (!isWizardKey(wizard)) notFound();
  return (
    <Suspense fallback={null}>
      <Wizard wizard={wizard} />
    </Suspense>
  );
}
