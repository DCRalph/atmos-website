import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PerformerAgreement } from "~/components/admin/contracts/performer-agreement";
import { requireAdmin } from "~/server/auth-session";
import { getPerformerContract } from "~/server/contracts";

type Props = { searchParams: Promise<{ set?: string | string[] }> };

/** The booking named by `?set=` (a `GigSetArtist` id), or undefined for a blank contract. */
async function loadDetails({ searchParams }: Props) {
  const admin = await requireAdmin();
  const { set } = await searchParams;
  if (typeof set !== "string") return undefined;
  // Whoever generates the contract is the performer's Atmos contact by default.
  return (await getPerformerContract(set, admin.name)) ?? notFound();
}

/** The page title is the file name a browser offers when saving the PDF. */
export async function generateMetadata(props: Props): Promise<Metadata> {
  const details = await loadDetails(props);
  const title = details
    ? `Performer agreement - ${details.stageName} - ${details.event}`
    : "Performer agreement";
  return { title: { absolute: title } };
}

export default async function PerformerContractPage(props: Props) {
  return <PerformerAgreement details={await loadDetails(props)} />;
}
